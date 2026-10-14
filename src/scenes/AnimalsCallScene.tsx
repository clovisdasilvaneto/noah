// Chapter 3 cutscene: God tells Noah to go into the ark with the animals (Genesis 7:1–5).
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BlobShadow, Motes, PlasticEnvironment, StaticBricks, type StaticBrick } from '../three/common'
import { Minifig, NOAH, makePose, type Look } from '../three/Minifig'
import { BH, COLORS, brickGeometry, planeGeo, plastic } from '../three/bricks'
import { baseplateMaterial, skyMaterial } from '../three/shaders'
import { useGame } from '../store'
import { playNarration } from '../game/narration'
import { Dialogue } from '../ui/Dialogue'
import { animalsCallLines, animalsCallTitle } from '../i18n/animalsCall'
import { damp, ramp, resetCamera, useCinematicCamera, type Shot, type V3 } from './cutscene/rig'
import { Glow, GodLight, Grass, HoloBricks, glowMaterial, grassMaterial, makeHoloUniforms } from './cutscene/fx'
import { ARK_TOP, Animal, Ark, Dove, OliveTree, holoAnimals, tentBricks, type AnimalKind } from './cutscene/models'

export { animalsCallTitle }

/** Shared with the dialogue overlay: which line is showing. */
export const animalsCutscene = { line: 0, total: 1 }

const SKY_TOP = '#3d5f9e'
const HORIZON = '#efb276'
const ARK_SCALE = 1.8
const ARK_POS: V3 = [0, BH * 0.34 * ARK_SCALE, -5]
const N: V3 = [3.6, 0, 2.6] // Noah's spot by the ramp
const STORM_X = -78

/** Camera floor: flat plain, and keep well clear of the ark. */
function ground(x: number, z: number) {
  if (Math.abs(x) < 12.5 && z > -9.5 && z < -0.8) return ARK_TOP * ARK_SCALE + 1
  return 0
}

const NOAH_LOOK: Look = { ...NOAH, axe: false }
const FAMILY: { look: Look; p: V3; ry: number }[] = [
  { look: { robe: '#4a7ab8', legs: '#2f4f7a', hood: '#d9c7a5', beard: null }, p: [0.6, 0, 3.6], ry: 0.5 },
  { look: { robe: COLORS.white, legs: COLORS.brown, hood: COLORS.reddishBrown, beard: '#5a3a1e' }, p: [-0.8, 0, 2.6], ry: 0.7 },
  { look: { robe: COLORS.orange, legs: COLORS.darkTan, hood: COLORS.black, beard: COLORS.black }, p: [-2.2, 0, 3.4], ry: 0.6 },
  { look: { robe: COLORS.green, legs: COLORS.reddishBrown, hood: COLORS.sand, beard: '#a0522d' }, p: [-3.4, 0, 2.2], ry: 0.9 },
]

// boarding path: ramp foot, up the ramp to the door, then inside
const RAMP_FOOT: V3 = [1.45, 0, 2.4]
const DOOR_SILL: V3 = [1.45, 1.15, -2.0]
const INSIDE: V3 = [1.45, 1.15, -3.6]
function boardingPath(start: V3, d: number, out: THREE.Vector3) {
  const pts = [start, RAMP_FOOT, DOOR_SILL, INSIDE]
  let rest = d
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k]
    const b = pts[k + 1]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    if (rest <= len) {
      const u = rest / len
      out.set(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u)
      return { p: out, moving: d > 0, inside: false, heading: Math.atan2(b[0] - a[0], b[2] - a[2]) }
    }
    rest -= len
  }
  out.set(...INSIDE)
  return { p: out, moving: false, inside: true, heading: Math.PI }
}

const n = (x: number, y: number, z: number): V3 => [N[0] + x, N[1] + y, N[2] + z]

/*
 * Shot list, one entry per line: narrator, Genesis 7:1, 7:2–3, 7:4, 7:5, narrator.
 * Noah stands at N facing +z, the ark behind him, the storm far to the west (−x).
 */
