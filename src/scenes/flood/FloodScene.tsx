// Chapter 5 finale: the flood, the dove and the rainbow (Genesis 7–9).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Motes, PlasticEnvironment } from '../../three/common'
import { baseplateMaterial } from '../../three/shaders'
import { brickGeometry, planeGeo } from '../../three/bricks'
import { playMusic, startAmbience, sfxFlood, type Ambience, type MusicTrack } from '../../game/audio'
import { useGame } from '../../store'
import { DOVE_AFTER, FLOOD } from '../../i18n/flood'
import type { Lang } from '../../i18n/strings'
import { ARK_REST, ARK_START, ARK_VIA, FLOOD_TOP, PL, buildTerrain, groundAt } from './layout'
import { END_BEAT, NOT_YET, sim, since } from './sim'
import { pending, resetFlood, story, useFlood, type Phase } from './state'
import { floodSkyMaterial, oceanUniforms, terrainMaterial, wave } from './materials'
import { Ark, type ArkRig } from './Ark'
import { Ocean } from './Ocean'
import { Clouds, FloodSky, Lightning, Rain, SunRays } from './Weather'
import { DeckNoah, Life, OliveTree } from './Life'
import { Dove, FlightClouds, PERCH, TREE_TOP } from './Dove'
import { Confetti, Rainbow } from './Rainbow'

export { FloodOverlay } from './FloodOverlay'

/** Line indexes where the music changes: Genesis 8:1 (God remembers Noah) and 9:13 (the rainbow). */
const MUSIC_CALM_BEAT = 5
const MUSIC_PROMISE_BEAT = 12

export const floodTitle: Record<string, string> = Object.fromEntries(Object.entries(FLOOD).map(([k, v]) => [k, v.title]))

/* ------------------------------------------------------------------ */
/* Beat targets: where every smoothed value is heading on each line.   */
/* ------------------------------------------------------------------ */

type Vals = { level: number; storm: number; rain: number; clear: number; part: number; rays: number; arkT: number; cut: number; door: number; renew: number }
const KEYS = ['level', 'storm', 'rain', 'clear', 'part', 'rays', 'arkT', 'cut', 'door', 'renew'] as const
/** approach rate per second for each value */
const RATE: Vals = { level: 0.6, storm: 0.7, rain: 0.9, clear: 0.35, part: 0.4, rays: 0.8, arkT: 0.32, cut: 1.6, door: 1.6, renew: 0.6 }

const B = (level: number, storm: number, rain: number, clear: number, part: number, rays: number, arkT: number, cut = 0, door = 0, renew = 0): Vals => ({
  level, storm, rain, clear, part, rays, arkT, cut, door, renew,
})
const BEATS: Vals[] = [
  B(-0.8, 0.8, 0.3, 0, 0, 0, 0), // 7:16 the LORD shuts the door
  B(1.0, 1, 1, 0, 0, 0, 0), // 7:11-12 the storm breaks
  B(4.5, 1, 1, 0, 0, 0, 0), // 7:17 the ark lifts
  B(FLOOD_TOP, 1, 0.9, 0, 0, 0, 0.6), // 7:18-19 sailing, mountains covered
  B(FLOOD_TOP, 0.95, 0.75, 0, 0, 0, 0.85, 1), // 7:23b safe inside
  B(11, 0.25, 0, 0, 0.75, 1, 1), // 8:1 God remembered Noah
  B(2.0, 0, 0, 0.15, 1, 0.6, 1), // 8:4 rest on Ararat
  B(1.6, 0, 0, 0.3, 1, 0.25, 1), // 8:8 the dove
  B(0.6, 0, 0, 0.55, 1, 0, 1), // 8:11 the olive leaf
  B(-0.8, 0, 0, 0.7, 1, 0, 1, 0, 1, 1), // 8:16 come out
  B(-0.8, 0, 0, 0.75, 1, 0, 1, 0, 1, 1), // 8:18-19 two by two
  B(-0.8, 0, 0, 0.8, 1, 0, 1, 0, 1, 1), // 8:20 the altar
  B(-0.8, 0, 0, 0.92, 1, 0, 1, 0, 1, 1), // 9:13 the rainbow
  B(-0.8, 0, 0, 1, 1, 0, 1, 0, 1, 1), // 9:15 the promise
  B(-0.8, 0, 0, 1, 1, 0, 1, 0, 1, 1), // the end
]
const DOVE_VALS = B(1.4, 0, 0, 0.45, 1, 0, 1)

