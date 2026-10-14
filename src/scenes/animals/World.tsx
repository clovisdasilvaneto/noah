// Scenery for chapter 4 (instanced forest, hills, paths) and the storm that
// rolls in as the animals board: the sky, fog and light darken with progress
// and brick clouds drift in from the north. Lightning flickers at the end.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { InstancedBricks, PlasticEnvironment } from '../../three/common'
import { BH, COLORS, brickGeometry, planeGeo, plastic } from '../../three/bricks'
import { baseplateMaterial, skyMaterial } from '../../three/shaders'
import { SURFACE_CELL, cellKey, colliders, newId, player, surface } from '../../game/world'
import { useAnimals } from './state'
import { closing } from './Ark'
import {
  APPROACH,
  ARK,
  BELL,
  BRIDGE_PILE,
  CLEARING,
  DOVE_TREE,
  EXIT,
  GRASS,
  HILL,
  HULL_HALF_L,
  HULL_HALF_W,
  LOG,
  PEN,
  POND,
  SHEEP_HOMES,
  START,
  STREAM_X,
  STREAM_Z,
  distToPath,
  seeded,
  type V2,
  type V3,
} from './layout'

/* ------------------------------------------------------------------ */
/* Floor plates (paths, sandy ark yard): one per grid cell, raise the   */
/* ground for Noah, the family and the animals.                         */
/* ------------------------------------------------------------------ */

type FloorCell = { ix: number; iz: number; c: string }
const FLOOR_TOP = BH / 3

const PATHS: V2[][] = [
  [
    [3.2, -8],
    [3, 6],
    [0, 11.5],
  ],
  [
    [3, -2],
    [-8, -2.5],
    [-13.6, 1],
  ],
  [
    [3, -1],
    [10, -0.5],
    [14.6, 0.2],
  ],
  [
    [3, 6],
    [10, 9.5],
    [PEN.gateX, PEN.z - PEN.hd - 0.8],
  ],
  [
    [1, -9],
    [-7, -10.5],
    [-12.4, -11.6],
  ],
  [
    [6, -9],
    [12, -10.4],
    [LOG.x - 1.2, LOG.z + 0.6],
  ],
]

function layoutFloor(): FloorCell[] {
  const cells = new Map<string, FloorCell>()
  const C = SURFACE_CELL
  // sandy yard in front of the ark
  for (let ix = Math.round(-7 / C); ix <= Math.round(11 / C); ix++) {
    for (let iz = Math.round(-12.4 / C); iz <= Math.round(-7.4 / C); iz++) {
      cells.set(cellKey(ix, iz), { ix, iz, c: (ix * 7 + iz * 3) % 4 === 0 ? '#e2c98c' : COLORS.sand })
    }
  }
  for (const pts of PATHS) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i]
      const [bx, bz] = pts[i + 1]
      const n = Math.ceil(Math.hypot(bx - ax, bz - az) / (C * 0.25))
      for (let k = 0; k <= n; k++) {
        const ix = Math.round((ax + ((bx - ax) * k) / n) / C)
        const iz = Math.round((az + ((bz - az) * k) / n) / C)
        const key = cellKey(ix, iz)
        if (!cells.has(key)) cells.set(key, { ix, iz, c: (ix + iz) % 5 === 0 ? COLORS.darkTan : COLORS.tan })
      }
    }
  }
  return [...cells.values()]
}
const FLOOR = layoutFloor()

/* ------------------------------------------------------------------ */
/* Trees: decorative forest kept clear of every play area and route.    */
/* ------------------------------------------------------------------ */

type TreeSpot = { x: number; z: number; h: number; ry: number; dark: boolean; lime: boolean; solid: boolean }