const SHOTS: (Shot | Shot[])[] = [
  // 0 · establishing: crane down over the finished ark, storm on the horizon
  { a: { p: [-30, 20, 34], l: [-4, 3, -6], fov: 46 }, b: { p: n(5.5, 2.2, 10), l: n(-2.5, 2.0, -4), fov: 42 }, dur: 12, blend: 0, shake: 0.02 },
  // 1 · 7:1 "Go into the ark": low angle tilting up into the light, then a medium on Noah with his family
  [
    { a: { p: n(1.1, 0.45, 2.7), l: n(0, 1.1, 0), fov: 42 }, b: { p: n(0.9, 0.4, 2.3), l: n(0, 3.6, -0.6), fov: 54 }, dur: 4.5, blend: 0, shake: 0.03 },
    { a: { p: n(2.2, 1.35, 4.4), l: n(-0.8, 1.0, 0), fov: 42 }, b: { p: n(1.8, 1.3, 3.7), l: n(-0.7, 1.05, 0), fov: 38 }, dur: 9, blend: 0, shake: 0.025 },
  ],
  // 2 · 7:2–3 every clean and unclean animal, the birds: wide orbit through the vision
  { a: { p: n(-7, 1.2, 6.5), l: n(0, 2.6, 0), fov: 52 }, b: { p: n(7, 3.2, 6.5), l: n(0, 3.2, 0), fov: 54 }, orbit: N, dur: 15, blend: 1.4, shake: 0.03 },
  // 3 · 7:4 seven days, then rain: past Noah to the storm, long-lens push
  { a: { p: n(3.45, 1.75, -0.1), l: [-36, 5, 9], fov: 42 }, b: { p: n(2.9, 1.65, -0.15), l: [-38, 6, 9], fov: 36 }, dur: 12, blend: 0, shake: 0.035, roll: -0.03 },
  // 4 · 7:5 Noah obeys: close on his face, then pull back and crane over the family boarding
  [
    { a: { p: n(0.7, 1.32, 2.1), l: n(0, 1.25, 0), fov: 36 }, b: { p: n(0.55, 1.3, 1.8), l: n(0, 1.27, 0), fov: 34 }, dur: 3.5, blend: 0, shake: 0.02 },
    { a: { p: n(3, 2, 6), l: n(-2.5, 1.6, -3), fov: 44 }, b: { p: n(6.5, 4.8, 12), l: n(-3.5, 2.2, -4), fov: 46 }, dur: 10, blend: 0, shake: 0.025 },
  ],
  // 5 · teaser: over Noah's shoulder, the animals come over the horizon
  // raised and pulled back so the sight line clears his head: Noah sits low in frame, the horizon stays open
  { a: { p: n(-1.4, 2.5, -3.4), l: [14, 1.0, 40], fov: 40 }, b: { p: n(-1.7, 2.6, -4.0), l: [16, 1.0, 44], fov: 36 }, dur: 14, blend: 1.2, shake: 0.025 },
]

/** Pairs walking towards the ark from the horizon. */
const PROCESSION: { kind: AnimalKind; start: V3; speed: number }[] = (() => {
  const kinds: AnimalKind[] = ['elephant', 'giraffe', 'lion', 'camel', 'sheep', 'cow', 'elephant', 'giraffe', 'sheep']
  const out: { kind: AnimalKind; start: V3; speed: number }[] = []
  kinds.forEach((kind, i) => {
    const x = 4 + (i - 4) * 4.5 + Math.sin(i * 3.1) * 1.5
    const z = 44 + (i % 3) * 5
    out.push({ kind, start: [x, 0, z], speed: 1.1 + (i % 3) * 0.15 })
    out.push({ kind, start: [x + 1.6, 0, z + 1.4], speed: 1.1 + (i % 3) * 0.15 })
  })
  return out
})()
const ARK_DOOR_WORLD = new THREE.Vector3(1.5, 0, 3)