function beatFor(phase: Phase, line: number) {
  if (phase === 'end') return END_BEAT
  if (phase === 'dove') return DOVE_AFTER
  return THREE.MathUtils.clamp(line, 0, END_BEAT - 1)
}

/* ------------------------------------------------------------------ */
/* Palettes                                                            */
/* ------------------------------------------------------------------ */

const C = (h: string) => new THREE.Color(h)
const PAL = {
  fog: [C('#3a4456'), C('#e8b98f'), C('#bfdcf3')],
  hemiSky: [C('#7486a6'), C('#ffd6a6'), C('#d4e8ff')],
  hemiGround: [C('#1f2733'), C('#5a4a3a'), C('#5f7f4a')],
  sun: [C('#8a98b8'), C('#ffbf78'), C('#fff3dc')],
  deep: [C('#173450'), C('#1f5b9a'), C('#1d64b0')],
  shallow: [C('#2c5a80'), C('#3f9bd6'), C('#46b0ea')],
  ground: [C('#4a5f3a'), C('#4f8a3c'), C('#47a141')],
}
const tmpA = new THREE.Color()
/** storm / golden dawn / clear day blend into `out` */
function pal(set: THREE.Color[], out: THREE.Color) {
  tmpA.copy(set[1]).lerp(set[2], sim.clear)
  return out.copy(tmpA).lerp(set[0], sim.storm)
}

/* ------------------------------------------------------------------ */
/* Camera shots                                                        */
/* ------------------------------------------------------------------ */

type Shot = { pos: [number, number, number]; look: [number, number, number] }
const SHOTS: Shot[] = [
  { pos: [5.5, 2.6, 10], look: [0.6, 1.4, 0] },
  { pos: [-13, 5, 15], look: [0, 2.5, 0] },
  { pos: [7, 1, 9], look: [0, 2.6, 0] }, // low, y follows the water
  { pos: [0, 7, 17], look: [0, 1.5, 0] }, // orbit
  { pos: [0.3, 3.0, 6.0], look: [0, 2.6, 0] }, // cutaway
  { pos: [-7, 3.2, 11], look: [-1, 4.2, -3] },
  { pos: [12, 5, 17], look: [0, 3, -4] },
  { pos: [6.2, 3.4, 6.4], look: [2.4, 3.0, 0.3] },
  { pos: [4.5, 3.4, 5.6], look: [2.4, 3.4, 0.4] },
  { pos: [5.5, 1.6, 9.5], look: [1.2, 0.9, 1.5] },
  { pos: [-4, 3, 13.5], look: [1, 0.9, 4] },
  { pos: [-1.2, 2.3, 10], look: [-3.8, 0.9, 4.6] },
  { pos: [0, 2.6, 18], look: [0, 8, -16] },
  { pos: [1.5, 2.4, 13.5], look: [0.5, 3.4, 0] },
  { pos: [0, 4, 21], look: [0, 7, -12] },
]
const READY_SHOT: Shot = { pos: [5, 3.8, 5.2], look: [0, 0, 0] }
/** shots that cut instead of gliding (a glide would pass through the ark) */
const CUTS = new Set(['b4', 'b7', 'b9', 'found', 'return'])

const GROUND_COL = new THREE.Color()
/** dev-only: lets the debug handle read renderer stats */
const debug: { gl: THREE.WebGLRenderer | null; scene: THREE.Scene | null } = { gl: null, scene: null }