function clearOfPlay(x: number, z: number) {
  const routes: V2[][] = [...Object.values(EXIT).filter((r) => r.length), ...PATHS]
  if (Math.abs(x - ARK.x) < HULL_HALF_L + 3 && z > ARK.z - HULL_HALF_W - 3 && z < APPROACH[1] + 3) return false
  if (Math.abs(x - HILL.x) < 6.5 && Math.abs(z - HILL.z) < 6.5) return false
  if (Math.abs(x - PEN.x) < PEN.hw + 2 && Math.abs(z - PEN.z) < PEN.hd + 2) return false
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 3.5) return false
  if (GRASS.some(([gx, gz]) => Math.hypot(gx - x, gz - z) < 2.4)) return false
  if (Math.hypot(x - CLEARING.x, z - CLEARING.z) < CLEARING.r + 2.2) return false
  if (Math.abs(x - STREAM_X) < 2.5 && z > STREAM_Z[0] - 2 && z < STREAM_Z[1] + 2) return false
  if (x > STREAM_X && z > STREAM_Z[0] - 1 && z < STREAM_Z[1] + 1) return false // zebra meadow stays open
  if (Math.hypot(x - DOVE_TREE.x, z - DOVE_TREE.z) < 4.5 || Math.hypot(x - BELL.x, z - BELL.z) < 3) return false
  if (Math.hypot(x - BRIDGE_PILE[0], z - BRIDGE_PILE[1]) < 2.5) return false
  if (SHEEP_HOMES.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 3)) return false
  if (Math.hypot(x - START[0], z - START[2]) < 4) return false
  if (routes.some((r) => distToPath(x, z, r) < 2.2)) return false
  return true
}

function layoutTrees(): TreeSpot[] {
  const rnd = seeded(23)
  const out: TreeSpot[] = []
  const tryAdd = (x: number, z: number, solid: boolean) => {
    if ((!clearOfPlay(x, z) || out.some((t) => Math.hypot(t.x - x, t.z - z) < 2.1))) return
    out.push({ x, z, h: 2 + Math.floor(rnd() * 3), ry: Math.floor(rnd() * 4) * (Math.PI / 4), dark: rnd() > 0.5, lime: rnd() > 0.6, solid })
  }
  // groves between the play areas
  for (let i = 0; i < 160; i++) tryAdd(-26 + rnd() * 52, -23 + rnd() * 46, true)
  // a ring round the edge of the map
  for (let i = 0; i < 46; i++) {
    const a = rnd() * Math.PI * 2
    const r = 30 + rnd() * 6
    tryAdd(Math.cos(a) * r, Math.sin(a) * r * 0.9, false)
  }
  return out
}
const TREES = layoutTrees()

/** The elephant clearing: a ring of hedges with a gap facing the ark (the log fills it). */
const HEDGES: V2[] = (() => {
  const out: V2[] = []
  const n = 24
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 0.4) continue
    out.push([CLEARING.x + Math.cos(a) * CLEARING.r, CLEARING.z + Math.sin(a) * CLEARING.r])
  }
  return out
})()

/** Boulders closing the zebra meadow to the north and south. */
const BOULDERS: V2[] = (() => {
  const out: V2[] = []
  for (let x = STREAM_X; x <= 27.5; x += 1.15) {
    out.push([x, STREAM_Z[0] - 0.2], [x, STREAM_Z[1] + 0.2])
  }
  return out
})()

