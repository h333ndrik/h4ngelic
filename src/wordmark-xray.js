import { Vector3, TextureLoader, DataTexture, RGBAFormat } from 'three';
import { xraySettings } from './data/xraySettings.js';
import { corruptionSettings } from './data/corruptionSettings.js';

/** Apply the alternate palette only to wordmark fragments, after tone mapping.
 * Chaining the material hook preserves the chrome lighting and artwork reveal.
 * Mode changes update uniforms; they never create a second animation loop.
 */
export function attachWordmarkXRay(material, { renderer, root = document, settings = xraySettings } = {}) {
  const amount = { value: 0 };
  const placeholder = new DataTexture(new Uint8Array([80, 30, 150, 255]), 1, 1, RGBAFormat);
  placeholder.needsUpdate = true;
  const damage = { value: placeholder };
  let damageTexture = null;
  let loading = false;
  let disposed = false;
  function prepareDamage() {
    if (loading || disposed) return;
    loading = true;
    const mobile = matchMedia('(pointer: coarse)').matches || navigator.deviceMemory > 0 && navigator.deviceMemory <= 4;
    new TextureLoader().load(corruptionSettings.assets[mobile ? 'mobile' : 'desktop'], texture => {
      if (disposed) { texture.dispose(); return; }
      damageTexture = texture;
      damage.value = texture;
    }, undefined, () => { loading = false; });
  }
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
    shader.uniforms.h4Damage = damage;
    shader.uniforms.h4DamageIntensity = { value: corruptionSettings.distressIntensity };
    shader.uniforms.h4BurnIntensity = { value: corruptionSettings.filmBurnIntensity };
    shader.uniforms.h4Glow = { value: corruptionSettings.glowStrength };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `
      #include <common>
      varying vec3 vH4DamagePosition;
    `).replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vH4DamagePosition = transformed;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
      #include <common>
      uniform float h4XrayAmount;
      uniform float h4XraySaturation;
      uniform vec3 h4XrayShadow;
      uniform vec3 h4XrayLow;
      uniform vec3 h4XrayMid;
      uniform vec3 h4XrayLight;
      uniform sampler2D h4Damage;
      uniform float h4DamageIntensity;
      uniform float h4BurnIntensity;
      uniform float h4Glow;
      varying vec3 vH4DamagePosition;
      float h4CellNoise(vec2 value) { return fract(sin(dot(value, vec2(127.1, 311.7))) * 43758.5453); }
    `).replace('#include <dithering_fragment>', `
      if (h4XrayAmount > 0.0) {
        vec3 h4Original = gl_FragColor.rgb;
        float h4Luminance = dot(h4Original, vec3(0.2126, 0.7152, 0.0722));
        vec3 h4Tonal = mix(vec3(h4Luminance), h4Original, h4XraySaturation);
        vec3 h4Solarized = mix(h4XrayShadow, h4XrayLow, clamp(h4Tonal * 4.0, 0.0, 1.0));
        h4Solarized = mix(h4Solarized, h4XrayMid, clamp((h4Tonal - 0.25) * 4.0, 0.0, 1.0));
        h4Solarized = mix(h4Solarized, h4XrayLight, clamp((h4Tonal - 0.5) * 2.0, 0.0, 1.0));
        vec2 h4FilmUV = fract(vH4DamagePosition.xy * vec2(0.095, 0.22) + vec2(0.51, 0.47));
        vec3 h4Film = texture2D(h4Damage, h4FilmUV).rgb;
        vec3 h4FilmShift = texture2D(h4Damage, h4FilmUV + vec2(0.006, -0.002)).rgb;
        float h4Rupture = length(h4Film - h4FilmShift);
        float h4Cell = h4CellNoise(floor(h4FilmUV * vec2(100.0, 50.0)));
        float h4Corrosion = smoothstep(0.12, 0.66, dot(h4Film, vec3(0.25, 0.5, 0.25)));
        vec3 h4Damaged = mix(h4Solarized, h4Film * 1.6, clamp(h4DamageIntensity * 0.72, 0.0, 1.0));
        h4Damaged *= mix(0.12, 1.55, h4Corrosion);
        float h4Rim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.0);
        h4Damaged += vec3(0.95, 0.015, 0.65) * h4Rim * (0.25 + h4Cell * 0.6);
        float h4Hot = smoothstep(0.76, 0.97, max(h4Film.r, max(h4Film.g, h4Film.b))) * h4BurnIntensity;
        h4Damaged = mix(h4Damaged, vec3(1.0), clamp((h4Hot * 0.8 + h4Rupture * 0.4) * h4Glow, 0.0, 1.0));
        if (h4Cell > 0.974 && h4Rim > 0.64 && h4XrayAmount > 0.98 && h4DamageIntensity > 0.5) discard;
        gl_FragColor.rgb = mix(h4Original, h4Damaged, h4XrayAmount);
      }
      #include <dithering_fragment>
    `);
  };
  material.customProgramCacheKey = function () {
    return `${previousCacheKey.call(this)}-h4-film-corrosion-v4`;
  };
  material.needsUpdate = true;

  function applyMode(mode) {
    const enabled = mode === 'xray';
    amount.value = enabled ? 1 : 0;
    renderer.setClearColor('#303033', enabled ? 0 : 1);
    if (enabled) prepareDamage();
  }
  const modeChange = event => { if (event.detail?.mode === 'xray') prepareDamage(); };
  const modeProgress = event => {
    amount.value = Math.max(0, Math.min(1, event.detail?.amount || 0));
    renderer.setClearColor('#303033', 1 - amount.value);
  };
  root.addEventListener('h4:modechange', modeChange);
  root.addEventListener('h4:modeprogress', modeProgress);
  root.addEventListener('h4:modeprepare', prepareDamage);
  applyMode(root.documentElement.dataset.mode);

  return {
    amount,
    dispose() {
      root.removeEventListener('h4:modechange', modeChange);
      root.removeEventListener('h4:modeprogress', modeProgress);
      root.removeEventListener('h4:modeprepare', prepareDamage);
      disposed = true;
      damageTexture?.dispose();
      placeholder.dispose();
      material.onBeforeCompile = previousCompile;
      material.customProgramCacheKey = previousCacheKey;
      material.needsUpdate = true;
    },
  };
}