function Director({ rig, ocean, sky, ground }: { rig: ArkRig; ocean: ReturnType<typeof oceanUniforms>; sky: THREE.ShaderMaterial; ground: THREE.ShaderMaterial }) {
  const { camera, scene, size, gl } = useThree()
  if (import.meta.env.DEV) {
    debug.gl = gl
    debug.scene = scene
  }
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const run = useFlood((s) => s.run)
  const v = useMemo(
    () => ({
      camPos: new THREE.Vector3(14, 8, 26).add(ARK_START),
      camLook: new THREE.Vector3().copy(ARK_START),
      pos: new THREE.Vector3(),
      look: new THREE.Vector3(),
      tmp: new THREE.Vector3(),
      tmp2: new THREE.Vector3(),
      color: new THREE.Color(),
    }),
    [],
  )
  const st = useRef({ shotKey: '', amb: '' as Ambience | '', music: '' as MusicTrack | '', nextBolt: 2, flashT: 9, thunderAt: -1, thunderNear: 0.5, rested: false, doorTarget: 0, rampHit: false, viewX: 0, viewY: 0 })

  // a fresh run (or a debug jump) resets everything
  useEffect(() => {
    st.current.shotKey = ''
    st.current.rested = false
    st.current.amb = ''
  }, [run])

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    return () => cam.clearViewOffset()
  }, [camera])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, sim.maxDt)
    const s = st.current
    sim.t += dt
    const beat = beatFor(story.phase, story.line)
    sim.beat = beat
    const vals = story.phase === 'dove' ? DOVE_VALS : BEATS[beat]

    // beats reached (drives timed events); a snap marks them long done
    const snapping = story.snap
    // a snap (fresh start, skip or debug jump) forgets the old timeline
    if (snapping) sim.reached.fill(NOT_YET)
    for (let b = 0; b <= beat; b++) {
      if (sim.reached[b] === NOT_YET) {
        sim.reached[b] = snapping || b < beat ? sim.t - 1000 : sim.t
        if (!snapping && b === beat) onBeat(b)
      }
    }

    // smoothed values (the flood can't drop below the mesa until the ark is over it)
    for (const k of KEYS) {
      let target = vals[k]
      if (k === 'level' && beat >= 5 && sim.arkT < 0.97) target = Math.max(target, PL + 0.8)
      if (snapping) sim[k] = target
      else sim[k] += (target - sim[k]) * (1 - Math.exp(-dt * RATE[k]))
    }
    if (snapping) {
      story.snap = false
      s.shotKey = ''
      // a fresh start opens on the ark still open on dry land, so the LORD can shut the door
      if (beat === 0) sim.door = 1
    }
    sim.amp = 0.28 + 0.85 * sim.storm

    // lightning: random strikes while the storm rages, the first one right as it breaks
    if (sim.storm > 0.7 && sim.rain > 0.5 && story.phase === 'storyA') {
      s.nextBolt -= dt
      if (s.nextBolt <= 0) {
        s.nextBolt = 3 + Math.random() * 4
        s.flashT = 0
        s.thunderNear = 0.3 + Math.random() * 0.6
        s.thunderAt = sim.t + 0.35 + (1 - s.thunderNear) * 1.2
      }
    }
    s.flashT += dt
    const f = s.flashT
    sim.flash = f < 0.07 ? 1 : f < 0.14 ? 0.25 : f < 0.24 ? 0.85 : Math.max(0, 0.85 * Math.exp(-(f - 0.24) * 7))
    if (s.thunderAt > 0 && sim.t >= s.thunderAt) {
      s.thunderAt = -1
      sfxFlood.thunder(s.thunderNear)
    }

    // ambience follows the weather
    const amb: Ambience = beat === 0 && story.phase === 'storyA' ? 'rain' : beat <= 4 && story.phase === 'storyA' ? 'storm' : 'day'
    if (amb !== s.amb) {
      s.amb = amb
      startAmbience(amb)
    }

    // music follows the story: storm bed while the waters rise, the gentle theme
    // once God remembers Noah (8:1), and the promise theme from the rainbow (9:13) on
    const music: MusicTrack = beat >= MUSIC_PROMISE_BEAT ? 'promise' : beat < MUSIC_CALM_BEAT && story.phase === 'storyA' ? 'storm' : 'call'
    if (music !== s.music) {
      s.music = music
      void playMusic(music)
    }

    // the ark: sails a curve from where it was built to Ararat, riding the waves
    const t = sim.arkT
    const ax = (1 - t) * (1 - t) * ARK_START.x + 2 * (1 - t) * t * ARK_VIA.x + t * t * ARK_REST.x
    const az = (1 - t) * (1 - t) * ARK_START.z + 2 * (1 - t) * t * ARK_VIA.z + t * t * ARK_REST.z
    const floor = groundAt(ax, az)
    const draft = 0.45
    const swell = sim.amp * 0.45
    const bob = wave(ax, az, sim.t) * swell
    const floatY = sim.level - draft + bob
    const rest = THREE.MathUtils.clamp((floor - (sim.level - draft)) / 0.6, 0, 1)
    const ay = Math.max(floor, floatY)
    sim.ark.pos.set(ax, ay, az)
    const sway = 1 - rest
    sim.ark.pitch = (wave(ax + 2.5, az, sim.t) - wave(ax - 2.5, az, sim.t)) * swell * 0.1 * sway
    sim.ark.roll = (wave(ax, az + 1.2, sim.t) - wave(ax, az - 1.2, sim.t)) * swell * 0.12 * sway
    sim.ark.yaw = Math.sin(sim.t * 0.21) * 0.12 * sway
    if (rig.group) {
      rig.group.position.copy(sim.ark.pos)
      rig.group.rotation.set(sim.ark.roll, sim.ark.yaw, -sim.ark.pitch)
    }
    if (!s.rested && beat >= 5 && ay <= floor + 0.001 && floatY < floor) {
      s.rested = true
      if (since(beat) > 0.5) sfxFlood.thud()
    }
    if (rig.ramp) rig.ramp.rotation.x = THREE.MathUtils.lerp(-Math.PI / 2, 0.075, sim.door)
    if (rig.front) rig.front.visible = sim.cut < 0.5
    if (rig.interior) rig.interior.visible = sim.cut > 0.02
    if (rig.lantern) rig.lantern.intensity = 2 + sim.storm * 6 + sim.cut * 4
    if (vals.door !== s.doorTarget) {
      s.doorTarget = vals.door
      s.rampHit = false
      if (!snapping && since(beat) < 1) sfxFlood.creak()
    }
    if (!s.rampHit && Math.abs(sim.door - vals.door) < 0.02) {
      s.rampHit = true
      if (since(beat) > 0.5 && since(beat) < 8) sfxFlood.thud()
    }

    // palettes and lights
    const fog = scene.fog as THREE.Fog
    pal(PAL.fog, fog.color)
    if (scene.background instanceof THREE.Color) scene.background.copy(fog.color)
    fog.near = THREE.MathUtils.lerp(45, 16, sim.storm)
    fog.far = THREE.MathUtils.lerp(170, 75, sim.storm)
    if (hemi.current) {
      pal(PAL.hemiSky, hemi.current.color)
      pal(PAL.hemiGround, hemi.current.groundColor)
      hemi.current.intensity = THREE.MathUtils.lerp(1.0, 0.6, sim.storm) + sim.flash * 2.2
    }
    if (sun.current) {
      pal(PAL.sun, sun.current.color)
      sun.current.intensity = THREE.MathUtils.lerp(1.8, 0.35, sim.storm) + sim.flash * 1.5
    }
    scene.environmentIntensity = THREE.MathUtils.lerp(0.65, 0.3, sim.storm)
    const u = ocean
    pal(PAL.deep, u.uDeep.value)
    pal(PAL.shallow, u.uShallow.value)
    u.uSky.value.copy(fog.color)
    u.uFog.value.copy(fog.color)
    u.uFogNear.value = fog.near
    u.uFogFar.value = fog.far
    u.uSunAmt.value = 1 - sim.storm
    u.uFlash.value = sim.flash
    const su = sky.uniforms
    su.uStorm.value = sim.storm
    su.uClear.value = sim.clear
    su.uPart.value = sim.part
    su.uFlash.value = sim.flash
    su.uTime.value = sim.t
    su.uFog.value.copy(fog.color)
    const gu = ground.uniforms
    gu.uColor.value.copy(PAL.ground[0]).lerp(pal(PAL.ground, GROUND_COL), sim.renew).lerp(PAL.ground[0], sim.storm * 0.5)
    gu.uFog.value.copy(fog.color)
    gu.uFogNear.value = fog.near
    gu.uFogFar.value = fog.far

    // camera
    const A = sim.ark.pos
    let key = `b${beat}`
    let k = 1 - Math.exp(-dt * 1.3)
    if (story.phase === 'dove') {
      key = story.dove.stage
      if (key === 'ready') {
        shotAt(A, READY_SHOT, v.pos, v.look)
        v.look.copy(PERCH)
      } else if (key === 'fly') {
        // chase cam behind the dove
        v.pos.copy(sim.dove.pos).addScaledVector(sim.dove.fwd, -4.4)
        v.pos.y += 1.5
        v.look.copy(sim.dove.pos).addScaledVector(sim.dove.fwd, 4)
        k = 1 - Math.exp(-dt * 4)
      } else if (key === 'found') {
        const a = since(DOVE_AFTER) * 0.25 + 0.6
        v.pos.set(TREE_TOP.x + 2 + Math.sin(a) * 5.5, TREE_TOP.y + 2, TREE_TOP.z + Math.cos(a) * 5.5)
        v.look.copy(TREE_TOP)
      } else {
        v.pos.copy(ARK_REST).add(v.tmp.set(7, 4.2, 8.5))
        v.look.copy(PERCH).add(v.tmp.set(-2.5, 0.5, -2.5))
      }
    } else {
      shotAt(A, SHOTS[beat], v.pos, v.look)
      if (beat === 2) v.pos.y = Math.max(sim.level + 1.1, A.y + 1)
      if (beat === 3) {
        const a = Math.max(0, since(3)) * 0.09 + 0.3
        v.pos.set(A.x + Math.sin(a) * 17, A.y + 7, A.z + Math.cos(a) * 17)
      }
      if (beat === END_BEAT) {
        const a = Math.sin(Math.max(0, since(END_BEAT)) * 0.06) * 0.35
        v.pos.set(A.x + Math.sin(a) * 21, A.y + 4, A.z + 2 + Math.cos(a) * 21)
      }
      // a gentle drift so held shots breathe
      v.pos.x += Math.sin(sim.t * 0.15) * 0.4
    }
    // narrow (portrait) screens step back so the subject still fits
    const aspect = size.width / Math.max(1, size.height)
    const back = THREE.MathUtils.clamp(1 + (1.25 - aspect) * 1.1, 1, 1.9)
    if (back > 1 && key !== 'fly') {
      v.pos.sub(v.look).multiplyScalar(back).add(v.look)
      // on Ararat, stepping back must not drop the lens below the mesa top
      if (beat >= 9) v.pos.y = Math.max(v.pos.y, ARK_REST.y + 1.6)
    }
    if (key !== s.shotKey) {
      if (CUTS.has(key) || s.shotKey === '') k = 1
      s.shotKey = key
    }
    v.camPos.lerp(v.pos, k)
    v.camLook.lerp(v.look, k)
    // keep the lens above the waves
    v.camPos.y = Math.max(v.camPos.y, sim.level + 0.9)
    camera.position.copy(v.camPos)
    camera.lookAt(v.camLook)

    // frame the subject clear of the dialogue box (bottom on portrait, right on landscape phones)
    const cam = camera as THREE.PerspectiveCamera
    const talking = story.phase === 'storyA' || story.phase === 'storyB'
    const wantX = talking && size.height <= 480 && aspect > 1 ? 0.22 : 0
    const wantY = talking && wantX === 0 ? (aspect < 0.9 ? 0.14 : 0.1) : story.phase === 'end' ? (aspect < 0.9 ? 0.12 : -0.04) : 0
    s.viewX += (wantX - s.viewX) * (1 - Math.exp(-dt * 3))
    s.viewY += (wantY - s.viewY) * (1 - Math.exp(-dt * 3))
    if (Math.abs(s.viewX) + Math.abs(s.viewY) > 0.002) cam.setViewOffset(size.width, size.height, size.width * s.viewX, size.height * s.viewY, size.width, size.height)
    else if (cam.view?.enabled) cam.clearViewOffset()
  })

  return (
    <>
      <hemisphereLight ref={hemi} args={['#7486a6', '#1f2733', 0.6]} />
      <directionalLight ref={sun} position={[-8, 14, 9]} intensity={0.4} />
    </>
  )
}

