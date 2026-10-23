import { ClampToEdgeWrapping, LinearMipmapLinearFilter, TextureLoader, Vector2, Vector3 } from 'three';

export const REVEAL_ANGLE = 150;
const front = new Vector3(0, 0, 1);
const displayed = new Vector3();

// Read the displayed surface normal, including interactive quaternion rotation.
export function revealWeight(quaternion, targetDegrees = REVEAL_ANGLE) {
  displayed.copy(front).applyQuaternion(quaternion);
  const yaw = Math.atan2(displayed.x, displayed.z);
  const target = targetDegrees * Math.PI / 180;
  const distance = Math.abs(Math.atan2(Math.sin(yaw - target), Math.cos(yaw - target)));
  const fade = Math.max(0, Math.min(1, 1 - distance / (30 * Math.PI / 180)));
  return fade * fade * (3 - 2 * fade);
}

/**
 * Reflect the supplied artwork inside the physical chrome shader itself. The
 * original is black artwork on an opaque white page; its luminance gradients
 * become white lines, so its paper background never becomes a decal rectangle.
 */
export async function attachArtwork(material, { url = '/assets/tattoo-texture.webp', width, height }) {
  const texture = await new TextureLoader().loadAsync(url);
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  const imageWidth = texture.image.width;
  const imageHeight = texture.image.height;
  const opacity = { value: 0 };
  const previousCompile = material.onBeforeCompile;
  const previousCacheKey = material.customProgramCacheKey;
  const physicalWidth = Math.max(width || 1, height || 1);
  const uniforms = {
    h4Artwork: { value: texture },
    h4ArtworkOpacity: opacity,
    h4ArtworkTexel: { value: new Vector2(1 / imageWidth, 1 / imageHeight) },
    // Keep the source portrait's proportions; the wordmark reflects a section
    // of the image rather than stretching the portrait into a narrow banner.
    h4ArtworkSize: { value: new Vector2(physicalWidth, physicalWidth * imageHeight / imageWidth) },
  };

  material.onBeforeCompile = function (shader, renderer) {
    previousCompile.call(this, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `
      #include <common>
      varying vec3 vH4ArtworkPosition;
      varying vec3 vH4ArtworkNormal;
    `).replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vH4ArtworkPosition = transformed;
      vH4ArtworkNormal = normal;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
      #include <common>
      uniform sampler2D h4Artwork;
      uniform float h4ArtworkOpacity;
      uniform vec2 h4ArtworkTexel;
      uniform vec2 h4ArtworkSize;
      varying vec3 vH4ArtworkPosition;
      varying vec3 vH4ArtworkNormal;
      float h4Paper(vec2 coordinate) {
        return dot(texture2D(h4Artwork, coordinate).rgb, vec3(0.2126, 0.7152, 0.0722));
      }
    `).replace('#include <opaque_fragment>', `
      if (h4ArtworkOpacity > 0.001) {
        vec3 h4Reflection = inverseTransformDirection(reflect(-normalize(vViewPosition), normal), viewMatrix);
        vec2 h4UV = vH4ArtworkPosition.xy / h4ArtworkSize + 0.5;
        // Reflected viewing direction moves/distorts the pattern at bevels and
        // as the object tumbles. It remains part of the actual mesh surface.
        h4UV += h4Reflection.xy * vec2(0.09, 0.07);
        vec2 h4Step = clamp(max(h4ArtworkTexel * 1.5, fwidth(h4UV) * 0.6), h4ArtworkTexel, h4ArtworkTexel * 3.0);
        float h4Dx = abs(h4Paper(h4UV + vec2(h4Step.x, 0.0)) - h4Paper(h4UV - vec2(h4Step.x, 0.0)));
        float h4Dy = abs(h4Paper(h4UV + vec2(0.0, h4Step.y)) - h4Paper(h4UV - vec2(0.0, h4Step.y)));
        float h4Edges = smoothstep(0.12, 0.45, h4Dx + h4Dy);
        float h4Ink = 1.0 - h4Paper(h4UV);
        float h4Surface = smoothstep(0.55, 0.97, abs(normalize(vH4ArtworkNormal).z));
        float h4Lines = clamp(h4Edges * 0.72 + h4Ink * 0.025, 0.0, 1.0) * h4Surface;
        outgoingLight = mix(outgoingLight, max(outgoingLight, vec3(1.6)), h4Lines * h4ArtworkOpacity * 0.72);
      }
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey = function () {
    return `${previousCacheKey.call(this)}-h4-artwork-reflection-v1`;
  };
  material.needsUpdate = true;

  return {
    opacity,
    texture,
    dispose() {
      material.onBeforeCompile = previousCompile;
      material.customProgramCacheKey = previousCacheKey;
      material.needsUpdate = true;
      texture.dispose();
    },
  };
}