function Scenery() {
  const { trunks, canopyL, canopyM, canopyS, hills, floor, rocks, rockTops, flowers, hedgeL, hedgeS } = useMemo(() => {
    const rnd = seeded(5)
    const trunks: { p: V3; c: string }[] = []
    const canopyL: { p: V3; c: string; ry: number }[] = []
    const canopyM: { p: V3; c: string; ry: number }[] = []
    const canopyS: { p: V3; c: string; ry: number }[] = []
    for (const { x, z, h, ry, dark, lime } of TREES) {
      for (let k = 0; k < h; k++) trunks.push({ p: [x, k * BH, z], c: k % 2 ? COLORS.brown : COLORS.reddishBrown })
      canopyL.push({ p: [x, h * BH, z], c: dark ? COLORS.darkGreen : '#2f7d33', ry })
      canopyM.push({ p: [x, (h + 1) * BH, z], c: COLORS.green, ry: ry + 0.4 })
      canopyS.push({ p: [x, (h + 2) * BH, z], c: lime ? COLORS.lime : COLORS.green, ry })
    }
    const hills: { p: V3; c: string; s: number; ry: number }[] = []
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2
      const r = 40 + rnd() * 6
      const layers = 2 + Math.floor(rnd() * 4)
      for (let k = 0; k < layers; k++) {
        hills.push({
          p: [Math.cos(a) * (r + k * 1.5), k * BH * 2.6, Math.sin(a) * (r + k * 1.5)],
          c: k === layers - 1 ? COLORS.lime : k % 2 ? COLORS.green : COLORS.darkGreen,
          s: 2.6 - k * 0.3,
          ry: a,
        })
      }
    }
    const floor = FLOOR.map((f) => ({ p: [f.ix * SURFACE_CELL, 0, f.iz * SURFACE_CELL] as V3, c: f.c }))
    const rocks = BOULDERS.map(([x, z], i) => ({ p: [x, 0, z] as V3, c: i % 3 ? COLORS.grey : COLORS.darkGrey, ry: i * 0.7 }))
    const rockTops = BOULDERS.filter((_, i) => i % 2 === 0).map(([x, z], i) => ({ p: [x + 0.1, BH, z] as V3, c: i % 2 ? COLORS.grey : '#b8bcc0', ry: i }))
    const hedgeL = HEDGES.map(([x, z], i) => ({ p: [x, 0, z] as V3, c: i % 2 ? COLORS.darkGreen : '#2f7d33', ry: i * 0.5 }))
    const hedgeS = HEDGES.map(([x, z], i) => ({ p: [x, BH, z] as V3, c: i % 3 ? COLORS.green : COLORS.lime, ry: i * 0.5 + 0.3 }))
    const flowers: { p: V3; c: string }[] = []
    const fc = [COLORS.yellow, COLORS.white, COLORS.red, '#e98ad2']
    for (let i = 0; i < 90; i++) {
      const x = -26 + rnd() * 52
      const z = -12 + rnd() * 35
      if (!clearOfPlay(x, z) && !(x > STREAM_X)) continue
      flowers.push({ p: [x, 0, z], c: fc[i % fc.length] })
    }
    return { trunks, canopyL, canopyM, canopyS, hills, floor, rocks, rockTops, flowers, hedgeL, hedgeS }
  }, [])
  useEffect(() => {
    const ids: number[] = []
    for (const t of TREES) {
      if (!t.solid) continue
      const id = newId()
      colliders.set(id, { x: t.x, z: t.z, r: 0.5 })
      ids.push(id)
    }
    for (const [x, z] of BOULDERS) {
      const id = newId()
      colliders.set(id, { x, z, r: 0.62 })
      ids.push(id)
    }
    for (const [x, z] of HEDGES) {
      const id = newId()
      colliders.set(id, { x, z, r: 0.62, top: BH * 2 })
      ids.push(id)
    }
    FLOOR.forEach((f) => surface.set(cellKey(f.ix, f.iz), FLOOR_TOP))
    return () => {
      ids.forEach((id) => colliders.delete(id))
      surface.clear()
    }
  }, [])
  return (
    <>
      <InstancedBricks items={trunks} w={2} d={2} fade />
      <InstancedBricks items={canopyL} w={6} d={6} fade />
      <InstancedBricks items={canopyM} w={4} d={4} fade />
      <InstancedBricks items={canopyS} w={2} d={2} fade />
      <InstancedBricks items={hills} w={8} d={8} studs={false} />
      <InstancedBricks items={floor} w={4} d={4} h={1 / 3} />
      <InstancedBricks items={rocks} w={3} d={3} h={1} studs={false} />
      <InstancedBricks items={rockTops} w={2} d={2} h={1} />
      <InstancedBricks items={hedgeL} w={3} d={3} />
      <InstancedBricks items={hedgeS} w={2} d={2} />
      <InstancedBricks items={flowers} w={1} d={1} h={1 / 3} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Storm                                                                */
/* ------------------------------------------------------------------ */

const CLEAR = { top: new THREE.Color('#4f8fd8'), horizon: new THREE.Color('#cfe3f0'), sun: new THREE.Color('#fff1c9'), ground: new THREE.Color(COLORS.green) }
const STORM = { top: new THREE.Color('#252b37'), horizon: new THREE.Color('#6b7580'), sun: new THREE.Color('#3a3f48'), ground: new THREE.Color('#2a5230') }
const FLASH = new THREE.Color('#e9efff')
const CLOUD_N = 34

/** 0..1 storm the world is currently showing (eased towards the target). */
export const weather = { shown: 0, flash: 0 }

function Storm() {
  const { scene } = useThree()
  const sky = useMemo(() => skyMaterial('#4f8fd8', '#cfe3f0', '#fff1c9', new THREE.Vector3(0.5, 0.55, -0.6)), [])
  const ground = useMemo(() => baseplateMaterial(COLORS.green, '#cfe3f0', 26, 70), [])
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const clouds = useRef<THREE.InstancedMesh>(null)
  const bg = useMemo(() => new THREE.Color('#cfe3f0'), [])
  const tmp = useMemo(() => ({ o: new THREE.Object3D(), c: new THREE.Color() }), [])
  const seeds = useMemo(() => {
    const rnd = seeded(77)
    return Array.from({ length: CLOUD_N }, () => ({ x: -80 + rnd() * 160, z: rnd() * 30, y: 13 + rnd() * 8, s: 1.6 + rnd() * 1.8, ry: rnd() * 3, sp: 0.4 + rnd() * 0.6 }))
  }, [])
  const flashCd = useRef(2)
  useEffect(() => {
    scene.background = bg
    weather.shown = 0
    weather.flash = 0
    return () => {
      scene.background = null
    }
  }, [scene, bg])
  useEffect(() => {
    const m = clouds.current
    if (!m) return
    seeds.forEach((_, i) => m.setColorAt(i, tmp.c.set(i % 3 === 0 ? '#5c636e' : i % 3 === 1 ? '#727a86' : '#8d95a0')))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [seeds, tmp])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const lv = useAnimals.getState()
    const end = closing.t >= 0 ? Math.min(1, closing.t / 6) : 0
    const target = Math.min(1, lv.storm * 0.8 + end * 0.2)
    weather.shown += (target - weather.shown) * (1 - Math.exp(-dt * 0.6))
    const s = weather.shown
    // lightning once the storm is heavy
    if (s > 0.55 || closing.t > 5) {
      flashCd.current -= dt
      if (flashCd.current <= 0) {
        weather.flash = 1
        flashCd.current = closing.t > 5 ? 1.2 + Math.random() * 2 : 5 + Math.random() * 6
      }
    }
    weather.flash = Math.max(0, weather.flash - dt * 5)
    const f = weather.flash * weather.flash
    const u = sky.uniforms
    ;(u.uTop.value as THREE.Color).copy(CLEAR.top).lerp(STORM.top, s).lerp(FLASH, f * 0.5)
    ;(u.uHorizon.value as THREE.Color).copy(CLEAR.horizon).lerp(STORM.horizon, s).lerp(FLASH, f * 0.4)
    ;(u.uSunCol.value as THREE.Color).copy(CLEAR.sun).lerp(STORM.sun, s)
    bg.copy(u.uHorizon.value as THREE.Color)
    const gu = ground.uniforms
    ;(gu.uFog.value as THREE.Color).copy(u.uHorizon.value as THREE.Color)
    ;(gu.uColor.value as THREE.Color).copy(CLEAR.ground).lerp(STORM.ground, s)
    gu.uFogNear.value = 26 - s * 6
    gu.uFogFar.value = 70 - s * 18
    scene.environmentIntensity = 0.5 - s * 0.3 + f * 0.5
    if (hemi.current) hemi.current.intensity = 0.75 - s * 0.42 + f * 0.9
    if (sun.current) {
      sun.current.intensity = 1.15 - s * 0.75 + f * 0.6
      sun.current.color.set('#fff3dc').lerp(tmp.c.set('#b9c4d6'), s)
    }
    const m = clouds.current
    if (m) {
      const t = state.clock.elapsedTime
      const o = tmp.o
      for (let i = 0; i < CLOUD_N; i++) {
        const c = seeds[i]
        // roll in from far beyond the northern hills towards overhead
        const z = THREE.MathUtils.lerp(-130, -50, s) - c.z * (1 - s * 0.5)
        o.position.set(c.x + Math.sin(t * 0.05 * c.sp + i) * 3, c.y - s * 5, z)
        o.rotation.set(0, c.ry, 0)
        o.scale.set(c.s * 3.2, c.s * (0.8 + s * 0.6), c.s * 2.2)
        o.updateMatrix()
        m.setMatrixAt(i, o.matrix)
      }
      m.instanceMatrix.needsUpdate = true
    }
  })
  return (
    <>
      <mesh material={sky} renderOrder={-1} frustumCulled={false}>
        <sphereGeometry args={[180, 24, 12]} />
      </mesh>
      <PlasticEnvironment intensity={0.5} />
      <hemisphereLight ref={hemi} args={['#dff1ff', '#5d7a3a', 0.75]} />
      <directionalLight ref={sun} position={[8, 14, 6]} intensity={1.15} color="#fff3dc" />
      <mesh geometry={planeGeo} material={ground} scale={[140, 1, 140]} />
      <instancedMesh ref={clouds} args={[brickGeometry(4, 4, 1, false), plastic('#ffffff', { rough: 0.9 }), CLOUD_N]} frustumCulled={false} />
    </>
  )
}