function Procession({ show }: { show: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null)
  const refs = useRef<(THREE.Group | null)[]>([])
  const t0 = useRef(-1)
  const dir = useMemo(() => PROCESSION.map((a) => new THREE.Vector3().subVectors(ARK_DOOR_WORLD, new THREE.Vector3(...a.start)).setY(0).normalize()), [])
  useFrame((state) => {
    const on = show.current > 0
    if (group.current) group.current.visible = on
    if (!on) {
      t0.current = -1
      return
    }
    if (t0.current < 0) t0.current = state.clock.elapsedTime
    const tl = state.clock.elapsedTime - t0.current
    PROCESSION.forEach((a, i) => {
      const g = refs.current[i]
      if (!g) return
      const d = Math.min(tl * a.speed, 26)
      g.position.set(a.start[0] + dir[i].x * d, 0, a.start[2] + dir[i].z * d)
      g.rotation.y = Math.atan2(-dir[i].z, dir[i].x)
    })
  })
  return (
    <group ref={group} visible={false}>
      {PROCESSION.map((a, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} position={a.start}>
          <Animal kind={a.kind} walk={1} seed={i} />
        </group>
      ))}
      {/* dust kicked up by the herd */}
      <Motes count={60} area={[40, 14]} height={2} color="#f3d2a0" size={10} rise={0.25} position={[4, 0, 40]} />
    </group>
  )
}