function shotAt(A: THREE.Vector3, shot: Shot, pos: THREE.Vector3, look: THREE.Vector3) {
  pos.set(A.x + shot.pos[0], A.y + shot.pos[1], A.z + shot.pos[2])
  look.set(A.x + shot.look[0], A.y + shot.look[1], A.z + shot.look[2])
}

/** One-shot sounds when a beat starts naturally (not on skips or jumps). */
function onBeat(b: number) {
  if (b === 0) sfxFlood.creak()
  if (b === 1) sfxFlood.thunder(0.8)
  if (b === 5) sfxFlood.dawn()
  if (b === 12) sfxFlood.rainbow()
  if (b === 13) sfxFlood.celebrate()
}

/** Golden sparkles that drift around the family once the promise is spoken. */
function Celebration() {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    if (ref.current) ref.current.visible = since(13) >= 0
  })
  return (
    <group ref={ref} position={[ARK_REST.x, ARK_REST.y, ARK_REST.z + 4]} visible={false}>
      <Motes count={140} area={[16, 10]} height={8} color="#fff1a8" size={7} rise={0.5} />
    </group>
  )
}

/** Terraced mountains: one instanced draw of plain 8x8 boxes with shader-drawn studs. */
function Terrain() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const items = useMemo(() => buildTerrain(), [])
  const mat = useMemo(() => terrainMaterial(), [])
  useEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    items.forEach((it, i) => {
      o.position.set(...it.p)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, c.set(it.c))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [items])
  return <instancedMesh ref={ref} args={[brickGeometry(8, 8, 2, false), mat, items.length]} />
}