/* Rain: streaks that fall entirely in the vertex shader around Noah. */
const RAIN_N = 1400
const RAIN_BOX = 26
const RAIN_H = 14

function rainMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uAmount: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color('#e4ecf7') } },
    vertexShader: /* glsl */ `
      uniform float uTime, uAmount;
      uniform vec3 uCenter;
      attribute vec4 aSeed; // x, z, phase, tail(0/1)
      varying float vA;
      void main() {
        float box = ${RAIN_BOX.toFixed(1)};
        float h = ${RAIN_H.toFixed(1)};
        // wrap drops around the follow point so the shower travels with Noah
        vec2 xz = uCenter.xz + mod(aSeed.xy * box - uCenter.xz + box * 0.5, box) - box * 0.5;
        float y = mod(aSeed.z * h - uTime * 16.0, h);
        vec3 p = vec3(xz.x + y * 0.08 + aSeed.w * 0.05, y + aSeed.w * 0.7, xz.y);
        vA = step(fract(aSeed.x * 7.13 + aSeed.y * 3.7), uAmount) * (1.0 - aSeed.w * 0.6) * smoothstep(0.0, 1.0, y);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vA;
      void main() {
        if (vA < 0.01) discard;
        gl_FragColor = vec4(uColor, vA * 0.8);
      }`,
  })
}