/** Soft streaky rain hanging under the storm clouds. */
function rainCurtainMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uAlpha: { value: 0.3 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying float vFres;
      void main() {
        vUv = uv;
        vec3 n = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFres = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uAlpha, uTime; varying vec2 vUv; varying float vFres;
      void main() {
        float streak = 0.6 + 0.4 * sin(vUv.x * 160.0 + vUv.y * 6.0 + uTime * 9.0);
        float a = uAlpha * streak * smoothstep(0.0, 0.12, vUv.y) * pow(vFres, 1.5) * (1.0 - smoothstep(0.75, 1.0, vUv.y));
        gl_FragColor = vec4(vec3(0.33, 0.37, 0.47), a);
      }`,
  })
}

/** Dark storm bank far to the west with rain curtains and lightning. */
function Storm({ level }: { level: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null)
  const flashMat = useMemo(() => glowMaterial('#dfe8ff', 0), [])
  const rainMat = useMemo(() => rainCurtainMaterial(), [])
  const next = useRef(2)
  const flash = useRef(0)
  const clouds = useMemo(() => {
    const out: { w: number; d: number; h: number; p: V3; c: string }[] = []
    const cols = ['#454b60', '#383d50', '#50566c', '#2e3242']
    for (let i = 0; i < 40; i++) {
      const z = -60 + (i / 40) * 120 + Math.sin(i * 2.7) * 4
      const x = Math.sin(i * 1.7) * 10
      const y = 13 + Math.sin(i * 0.9) * 2
      out.push({ w: 6 + (i % 3) * 2, d: 6 + (i % 2) * 2, h: 1, p: [x, y, z], c: cols[i % 4] })
      out.push({ w: 4 + (i % 2) * 2, d: 4, h: 1, p: [x + 1.5, y + 1.4, z + 1], c: cols[(i + 1) % 4] })
      if (i % 3 === 0) out.push({ w: 3, d: 3, h: 1, p: [x - 1, y + 2.8, z - 0.5], c: cols[(i + 2) % 4] })
    }
    return out
  }, [])
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const L = level.current
    if (group.current) group.current.position.x = STORM_X + L * 14
    if (L > 0.4 && t > next.current) {
      flash.current = 1
      next.current = t + 1.6 + Math.random() * 3
    }
    flash.current = Math.max(0, flash.current - dt * 5)
    const f = flash.current * (0.6 + 0.4 * Math.sin(t * 60))
    flashMat.opacity = f
    rainMat.uniforms.uAlpha.value = 0.25 + L * 0.3
    rainMat.uniforms.uTime.value = t
  })
  return (
    <group ref={group} position={[STORM_X, 0, 0]}>
      {clouds.map((c, i) => (
        <mesh key={i} geometry={brickGeometry(c.w, c.d, c.h, true)} material={plastic(c.c)} position={c.p} scale={[3, 3, 3]} />
      ))}
      {[-40, -12, 18, 42].map((z, i) => (
        <mesh key={i} material={rainMat} position={[i * 3, 6.5, z]}>
          <cylinderGeometry args={[10, 13, 13, 16, 1, true]} />
        </mesh>
      ))}
      <sprite material={flashMat} position={[6, 16, -10]} scale={[60, 60, 1]} />
      <Motes count={160} area={[24, 100]} height={16} color="#aab8d8" size={5} rise={-9} position={[4, 0, -10]} />
    </group>
  )
}

/** Seven golden lights over the horizon: seven days. */
function SevenDays({ count }: { count: React.MutableRefObject<number> }) {
  const refs = useRef<(THREE.Sprite | null)[]>([])
  const mats = useMemo(() => Array.from({ length: 7 }, () => glowMaterial('#ffd36b', 0)), [])
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    mats.forEach((m, i) => {
      const on = count.current > i ? 1 : 0
      m.opacity = damp(m.opacity, on * (0.85 + Math.sin(t * 3 + i) * 0.15), 5, dt)
      const s = refs.current[i]
      if (s) s.scale.setScalar(2.2 + m.opacity * 1.6)
    })
  })
  return (
    <group position={[-26, 0, 8]}>
      {mats.map((m, i) => {
        const a = ((i - 3) / 3) * 0.75
        return <sprite key={i} ref={(el) => (refs.current[i] = el)} material={m} position={[Math.sin(a) * 2, 7.5 + Math.cos(a) * 3, Math.sin(a) * 14]} />
      })}
    </group>
  )
}

export function AnimalsCallScene() {
  const { camera, scene } = useThree()
  const pose = useRef(makePose())
  const noah = useRef<THREE.Group>(null)
  const light = useRef(0)
  const storm = useRef(0)
  const days = useRef(0)
  const herd = useRef(0)
  const yaw = useRef(Math.PI)
  const familyPoses = useMemo(() => FAMILY.map(() => ({ current: makePose() })), [])
  const familyRefs = useRef<(THREE.Group | null)[]>([])
  const board = useRef(0)
  const tmpV = useMemo(() => new THREE.Vector3(), [])
  const vision = useMemo(() => makeHoloUniforms(), [])
  const visionGroup = useRef<THREE.Group>(null)
  const doves = useRef<THREE.Group>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const holoPairs = useMemo(() => {
    // seven pairs: clean animals first, then the unclean
    const kinds: AnimalKind[] = ['sheep', 'cow', 'sheep', 'cow', 'sheep', 'camel', 'lion']
    const list: { kind: AnimalKind; p: V3; ry: number; o: number }[] = []
    kinds.forEach((kind, i) => {
      const a = (i / kinds.length) * Math.PI * 2
      for (const side of [-1, 1]) {
        const aa = a + side * 0.12
        list.push({ kind, p: [Math.cos(aa) * 5.4, 2.6, Math.sin(aa) * 5.4], ry: -aa - Math.PI / 2, o: i / kinds.length })
      }
    })
    return holoAnimals(list)
  }, [])
  const sky = useMemo(() => skyMaterial(SKY_TOP, HORIZON, '#ffd28a', new THREE.Vector3(0.85, 0.1, 0.35)), [])
  const plate = useMemo(() => baseplateMaterial('#6c9a3a', HORIZON, 40, 150), [])
  const grass = useMemo(() => grassMaterial('#3f6d26', '#a8c55a', HORIZON, 30, 120, 1.05), [])
  const grassSpots = useMemo(() => {
    const out: { p: V3; s: number; r: number }[] = []
    let seed = 11
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 520; i++) {
      const x = (rnd() - 0.5) * 60
      const z = -14 + rnd() * 50
      if (Math.abs(x) < 12.5 && z > -9 && z < -1) continue
      if (Math.hypot(x - N[0], z - N[2]) < 1) continue
      out.push({ p: [x, 0, z], s: 0.9 + rnd() * 0.9, r: rnd() * 6 })
    }
    return out
  }, [])
  const camp = useMemo<StaticBrick[]>(
    () => [
      ...tentBricks([-15, 0, 5], 'big', COLORS.tan, COLORS.sand),
      ...tentBricks([-19, 0, 2], 'small', COLORS.sand, COLORS.tan),
      // sacks of food and crates by the ramp
      { w: 2, d: 2, c: COLORS.darkTan, p: [-1.4, 0, 0.9] },
      { w: 2, d: 2, c: COLORS.sand, p: [-1.4, BH, 0.9] },
      { w: 2, d: 3, c: COLORS.brown, p: [5.6, 0, 0.6] },
      { w: 1, d: 2, c: COLORS.sand, p: [5.6, BH, 0.6] },
      { w: 2, d: 2, c: COLORS.gopher, p: [-4.2, 0, 0.8] },
    ],
    [],
  )

  useEffect(() => {
    scene.fog = new THREE.Fog(HORIZON, 40, 170)
    scene.background = new THREE.Color(HORIZON)
    return () => {
      scene.fog = null
      scene.background = null
      resetCamera(camera)
    }
  }, [camera, scene])

  useCinematicCamera(animalsCutscene, SHOTS, ground, (line, tl, dt) => {
    const p = pose.current
    const last = animalsCutscene.total - 1
    const isLast = line >= last && line > 0
    // light from heaven: comes down on 7:1, lifts after 7:5
    const lightT = line === 1 ? ramp(tl, 0.3, 2.4) : line >= 2 && line <= 3 ? 1 : 0
    light.current = line === 1 && tl < 2.6 ? Math.max(light.current, lightT) : damp(light.current, lightT, line >= 4 ? 0.8 : 1.5, dt)
    storm.current = damp(storm.current, line >= 3 ? 1 : 0.25, 0.6, dt)
    days.current = line === 3 ? Math.floor(ramp(tl, 0.6, 5.6) * 7.99) : line > 3 ? 7 : 0
    herd.current = isLast ? 1 : 0
    grass.uniforms.uGlowPos.value.set(N[0], 0, N[2])
    grass.uniforms.uGlow.value = light.current * 0.25
    grass.uniforms.uWind.value = 1 + storm.current * 1.2
    // the sun dims a little as the storm comes
    if (sun.current) sun.current.intensity = 1.7 - storm.current * 0.5
    if (hemi.current) hemi.current.intensity = 0.85 - storm.current * 0.15

    // vision of the pairs (7:2–3)
    vision.uProgress.value = line === 2 ? Math.min(1.05, 0.05 + tl / 7) : vision.uProgress.value
    vision.uOpacity.value = damp(vision.uOpacity.value, line === 2 ? 0.75 : 0, 2, dt)
    if (visionGroup.current) {
      visionGroup.current.rotation.y -= dt * 0.1
      visionGroup.current.visible = vision.uOpacity.value > 0.01
    }
    if (doves.current) doves.current.visible = line >= 2

    // Noah's acting
    let yawT = 0
    let lookUp = 0.1
    let shield = 0
    let arms = 0
    let turn = 0
    let bow = 0
    p.building = false
    if (line === 0) {
      // finishing the last bricks on the hull
      yawT = Math.PI
      p.building = tl > 1.5
      lookUp = 0.2
    } else if (line === 1) {
      yawT = tl < 0.6 ? Math.PI : 0
      lookUp = tl < 1 ? 0 : 0.65
      shield = tl > 1.4 && tl < 4 ? 1 : 0
      bow = tl > 6 ? 0.1 : 0
    } else if (line === 2) {
      lookUp = 0.55
      turn = Math.sin(tl * 0.5) * 0.55
      arms = ramp(tl, 3, 4) * 0.45
    } else if (line === 3) {
      yawT = -1.41
      lookUp = 0.15
      turn = -0.35
    } else if (line === 4) {
      yawT = tl < 3.5 ? 0 : 0.5
      lookUp = 0.1 - Math.max(0, Math.sin(Math.max(0, tl - 0.8) * 4.5)) * 0.32 * (tl < 3.3 ? 1 : 0)
      arms = 0
      bow = tl < 3.4 ? 0.05 : 0
    } else if (isLast) {
      yawT = 0.35
      lookUp = 0.05
      arms = ramp(tl, 2, 3) * 0.5
    }
    p.lookUp = damp(p.lookUp ?? 0, lookUp, line === 4 ? 14 : 5, dt)
    p.shield = damp(p.shield ?? 0, shield, 7, dt)
    p.raiseArms = damp(p.raiseArms, arms, 4, dt)
    p.bow = damp(p.bow ?? 0, bow, 4, dt)
    p.headTurn = damp(p.headTurn ?? 0, turn, 3, dt)
    yaw.current = damp(yaw.current, yawT, 3, dt)
    if (noah.current) noah.current.rotation.y = yaw.current

    // the family turns to the light, then waves and starts boarding
    board.current = line >= 4 ? board.current + dt : 0
    familyPoses.forEach((fp, i) => {
      const f = familyRefs.current[i]
      const lookAtNoah = Math.atan2(N[0] - FAMILY[i].p[0], N[2] - FAMILY[i].p[2])
      const target = line === 0 ? FAMILY[i].ry : line >= 4 ? lookAtNoah : lookAtNoah - 0.2
      if (f) {
        // after 7:5 they walk to the ramp, up into the ark, and disappear inside
        const d = Math.max(0, board.current - 3.2 - i * 1.4) * 1.5
        const pos = boardingPath(FAMILY[i].p, d, tmpV)
        f.position.copy(pos.p)
        f.visible = !pos.inside
        fp.current.speed = pos.moving ? 0.6 : 0
        f.rotation.y = pos.moving ? pos.heading : damp(f.rotation.y, target, 2.5, dt)
      }
      fp.current.wave = damp(fp.current.wave ?? 0, line === 4 && tl > 1 && tl < 4 + i * 0.2 ? 1 : 0, 4, dt)
      fp.current.lookUp = damp(fp.current.lookUp ?? 0, line >= 1 && line <= 3 ? 0.45 : 0, 3, dt)
    })
  })

  return (
    <>
      <mesh material={sky} renderOrder={-1} frustumCulled={false}>
        <sphereGeometry args={[180, 24, 12]} />
      </mesh>
      {/* the low sun */}
      <Glow color="#ffd9a0" size={40} position={[150, 22, 62]} />
      <Glow color="#fff4dc" size={12} position={[150, 22, 62]} />
      <PlasticEnvironment intensity={0.55} />
      <hemisphereLight ref={hemi} args={['#ffe1b8', '#4d5a3a', 0.85]} />
      <directionalLight ref={sun} position={[30, 12, 14]} intensity={1.7} color="#ffcf96" />
      <directionalLight position={[-20, 10, -10]} intensity={0.35} color="#8fa6d8" />

      <mesh geometry={planeGeo} material={plate} scale={[340, 1, 340]} position={[0, -0.01, 0]} />
      <Grass spots={grassSpots} material={grass} />
      <Ark position={ARK_POS} scale={ARK_SCALE} />
      <StaticBricks bricks={camp} />
      <OliveTree position={[9.5, 0, -3]} scale={1.2} />
      <OliveTree position={[-15, 0, -6]} scale={1.1} />
      <OliveTree position={[13, 0, 9]} scale={0.9} />
      <OliveTree position={[-9, 0, 12]} />

      <group ref={noah} position={N} rotation={[0, Math.PI, 0]}>
        <Minifig pose={pose} look={NOAH_LOOK} />
      </group>
      <BlobShadow size={1.3} position={[N[0], 0.03, N[2]]} />
      {FAMILY.map((f, i) => (
        <group key={i} ref={(el) => (familyRefs.current[i] = el)} position={f.p} rotation={[0, f.ry, 0]}>
          <Minifig pose={familyPoses[i]} look={f.look} />
        </group>
      ))}

      <GodLight position={N} level={light} warm="#fff0c0" gain={1.3} />
      <group ref={visionGroup} position={N}>
        <HoloBricks bricks={holoPairs} uniforms={vision} color="#ffe6a0" />
      </group>
      <group ref={doves} visible={false}>
        {Array.from({ length: 8 }, (_, i) => (
          <Dove key={i} center={N} radius={3 + (i % 4) * 1.2} height={4.5 + (i % 3) * 0.9} speed={0.5 + (i % 2) * 0.1} phase={Math.floor(i / 2) * 1.6 + (i % 2) * 0.3} emissive={0.2} />
        ))}
      </group>

      <Storm level={storm} />
      <SevenDays count={days} />
      <Procession show={herd} />
      <Motes count={90} area={[40, 40]} height={6} color="#ffe2a6" size={4} rise={0.12} />
    </>
  )
}

export function AnimalsCallOverlay() {
  const setScreen = useGame((s) => s.setScreen)
  const lang = useGame((s) => s.lang) ?? 'en'
  const lines = animalsCallLines[lang]
  useEffect(() => {
    animalsCutscene.line = 0
    animalsCutscene.total = lines.length
  }, [lines])
  const onLine = useCallback(
    (i: number) => {
      animalsCutscene.line = i
      void playNarration(lang, `animals-call-${i}`)
    },
    [lang],
  )
  const onDone = useCallback(() => setScreen('chapterAnimals'), [setScreen])
  return <Dialogue lines={lines} onLine={onLine} onDone={onDone} letterbox />
}
