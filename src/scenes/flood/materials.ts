import * as THREE from 'three'

/**
 * Wave height shared by the GPU (brick ocean) and the CPU (the ark's bobbing),
 * so the ark rides exactly the waves you see. Returns roughly -1..1.
 */
export function wave(x: number, z: number, t: number) {
  return (
    0.55 * Math.sin(x * 0.32 + z * 0.18 + t * 1.15) +
    0.3 * Math.sin(-x * 0.21 + z * 0.47 + t * 1.55) +
    0.15 * Math.sin(x * 0.83 - z * 0.61 + t * 2.3)
  )
}

const WAVE_GLSL = /* glsl */ `
  float wave(vec2 p, float t) {
    return 0.55 * sin(p.x * 0.32 + p.y * 0.18 + t * 1.15)
         + 0.30 * sin(-p.x * 0.21 + p.y * 0.47 + t * 1.55)
         + 0.15 * sin(p.x * 0.83 - p.y * 0.61 + t * 2.3);
  }
`

/** Uniforms shared by the brick ocean and the flat far sea, written once per frame. */
export function oceanUniforms() {
  return {
    uTime: { value: 0 },
    uLevel: { value: -2 },
    uAmp: { value: 1 },
    uStep: { value: 0.16 },
    uCell: { value: 0.8 },
    uRadius: { value: 25 },
    uCenter: { value: new THREE.Vector2() },
    uDeep: { value: new THREE.Color('#123a6b') },
    uShallow: { value: new THREE.Color('#2f7fc4') },
    uFoam: { value: new THREE.Color('#dff3ff') },
    uSky: { value: new THREE.Color('#5a6b85') },
    uFog: { value: new THREE.Color('#2a3140') },
    uFogNear: { value: 20 },
    uFogFar: { value: 80 },
    uSun: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
    uSunAmt: { value: 0.2 },
    uFlash: { value: 0 },
  }
}
export type OceanUniforms = ReturnType<typeof oceanUniforms>

const OCEAN_FRAG = /* glsl */ `
  uniform vec3 uDeep, uShallow, uFoam, uSky, uFog, uSun;
  uniform float uFogNear, uFogFar, uSunAmt, uFlash, uAmp, uRadius;
  uniform vec2 uCenter;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vCrest;
  void main() {
    #ifdef FAR
    // the brick ocean covers the middle; the flat sea only fills in beyond it
    if (length(vWorld.xz - uCenter) < uRadius * 0.9) discard;
    #endif
    vec3 n = normalize(vNormal);
    vec3 v = normalize(cameraPosition - vWorld);
    float depth = length(cameraPosition - vWorld);
    // trans-blue plastic: lighter on the crests, white "foam" bricks on top
    vec3 col = mix(uDeep, uShallow, smoothstep(-0.6, 0.8, vCrest));
    col = mix(col, uFoam, smoothstep(0.62, 0.8, vCrest) * step(0.5, n.y));
    // procedural studs on the top faces (fade with distance like the baseplate)
    float top = step(0.5, n.y);
    vec2 f = fract(vWorld.xz / 0.4) - 0.5;
    float d = length(f);
    float lod = (1.0 - smoothstep(10.0, 22.0, depth)) * top;
    float stud = (1.0 - smoothstep(0.27, 0.31, d)) * lod;
    float rim = smoothstep(0.19, 0.29, d) * stud;
    col *= 1.0 + stud * 0.08 - rim * 0.22 * (0.6 + 0.4 * dot(normalize(f + 1e-4), -normalize(uSun.xz + 1e-4)));
    // light: half lambert + glossy spec + fresnel sky reflection
    float diff = 0.5 + 0.5 * max(dot(n, uSun), 0.0);
    col *= mix(0.55, 1.05, diff) * (n.y > 0.5 ? 1.0 : 0.72);
    vec3 h = normalize(uSun + v);
    float spec = pow(max(dot(n, h), 0.0), 48.0) * (0.25 + 0.9 * uSunAmt);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    col = mix(col, uSky, fres * 0.45) + spec;
    col += uFlash * vec3(0.35, 0.4, 0.5);
    float fog = smoothstep(uFogNear, uFogFar, depth);
    gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

/**
 * Brick ocean: one instanced column per 2x2 cell. Each column rises to the
 * wave height at its centre, quantised to plate heights, so the sea moves
 * in stepped LEGO terraces. Everything happens in the vertex shader.
 */
export function brickOceanMaterial(u: OceanUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */ `
      uniform float uTime, uLevel, uAmp, uStep, uCell, uRadius;
      uniform vec2 uCenter;
      attribute vec2 aCell;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vCrest;
      ${WAVE_GLSL}
      void main() {
        vec2 c = uCenter + aCell * uCell;
        float edge = 1.0 - smoothstep(uRadius * 0.55, uRadius, length(aCell * uCell));
        float w = wave(c, uTime);
        float h = w * uAmp * edge;
        float hq = floor(h / uStep + 0.5) * uStep;
        float top = uLevel + hq;
        vec3 p;
        p.xz = c + position.xz * uCell * 0.985;
        p.y = mix(top - 3.0, top, position.y + 0.5);
        vWorld = p;
        vNormal = normal;
        vCrest = w * edge;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: OCEAN_FRAG,
  })
}

