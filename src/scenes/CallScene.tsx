import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BlobShadow, Brick, InstancedBricks, Motes, PlasticEnvironment, StaticBricks, Stars, type StaticBrick } from '../three/common'
import { Minifig, NOAH, makePose, type Look } from '../three/Minifig'
import { BH, COLORS, planeGeo } from '../three/bricks'
import { baseplateMaterial, skyMaterial } from '../three/shaders'
import { damp, ramp, resetCamera, useCinematicCamera, type Shot, type V3 } from './cutscene/rig'
import { Glow, GodLight, Grass, HoloBricks, PartingClouds, grassMaterial, makeHoloUniforms, type HoloBrick } from './cutscene/fx'
import { Animal, Dove, OliveTree, arkBlueprint, holoAnimals, houseBricks, tentBricks } from './cutscene/models'

/** Shared with the dialogue overlay: which line is showing. */
export const cutscene = { line: 0, total: 1 }

const H = BH * 4 // hilltop
const NOAH_PRAYING: Look = { ...NOAH, axe: false }
// fog, ground fade and sky horizon share one colour so there is no seam
const NIGHT = '#16224d'
const NIGHT_TOP = '#050a1f'
const DAWN = '#b7708a'
const DAWN_TOP = '#25305e'
const STORM = '#0d1530'

const VILLAGE: V3 = [-20, 0, 24]
const TENTS: V3 = [11, 0, 9]
const ARK_AT: V3 = [0, H + 4.4, 5.2]
const LAYERS = [9, 7, 5, 3]

/** Height of the brick hill (conservative, for the camera floor). */
function ground(x: number, z: number) {
  const d = Math.hypot(x, z)
  for (let i = LAYERS.length - 1; i >= 0; i--) if (d < LAYERS[i] + 0.9) return (i + 1) * BH
  return 0
}

/*
 * Shot list, one entry per dialogue line (Genesis 6:9, 6:13–21, then the
 * narrator). Noah kneels on the hilltop at the origin, facing +z.
 */
const SHOTS: (Shot | Shot[])[] = [
  // 0 · 6:9 establishing: crane down from the stars onto the moonlit hill
  { a: { p: [-6, 24, 40], l: [0, 6, 0], fov: 42 }, b: { p: [5.5, H + 2.2, 8.5], l: [0, H + 1.1, 0], fov: 36 }, dur: 11, blend: 0, shake: 0.02 },
  // 1 · 6:13 God speaks: low angle, tilt up as the light comes down
  [
    { a: { p: [1.5, H + 0.5, 2.7], l: [0, H + 1.1, 0], fov: 40 }, b: { p: [1.2, H + 0.45, 2.3], l: [0, H + 5.5, -0.4], fov: 52 }, dur: 4.5, blend: 0, shake: 0.03 },
    { a: { p: [1.0, H + 1.05, 2.2], l: [0, H + 1.02, 0], fov: 36 }, b: { p: [0.8, H + 1.0, 1.85], l: [0, H + 1.0, 0], fov: 34 }, dur: 8, blend: 0, shake: 0.025 },
  ],
  // 2 · 6:14 the ark: close on Noah's face, then over his shoulder at the blueprint
  [
    { a: { p: [-0.85, H + 0.95, 2.0], l: [0, H + 1.0, 0], fov: 36 }, b: { p: [-0.65, H + 0.92, 1.7], l: [0, H + 1.02, 0], fov: 34 }, dur: 3.5, blend: 0, shake: 0.02 },
    { a: { p: [-1.4, H + 1.6, -3.6], l: [0, H + 2.4, 3], fov: 60 }, b: { p: [-1.0, H + 1.5, -3.2], l: [0, H + 2.6, 4], fov: 62 }, dur: 9, blend: 0, shake: 0.03 },
  ],
  // 3 · 6:15 its measurements: low orbit behind Noah under the growing hull
  { a: { p: [-3, H + 1.5, -2.8], l: [0, H + 2.4, 3.5], fov: 60 }, b: { p: [3, H + 1.6, -3.0], l: [0, H + 2.6, 3.5], fov: 60 }, orbit: [0, H, 0.5], dur: 12, blend: 1.6, shake: 0.03 },
  // 4 · 6:16 roof, door and decks: crane up level with the blueprint
  { a: { p: [8, H + 1.6, -1], l: [0, H + 3.4, 1.5], fov: 56 }, b: { p: [6.5, H + 2.8, -3.0], l: [0, H + 3.0, 2], fov: 58 }, dur: 11, blend: 1.8, shake: 0.03 },
  // 5 · 6:17 the flood: past Noah to the sleeping village while the waters rise
  { a: { p: [2.6, H + 1.35, -1.9], l: [-9, 0.8, 9], fov: 42 }, b: { p: [2.2, H + 1.25, -1.4], l: [-10, 0.7, 10], fov: 37 }, dur: 11, blend: 0, shake: 0.035, roll: 0.04 },
  // 6 · 6:18 the covenant: low push on Noah, then reverse onto his family's tents
  [
    { a: { p: [-1.5, H + 0.5, 3.2], l: [0, H + 1.15, 0], fov: 40 }, b: { p: [-1.0, H + 0.55, 2.4], l: [0, H + 1.3, 0], fov: 36 }, dur: 5, blend: 0, shake: 0.025 },
    { a: { p: [-1.9, H + 1.7, -2.1], l: [8, 0.9, 7.5], fov: 38 }, b: { p: [-1.5, H + 1.5, -1.6], l: [9, 0.9, 8.2], fov: 33 }, dur: 9, blend: 0, shake: 0.03 },
  ],
  // 7 · 6:19–20 every creature: wide orbit and crane up through circling doves
  { a: { p: [7, H + 1.2, 6], l: [0, H + 2.5, 0], fov: 50 }, b: { p: [-6.5, H + 4.5, 7.5], l: [0, H + 3.2, 0], fov: 52 }, orbit: [0, H, 0], dur: 13, blend: 1.6, shake: 0.03 },
  // 8 · 6:21 food: high-angle medium shot as provisions appear around Noah
  { a: { p: [-2.7, H + 2.3, 3.1], l: [0, H + 0.6, 0.6], fov: 42 }, b: { p: [-1.9, H + 1.9, 2.5], l: [0, H + 0.7, 0.4], fov: 40 }, dur: 10, blend: 1.4, shake: 0.025 },
  // 9 · narrator: the light lifts, Noah stands, crane up and away into the dawn
  { a: { p: [2.6, H + 1.4, 4.2], l: [0, H + 1.15, 0], fov: 38 }, b: { p: [13, H + 9, 17], l: [2, H + 0.5, 2], fov: 42 }, dur: 13, blend: 1.4, shake: 0.02 },
]

