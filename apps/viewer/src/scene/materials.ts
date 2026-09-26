import { ShaderMaterial } from 'three';

/** Holographic building material: edge glow, height gradient, floor bands, scan line and fresnel rim. Supports instance colors. */
export function createBuildingMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.92 } },
    transparent: true,
    depthWrite: true,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vH;
      varying vec3 vNormalW;
      varying vec3 vWorld;
      varying float vScaleY;
      void main() {
        vUv = uv;
        vColor = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          vColor = instanceColor;
        #endif
        mat4 m = modelMatrix;
        vScaleY = 1.0;
        #ifdef USE_INSTANCING
          m = modelMatrix * instanceMatrix;
          vScaleY = length(vec3(instanceMatrix[1]));
        #endif
        vec4 wp = m * vec4(position, 1.0);
        vH = position.y;
        vNormalW = normalize(mat3(m) * normal);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vH;
      varying vec3 vNormalW;
      varying vec3 vWorld;
      varying float vScaleY;
      void main() {
        vec2 e2 = abs(vUv - 0.5) * 2.0;
        float edge = smoothstep(0.86, 1.0, max(e2.x, e2.y));
        float isTop = step(0.5, vNormalW.y);
        float grad = mix(0.10, 0.62, clamp(vH, 0.0, 1.0));
        float floors = (1.0 - isTop) * step(0.82, fract(vH * vScaleY * 1.35)) * 0.14;
        float scan = (1.0 - isTop) * smoothstep(0.03, 0.0, abs(fract(vH - uTime * 0.12) - 0.5)) * 0.35;
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - abs(dot(viewDir, vNormalW)), 2.2);
        vec3 col = vColor * (grad + floors + scan + isTop * 0.85);
        col += vColor * edge * 1.9;
        col += vColor * fres * 0.45;
        gl_FragColor = vec4(col, uOpacity * (0.78 + edge * 0.22 + isTop * 0.2));
      }
    `,
  });
}