/** The flat sea beyond the brick ocean, sharing its colours and fog. */
export function farSeaMaterial(u: OceanUniforms) {
  return new THREE.ShaderMaterial({
    uniforms: u,
    defines: { FAR: 1 },
    vertexShader: /* glsl */ `
      uniform float uLevel;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vCrest;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        w.y = uLevel - 0.05;
        vWorld = w.xyz;
        vNormal = vec3(0.0, 1.0, 0.0);
        vCrest = 0.0;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: OCEAN_FRAG,
  })
}

/** Sky dome that blends storm, golden morning and clear day, with painted storm clouds and lightning. */
export function floodSkyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uStormTop: { value: new THREE.Color('#1a2030') },
      uStormHor: { value: new THREE.Color('#3b4558') },
      uDawnTop: { value: new THREE.Color('#5f86c4') },
      uDawnHor: { value: new THREE.Color('#ffc58a') },
      uClearTop: { value: new THREE.Color('#3f86d8') },
      uClearHor: { value: new THREE.Color('#cfe8ff') },
      uStorm: { value: 1 },
      uClear: { value: 0 },
      uPart: { value: 0 },
      uFlash: { value: 0 },
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(-0.6, 0.25, -0.75).normalize() },
      uSunCol: { value: new THREE.Color('#fff0c8') },
      uFog: { value: new THREE.Color('#3a4456') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uStormTop, uStormHor, uDawnTop, uDawnHor, uClearTop, uClearHor, uSunDir, uSunCol, uFog;
      uniform float uStorm, uClear, uPart, uFlash, uTime;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + 1.0), f.x), f.y);
      }
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        float g = pow(h, 0.55);
        vec3 calm = mix(mix(uDawnHor, uDawnTop, g), mix(uClearHor, uClearTop, g), uClear);
        vec3 storm = mix(uStormHor, uStormTop, g);
        float s = max(dot(vDir, uSunDir), 0.0);
        // painted cloud deck, projected onto a flat ceiling so it streams to the horizon
        vec2 q = vDir.xz / (vDir.y + 0.25) * 2.2 + vec2(uTime * 0.03, uTime * 0.012);
        float c = noise(q) * 0.55 + noise(q * 2.1 + 3.7) * 0.3 + noise(q * 4.3 - 1.3) * 0.15;
        // the clouds open around the sun as God sends the wind
        float open = uPart * smoothstep(0.55, 0.95, s);
        float cover = clamp(uStorm * 1.2 - open, 0.0, 1.0);
        float cloud = smoothstep(0.35, 0.75, c) * cover * smoothstep(-0.02, 0.15, vDir.y);
        vec3 col = mix(calm, storm, clamp(uStorm - open * 0.8, 0.0, 1.0));
        col = mix(col, mix(storm * 0.75, storm * 1.25, c), cloud * 0.8);
        col += uSunCol * (pow(s, 90.0) * 1.4 + pow(s, 7.0) * 0.3) * (1.0 - cover * 0.9);
        // melt into the fog at (and below) the horizon so the far sea has no seam
        col = mix(uFog, col, smoothstep(-0.02, 0.22, vDir.y));
        col += uFlash * vec3(0.55, 0.6, 0.78) * (0.4 + 0.6 * h);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
}

/**
 * GPU rain: points scattered in a box that wraps around the camera, falling in
 * the vertex shader and drawn as slanted streaks. `uRain` thins the drops out.
 */
export function rainMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uRain: { value: 1 },
      uBox: { value: new THREE.Vector3(26, 18, 26) },
      uPixelRatio: { value: 1 },
      uFlash: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime, uRain, uPixelRatio;
      uniform vec3 uBox;
      attribute float aSeed;
      varying float vVis;
      void main() {
        vec3 p = position * uBox;
        p.y -= uTime * (16.0 + aSeed * 8.0);
        p.x += uTime * 2.5;
        vec3 base = cameraPosition - uBox * 0.5;
        p = mod(p - base, uBox) + base;
        vVis = step(aSeed, uRain);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(9.0 * uPixelRatio * (12.0 / -mv.z), 2.0, 34.0) * vVis;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFlash;
      varying float vVis;
      void main() {
        if (vVis < 0.5) discard;
        vec2 pc = gl_PointCoord - 0.5;
        float x = abs(pc.x + pc.y * 0.16);
        float a = (1.0 - smoothstep(0.02, 0.07, x)) * (1.0 - smoothstep(0.3, 0.5, abs(pc.y)));
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(0.78, 0.86, 1.0) + uFlash * 0.3, a * 0.55);
      }`,
  })
}

/**
 * Brick confetti fired in bursts: each particle's arc is computed from its
 * launch velocity, so the whole shower costs no CPU after it starts.
 */
