import { Vector3 } from 'three';
import { xraySettings } from './data/xraySettings.js';

/** Apply the alternate palette only to wordmark fragments, after tone mapping.
 * Chaining the material hook preserves the chrome lighting and artwork reveal.
 * Mode changes update uniforms; they never create a second animation loop.
 */
export function attachWordmarkXRay(material, { renderer, root = document, settings = xraySettings } = {}) {
  const amount = { value: 0 };
  // The animated hero uses four tonal anchors. Static photos retain the full
  // nine-point treatment without paying for it on every chrome fragment.
  const anchors = [0, 2, 4, 8].map((index) => new Vector3(
    settings.channels.red[index], settings.channels.green[index], settings.channels.blue[index],
  ));
  const previousCompile = material.onBeforeCompile;
  const previousCacheKey = material.customProgramCacheKey;

  material.onBeforeCompile = function (shader, rendererInstance) {
    previousCompile.call(this, shader, rendererInstance);
    shader.uniforms.h4XrayAmount = amount;
    shader.uniforms.h4XraySaturation = { value: settings.saturation };
    shader.uniforms.h4XrayShadow = { value: anchors[0] };
    shader.uniforms.h4XrayLow = { value: anchors[1] };
    shader.uniforms.h4XrayMid = { value: anchors[2] };
    shader.uniforms.h4XrayLight = { value: anchors[3] };
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
      #include <common>
      uniform float h4XrayAmount;
      uniform float h4XraySaturation;
      uniform vec3 h4XrayShadow;
      uniform vec3 h4XrayLow;
      uniform vec3 h4XrayMid;
      uniform vec3 h4XrayLight;
    `).replace('#include <dithering_fragment>', `
      if (h4XrayAmount > 0.0) {
        vec3 h4Original = gl_FragColor.rgb;
        float h4Luminance = dot(h4Original, vec3(0.2126, 0.7152, 0.0722));
        vec3 h4Tonal = mix(vec3(h4Luminance), h4Original, h4XraySaturation);
        vec3 h4Solarized = mix(h4XrayShadow, h4XrayLow, clamp(h4Tonal * 4.0, 0.0, 1.0));
        h4Solarized = mix(h4Solarized, h4XrayMid, clamp((h4Tonal - 0.25) * 4.0, 0.0, 1.0));
        h4Solarized = mix(h4Solarized, h4XrayLight, clamp((h4Tonal - 0.5) * 2.0, 0.0, 1.0));
        gl_FragColor.rgb = mix(h4Original, h4Solarized, h4XrayAmount);
      }
      #include <dithering_fragment>
    `);
  };
  material.customProgramCacheKey = function () {
    return `${previousCacheKey.call(this)}-h4-wordmark-xray-four-anchor-v3`;
  };
  material.needsUpdate = true;

  function applyMode(mode) {
    const enabled = mode === 'xray';
    amount.value = enabled ? 1 : 0;
    renderer.setClearColor(enabled ? settings.palette.background : '#303033');
  }
  const modeChange = (event) => applyMode(event.detail?.mode);
  root.addEventListener('h4:modechange', modeChange);
  applyMode(root.documentElement.dataset.mode);

  return {
    amount,
    dispose() {
      root.removeEventListener('h4:modechange', modeChange);
      material.onBeforeCompile = previousCompile;
      material.customProgramCacheKey = previousCacheKey;
      material.needsUpdate = true;
    },
  };
}