export function FloodScene() {
  const rig = useMemo<ArkRig>(() => ({ group: null, ramp: null, front: null, interior: null, lantern: null }), [])
  const ocean = useMemo(() => oceanUniforms(), [])
  const sky = useMemo(() => floodSkyMaterial(), [])
  const ground = useMemo(() => baseplateMaterial('#4a5f3a', '#3a4456', 20, 80), [])
  const confettiAt = useMemo(() => new THREE.Vector3(ARK_REST.x + 0.5, ARK_REST.y, ARK_REST.z + 6), [])
  return (
    <>
      <Director rig={rig} ocean={ocean} sky={sky} ground={ground} />
      <color attach="background" args={['#3a4456']} />
      <fog attach="fog" args={['#3a4456', 16, 75]} />
      <FloodSky material={sky} />
      <PlasticEnvironment intensity={0.4} />
      <mesh geometry={planeGeo} material={ground} scale={[320, 1, 320]} position={[0, -0.01, 0]} />
      <Terrain />
      <OliveTree />
      <Ark rig={rig}>
        <DeckNoah />
      </Ark>
      <Ocean uniforms={ocean} />
      <Clouds />
      <SunRays />
      <Lightning />
      <Life />
      <Dove />
      <FlightClouds />
      <Rainbow />
      <Confetti origin={confettiAt} />
      <Celebration />
      <Rain />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Dev-only debug handle: jump straight into the finale (stripped from  */
/* production builds by the DEV check).                                 */
/* ------------------------------------------------------------------ */
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__flood = {
    /** open the finale at a line (0..13), at the dove (`'dove'`) or at the end card (`'end'`) */
    go(at: number | 'dove' | 'end' = 0, lang?: Lang) {
      const phase: Phase = at === 'dove' ? 'dove' : at === 'end' ? 'end' : at > DOVE_AFTER ? 'storyB' : 'storyA'
      const line = typeof at === 'number' ? at : at === 'dove' ? DOVE_AFTER : END_BEAT
      const g = useGame.getState()
      if (lang) g.setLang(lang)
      if (g.screen === 'flood') resetFlood(phase, line)
      else {
        pending.jump = { phase, line, at: performance.now() }
        g.setScreen('flood')
      }
    },
    story,
    sim,
    state: useFlood,
    /** draw calls and triangles of the last frame */
    scene: () => debug.scene,
    stats: () => ({ calls: debug.gl?.info.render.calls, triangles: debug.gl?.info.render.triangles, points: debug.gl?.info.render.points }),
  }
}