const FAMILY: { look: Look; p: V3; ry: number }[] = [
  { look: { robe: '#4a7ab8', legs: '#2f4f7a', hood: '#d9c7a5', beard: null }, p: [8.6, 0, 7.4], ry: -2.2 },
  { look: { robe: COLORS.white, legs: COLORS.brown, hood: COLORS.reddishBrown, beard: '#5a3a1e' }, p: [9.6, 0, 6.3], ry: -2.4 },
  { look: { robe: COLORS.orange, legs: COLORS.darkTan, hood: COLORS.black, beard: COLORS.black }, p: [10.8, 0, 6.6], ry: -2.6 },
  { look: { robe: COLORS.green, legs: COLORS.reddishBrown, hood: COLORS.sand, beard: '#a0522d' }, p: [12.4, 0, 7.2], ry: -2.7 },
]

function Hill() {
  // terraced hill of green bricks, wider at the bottom
  const bricks = useMemo(() => {
    const out: { p: V3; c: string }[] = []
    const cols = [COLORS.darkGreen, '#357f33', COLORS.green, '#5aa83f']
    LAYERS.forEach((r, li) => {
      for (let x = -r; x <= r; x += 1.6)
        for (let z = -r; z <= r; z += 1.6) if (Math.hypot(x, z) <= r) out.push({ p: [x, li * BH, z], c: (Math.round(x + z * 3) & 3) === 0 ? cols[(li + 1) % 4] : cols[li] })
    })
    return out
  }, [])
  return <InstancedBricks items={bricks} w={4} d={4} />
}

/** Grass tufts on every terrace and the plain around the hill. */
function useGrassSpots() {
  return useMemo(() => {
    const out: { p: V3; s: number; r: number }[] = []
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    LAYERS.forEach((r, li) => {
      const inner = li < LAYERS.length - 1 ? LAYERS[li + 1] + 1.0 : 0
      const n = li === 3 ? 70 : 90
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2
        const d = inner + rnd() * (r - 0.3 - inner)
        const x = Math.cos(a) * d
        const z = Math.sin(a) * d
        if (li === 3 && Math.hypot(x, z) < 0.9) continue // keep Noah's spot clear
        out.push({ p: [x, (li + 1) * BH + 0.06, z], s: 0.8 + rnd() * 0.7, r: rnd() * 6 })
      }
    })
    for (let i = 0; i < 260; i++) {
      const a = rnd() * Math.PI * 2
      const d = 10.5 + rnd() * 16
      out.push({ p: [Math.cos(a) * d, 0, Math.sin(a) * d], s: 0.9 + rnd() * 0.9, r: rnd() * 6 })
    }
    return out
  }, [])
}

function waterMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uFog: { value: new THREE.Color(STORM) } },
    vertexShader: /* glsl */ `
      varying vec3 vW; varying float vDepth;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uAlpha; uniform vec3 uFog;
      varying vec3 vW; varying float vDepth;
      void main() {
        float w = sin(vW.x * 1.3 + uTime * 1.4) * sin(vW.z * 1.1 - uTime * 1.1);
        vec3 col = mix(vec3(0.05, 0.12, 0.3), vec3(0.25, 0.4, 0.7), 0.5 + 0.5 * w);
        col = mix(col, uFog, smoothstep(15.0, 60.0, vDepth));
        gl_FragColor = vec4(col, uAlpha * (0.75 + 0.15 * w));
        #include <colorspace_fragment>
      }`,
  })
}

// provisions for 6:21: sacks, baskets of fruit and bread around Noah
const FOOD: HoloBrick[] = [
  { w: 2, d: 2, c: '', p: [1.1, H, 0.7], o: 0.05 },
  { w: 1, d: 1, c: '', p: [1.1, H + BH, 0.7], o: 0.12 },
  { w: 2, d: 1, c: '', p: [-1.1, H, 0.9], o: 0.2 },
  { w: 2, d: 2, c: '', p: [-1.3, H, -0.4], o: 0.3 },
  { w: 1, d: 2, c: '', p: [-1.3, H + BH, -0.4], o: 0.38 },
  { w: 2, d: 2, c: '', p: [1.3, H, -0.6], o: 0.46 },
  { w: 1, d: 1, h: 2 / 3, c: '', p: [0.5, H, 1.2], o: 0.55 },
  { w: 1, d: 1, h: 2 / 3, c: '', p: [-0.5, H, 1.25], o: 0.62 },
]