export function confettiMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uStart: { value: -100 },
      uPixelRatio: { value: 1 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime, uStart, uPixelRatio;
      attribute vec3 aVel;
      attribute vec3 aColor;
      attribute float aSeed;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSpin;
      void main() {
        // repeat a burst every 6 s, each particle a little delayed
        float t = mod(uTime - uStart - aSeed * 0.5, 6.0);
        float live = step(0.0, uTime - uStart - aSeed * 0.5);
        float drag = 1.0 - exp(-t * 1.6);
        vec3 p = position + aVel * drag / 1.6;
        p.y -= 1.2 * t * t * 0.5 + t * 0.4;
        p.x += sin(t * 3.0 + aSeed * 20.0) * 0.25;
        vColor = aColor;
        vAlpha = live * (1.0 - smoothstep(3.5, 5.0, t));
        vSpin = t * (4.0 + aSeed * 6.0) + aSeed * 10.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = min(7.0 * uPixelRatio * (30.0 / -mv.z), 26.0 * uPixelRatio) * live;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSpin;
      void main() {
        // a tumbling little brick: a rectangle that flips as it spins
        vec2 pc = gl_PointCoord - 0.5;
        float c = cos(vSpin), s = sin(vSpin);
        pc = mat2(c, -s, s, c) * pc;
        float flip = 0.25 + 0.75 * abs(sin(vSpin * 0.7));
        if (abs(pc.x) > 0.42 || abs(pc.y) > 0.24 * flip) discard;
        float shade = 0.8 + 0.4 * step(0.0, pc.y);
        gl_FragColor = vec4(vColor * shade, vAlpha);
        if (vAlpha < 0.01) discard;
      }`,
  })
}

/** Soft additive halo behind the brick rainbow. */
export function rainbowGlowMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: { uReveal: { value: 0 }, uInner: { value: 20 }, uOuter: { value: 32 } },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() {
        vP = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uReveal, uInner, uOuter;
      varying vec2 vP;
      vec3 spectrum(float k) {
        // k: 0 inner (violet) .. 1 outer (red)
        vec3 c = vec3(0.55, 0.2, 0.9);
        c = mix(c, vec3(0.2, 0.35, 1.0), smoothstep(0.05, 0.2, k));
        c = mix(c, vec3(0.1, 0.8, 0.3), smoothstep(0.3, 0.45, k));
        c = mix(c, vec3(1.0, 0.9, 0.1), smoothstep(0.5, 0.62, k));
        c = mix(c, vec3(1.0, 0.5, 0.1), smoothstep(0.68, 0.8, k));
        c = mix(c, vec3(1.0, 0.15, 0.15), smoothstep(0.85, 0.95, k));
        return c;
      }
      void main() {
        float r = length(vP);
        float k = (r - uInner) / (uOuter - uInner);
        float band = smoothstep(-0.25, 0.1, k) * (1.0 - smoothstep(0.9, 1.25, k));
        float ang = atan(vP.y, vP.x) / 3.14159265; // 1 at the left foot, 0 at the right
        float th = 1.0 - uReveal * 1.1;
        float reveal = smoothstep(th - 0.06, th + 0.02, ang);
        float a = band * reveal * 0.32;
        gl_FragColor = vec4(spectrum(clamp(k, 0.0, 1.0)) * a, a);
      }`,
  })
}

/**
 * Plastic for the big terrain bricks: plain boxes whose top faces get studs
 * drawn in the fragment shader at the normal stud pitch (like the baseplate),
 * so huge mountains cost a few triangles per brick and studs never look giant.
 */
export function terrainMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.34, metalness: 0 })
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vTW;\nvoid main() {')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        #ifdef USE_INSTANCING
          vTW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vTW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`,
      )
    shader.fragmentShader = shader.fragmentShader.replace('void main() {', 'varying vec3 vTW;\nvoid main() {').replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      float up = dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));
      float dist = length(vViewPosition);
      float lod = step(0.6, up) * (1.0 - smoothstep(16.0, 30.0, dist));
      vec2 sf = fract(vTW.xz / 0.4) - 0.5;
      float sd = length(sf);
      float stud = (1.0 - smoothstep(0.26, 0.3, sd)) * lod;
      float srim = smoothstep(0.17, 0.27, sd) * stud;
      gl_FragColor.rgb *= 1.0 + stud * 0.1 - srim * (0.16 + 0.14 * sf.y * 2.0);
      // seams between the big bricks
      vec2 g = abs(fract(vTW.xz / 3.2 + 0.5) - 0.5);
      gl_FragColor.rgb *= 1.0 - step(0.6, up) * smoothstep(0.488, 0.5, max(g.x, g.y)) * 0.25;
      float rimF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
      gl_FragColor.rgb += rimF * 0.18 * vec3(1.0, 0.94, 0.82);`,
    )
  }
  m.customProgramCacheKey = () => 'flood-terrain'
  return m
}