function Rain() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(RAIN_N * 2 * 3)
    const seed = new Float32Array(RAIN_N * 2 * 4)
    const rnd = seeded(101)
    for (let i = 0; i < RAIN_N; i++) {
      const sx = rnd()
      const sz = rnd()
      const ph = rnd()
      for (let k = 0; k < 2; k++) seed.set([sx, sz, ph, k], (i * 2 + k) * 4)
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
    return g
  }, [])
  const mat = useMemo(rainMaterial, [])
  const lines = useRef<THREE.LineSegments>(null)
  useFrame((_, dt) => {
    const u = mat.uniforms
    u.uTime.value += Math.min(dt, 1 / 30)
    // drizzle from half-way, a downpour once the door is shut
    const amount = THREE.MathUtils.clamp((weather.shown - 0.4) * 2, 0, 1) * 0.65 + (closing.t > 9 ? Math.min(0.4, (closing.t - 9) * 0.2) : 0)
    u.uAmount.value = amount
    ;(u.uCenter.value as THREE.Vector3).set(player.pos.x, 0, player.pos.z - 3)
    if (lines.current) lines.current.visible = amount > 0.01
  })
  return <lineSegments ref={lines} geometry={geo} material={mat} frustumCulled={false} />
}

export function AnimalsWorld() {
  return (
    <>
      <Storm />
      <Rain />
      <Scenery />
    </>
  )
}