export function CallScene() {
  const { camera, scene } = useThree()
  const pose = useRef(makePose())
  const noah = useRef<THREE.Group>(null)
  const light = useRef(0)
  const clouds = useRef(0)
  const godLight = useRef<THREE.PointLight>(null)
  const yaw = useRef(0)
  const ark = useMemo(() => makeHoloUniforms(), [])
  const vision = useMemo(() => makeHoloUniforms(), [])
  const food = useMemo(() => makeHoloUniforms(), [])
  const arkBricks = useMemo(() => arkBlueprint(ARK_AT, 0.78), [])
  const holoPairs = useMemo(() => {
    const kinds = ['elephant', 'giraffe', 'lion', 'sheep', 'camel', 'cow'] as const
    const list: { kind: (typeof kinds)[number]; p: V3; ry: number; o: number }[] = []
    kinds.forEach((kind, i) => {
      const a = (i / kinds.length) * Math.PI * 2
      for (const side of [-1, 1]) {
        const aa = a + side * 0.17
        list.push({ kind, p: [Math.cos(aa) * 4.3, H + 3.0, Math.sin(aa) * 4.3], ry: -aa - Math.PI / 2, o: i / kinds.length })
      }
    })
    return holoAnimals(list)
  }, [])
  const carousel = useRef<THREE.Group>(null)
  const doves = useRef<THREE.Group>(null)
  const sky = useMemo(() => skyMaterial(NIGHT_TOP, NIGHT, '#c9d6ff', new THREE.Vector3(-0.5, 0.35, -0.8)), [])
  const plate = useMemo(() => baseplateMaterial('#1f4a2a', NIGHT, 25, 75), [])
  const grass = useMemo(() => grassMaterial('#1d4a26', '#4f8f45', NIGHT, 22, 60, 0.75), [])
  const water = useMemo(() => waterMaterial(), [])
  const waterMesh = useRef<THREE.Mesh>(null)
  const grassSpots = useGrassSpots()
  const fogColor = useMemo(() => new THREE.Color(NIGHT), [])
  const village = useMemo(() => {
    const out: StaticBrick[] = []
    const spots: [number, number, number][] = [
      [0, 0, 0],
      [3.2, 0, 1.4],
      [-2.8, 0, 1.8],
      [1.2, 0, 4],
      [-1.6, 0, -2.6],
      [4.4, 0, -2],
      [-4.6, 0, -1.2],
    ]
    spots.forEach(([x, , z], i) => out.push(...houseBricks([VILLAGE[0] + x, 0, VILLAGE[2] + z], (i * 0.7) % 1.6, i % 2 ? COLORS.sand : COLORS.tan, COLORS.darkTan)))
    return out
  }, [])
  const tents = useMemo(
    () => [...tentBricks(TENTS, 'big', COLORS.tan, COLORS.sand), ...tentBricks([TENTS[0] + 4, 0, TENTS[2] - 2.5], 'small', COLORS.sand, COLORS.tan), ...tentBricks([TENTS[0] - 1.5, 0, TENTS[2] - 4.5], 'small', COLORS.tan, COLORS.sand)],
    [],
  )
  const familyPoses = useMemo(() => FAMILY.map(() => ({ current: makePose() })), [])

  useEffect(() => {
    scene.fog = new THREE.Fog(NIGHT, 25, 75)
    scene.background = new THREE.Color(NIGHT)
    return () => {
      scene.fog = null
      scene.background = null
      resetCamera(camera)
    }
  }, [camera, scene])

  const tmpTop = useMemo(() => new THREE.Color(), [])
  const tmpHor = useMemo(() => new THREE.Color(), [])
  const C = useMemo(
    () => ({ night: new THREE.Color(NIGHT), nightTop: new THREE.Color(NIGHT_TOP), dawn: new THREE.Color(DAWN), dawnTop: new THREE.Color(DAWN_TOP), storm: new THREE.Color(STORM) }),
    [],
  )
  const mood = useRef({ dawn: 0, storm: 0, flood: 0, arkP: 0, arkA: 0, vis: 0, food: 0 })

  useCinematicCamera(cutscene, SHOTS, ground, (line, tl, dt, t) => {
    const p = pose.current
    const m = mood.current
    const last = cutscene.total - 1
    const isLast = line >= last && line > 0
    // --- light, sky and mood ---
    const lightTarget = isLast ? 0 : line === 0 ? 0 : line === 1 ? ramp(tl, 0.4, 2.6) : line === 5 ? 0.55 : 1
    light.current = isLast ? damp(light.current, 0, 0.5, dt) : line === 1 && tl < 3 ? lightTarget : damp(light.current, lightTarget, 1.5, dt)
    clouds.current = damp(clouds.current, line >= 1 ? 1 : 0, line >= 1 ? 0.5 : 2, dt)
    m.dawn = damp(m.dawn, isLast ? 1 : 0, 0.25, dt)
    m.storm = damp(m.storm, line === 5 ? 1 : 0, 0.8, dt)
    m.flood = damp(m.flood, line === 5 ? Math.min(1, tl / 6) : 0, line === 5 ? 1.5 : 0.8, dt)
    tmpHor.copy(C.night).lerp(C.storm, m.storm * 0.8).lerp(C.dawn, m.dawn * 0.6)
    tmpTop.copy(C.nightTop).lerp(C.dawnTop, m.dawn * 0.7)
    sky.uniforms.uTop.value.copy(tmpTop)
    sky.uniforms.uHorizon.value.copy(tmpHor)
    fogColor.copy(tmpHor)
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(fogColor)
    if (scene.background instanceof THREE.Color) scene.background.copy(fogColor)
    plate.uniforms.uFog.value.copy(fogColor)
    grass.uniforms.uFog.value.copy(fogColor)
    grass.uniforms.uGlow.value = light.current * 0.3
    grass.uniforms.uWind.value = 1 + m.storm * 1.5 + (line === 1 ? Math.max(0, 1 - Math.abs(tl - 2) / 2) * 1.5 : 0)
    water.uniforms.uTime.value += dt
    water.uniforms.uAlpha.value = m.flood * 0.85
    water.uniforms.uFog.value.copy(fogColor)
    if (waterMesh.current) {
      waterMesh.current.position.y = -0.3 + m.flood * 0.95
      waterMesh.current.visible = m.flood > 0.01
    }
    if (godLight.current) godLight.current.intensity = 10 * light.current * (0.9 + Math.sin(t * 2.2) * 0.1)

    // --- the blueprint ark builds over 6:14–16, then fades ---
    const arkTarget = line === 2 ? 0.05 + ramp(tl, 3.2, 12) * 0.3 : line === 3 ? 0.35 + ramp(tl, 0.5, 9) * 0.35 : line === 4 ? 0.7 + ramp(tl, 0.5, 8) * 0.3 : line > 4 ? 1 : 0
    m.arkP = line < 2 ? 0 : Math.max(m.arkP, damp(m.arkP, arkTarget, 3, dt))
    m.arkA = damp(m.arkA, line >= 2 && line <= 4 ? 1 : 0, line > 4 ? 1.2 : 3, dt)
    ark.uProgress.value = m.arkP
    ark.uOpacity.value = m.arkA
    // --- animal pairs for 6:19–20 ---
    m.vis = damp(m.vis, line === 7 ? 1 : 0, 2, dt)
    vision.uProgress.value = line === 7 ? Math.min(1.05, 0.05 + tl / 6) : vision.uProgress.value
    vision.uOpacity.value = m.vis * 0.7
    if (carousel.current) {
      carousel.current.rotation.y -= dt * 0.12
      carousel.current.visible = m.vis > 0.01
    }
    if (doves.current) doves.current.visible = line >= 7
    // --- provisions for 6:21 ---
    m.food = damp(m.food, line === 8 ? 1 : 0, 2, dt)
    food.uProgress.value = line === 8 ? Math.min(1, 0.05 + tl / 5) : food.uProgress.value
    food.uOpacity.value = m.food

    // --- Noah's acting ---
    let kneel = 1
    let lookUp = 0.55
    let shield = 0
    let arms = 0
    let bow = 0
    let turn = 0
    let yawT = 0
    if (line === 0) {
      kneel = 0
      lookUp = -0.25
      bow = 0.12
    } else if (line === 1) {
      kneel = ramp(tl, 4.2, 4.8)
      lookUp = tl < 0.5 ? -0.25 : 0.6
      shield = tl > 1.3 && tl < 4.3 ? 1 : 0
      bow = tl > 5.5 ? 0.08 : 0
    } else if (line === 2) {
      lookUp = 0.65
    } else if (line === 3) {
      lookUp = 0.75
      turn = Math.sin(tl * 0.45) * 0.3
    } else if (line === 4) {
      lookUp = 0.8
      arms = ramp(tl, 2, 3) * 0.35
    } else if (line === 5) {
      lookUp = -0.35
      bow = 0.25
      turn = -0.5
    } else if (line === 6) {
      lookUp = 0.5
      arms = ramp(tl, 2.2, 3.2) * 0.95
    } else if (line === 7) {
      lookUp = 0.6
      arms = 0.5
      turn = Math.sin(tl * 0.7) * 0.5
    } else if (line === 8) {
      lookUp = 0.1 - Math.max(0, Math.sin(Math.max(0, tl - 1.2) * 4.5)) * 0.32 * (tl < 4.6 ? 1 : 0)
      bow = 0.05
    } else if (isLast) {
      kneel = 1 - ramp(tl, 0.8, 1.4)
      lookUp = tl < 3 ? 0.4 : 0.1
      yawT = tl > 3 ? 0.85 : 0
    }
    p.kneel = damp(p.kneel, kneel, 8, dt)
    p.lookUp = damp(p.lookUp ?? 0, lookUp, line === 8 ? 14 : 5, dt)
    p.shield = damp(p.shield ?? 0, shield, 7, dt)
    p.raiseArms = damp(p.raiseArms, arms, 4, dt)
    p.bow = damp(p.bow ?? 0, bow, 4, dt)
    p.headTurn = damp(p.headTurn ?? 0, turn, 3, dt)
    yaw.current = damp(yaw.current, yawT, 2, dt)
    if (noah.current) noah.current.rotation.y = yaw.current
    // the family waves up the hill when God promises to save them
    familyPoses.forEach((fp, i) => {
      fp.current.wave = damp(fp.current.wave ?? 0, line === 6 && tl > 5.5 + i * 0.3 ? 1 : 0, 4, dt)
    })
  })

  return (
    <>
      <mesh material={sky} renderOrder={-1} frustumCulled={false}>
        <sphereGeometry args={[180, 24, 12]} />
      </mesh>
      <Stars count={500} />
      {/* the moon */}
      <Glow color="#dfe7ff" size={14} position={[-60, 52, -96]} />
      <Glow color="#ffffff" size={4.5} position={[-60, 52, -96]} />
      <PlasticEnvironment intensity={0.35} />
      <hemisphereLight args={['#6e86c9', '#1a2440', 0.7]} />
      <directionalLight position={[-6, 10, -8]} intensity={0.65} color="#a9bcff" />
      <pointLight ref={godLight} position={[0, H + 4.5, 0.4]} color="#ffe2a0" distance={20} decay={1.3} intensity={0} />

      <mesh geometry={planeGeo} material={plate} scale={[170, 1, 170]} position={[0, -0.01, 0]} />
      <Hill />
      <Grass spots={grassSpots} material={grass} />
      <OliveTree position={[-5.2, BH * 2, 3.8]} wind={1.2} />
      <OliveTree position={[6.8, BH, -3.5]} scale={0.8} wind={1.4} />
      <Brick w={2} d={3} h={1} color={COLORS.grey} position={[2.3, H, -1.0]} rotation={[0, 0.4, 0]} />
      <Brick w={1} d={2} h={2 / 3} color={COLORS.darkGrey} position={[1.6, H, -1.9]} rotation={[0, -0.3, 0]} />

      {/* Noah's household below the hill, with a campfire */}
      <StaticBricks bricks={tents} />
      <Brick w={2} d={2} h={1 / 3} color={COLORS.darkGrey} position={[TENTS[0] - 2.4, 0, TENTS[2] + 0.4]} />
      <Brick w={1} d={1} h={2 / 3} color={COLORS.orange} emissive={2} position={[TENTS[0] - 2.4, 0.16, TENTS[2] + 0.4]} />
      <Glow color="#ff9a3c" size={3.2} position={[TENTS[0] - 2.4, 0.7, TENTS[2] + 0.4]} />
      {FAMILY.map((f, i) => (
        <Minifig key={i} pose={familyPoses[i]} look={f.look} position={f.p} rotation={[0, f.ry, 0]} />
      ))}
      <Animal kind="sheep" position={[7.5, 0, 11.5]} rotation={2.2} />
      <Animal kind="sheep" position={[8.6, 0, 12.6]} rotation={2.6} seed={1} />
      <Animal kind="sheep" position={[13.5, 0, 12]} rotation={-2.4} seed={2} />
      <Animal kind="sheep" position={[-6.5, BH, 6]} rotation={0.6} seed={3} />
      <Animal kind="sheep" position={[-7.4, 0, 8.6]} rotation={1.1} seed={4} />

      {/* the distant village, lamps still lit */}
      <StaticBricks bricks={village} />
      {[
        [0, 1.4],
        [3.2, 2.8],
        [-2.8, 3.2],
        [1.2, 5.4],
      ].map(([x, z], i) => (
        <group key={i}>
          <Brick w={1} d={1} h={2 / 3} color="#ffc65a" emissive={1.8} studs={false} position={[VILLAGE[0] + x, 0.35, VILLAGE[2] + z]} />
          <Glow color="#ffb347" size={2.2} position={[VILLAGE[0] + x, 0.7, VILLAGE[2] + z + 0.2]} />
        </group>
      ))}

      <group ref={noah} position={[0, H + 0.08, 0]}>
        <Minifig pose={pose} look={NOAH_PRAYING} />
      </group>
      <BlobShadow size={1.3} position={[0, H + 0.1, 0]} />

      <GodLight position={[0, H, 0]} level={light} />
      <PartingClouds center={[0, H + 15, 0]} part={clouds} count={14} radius={4.5} colors={['#55628f', '#46527f', '#3a456f']} emissive={0.04} />
      <HoloBricks bricks={arkBricks} uniforms={ark} color="#9fdcff" />
      <group ref={carousel}>
        <HoloBricks bricks={holoPairs} uniforms={vision} color="#ffe39a" />
      </group>
      <HoloBricks bricks={FOOD} uniforms={food} color="#ffd27a" />
      <group ref={doves} visible={false}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Dove key={i} center={[0, H, 0]} radius={3.2 + (i % 3) * 1.1} height={4 + (i % 2) * 1.2 + i * 0.3} speed={0.45 + (i % 2) * 0.12} phase={Math.floor(i / 2) * 2.1 + (i % 2) * 0.35} emissive={0.35} />
      ))}
      </group>

      <mesh ref={waterMesh} material={water} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <planeGeometry args={[170, 170]} />
      </mesh>

      {/* fireflies over the grass and dust in the moonlight */}
      <Motes count={70} area={[26, 26]} height={2.5} color="#d9ff8a" size={4} rise={0.05} position={[0, 0.3, 2]} />
      <Motes count={140} area={[40, 40]} height={10} color="#b9c8ff" size={3} rise={0.15} />
    </>
  )
}
