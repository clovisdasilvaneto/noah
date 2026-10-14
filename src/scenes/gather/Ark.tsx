import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BH, COLORS, brickGeometry, plastic, plasticFade } from '../../three/bricks'
import { Beam, BlobShadow, Brick, Motes } from '../../three/common'
import { fx } from '../../three/Effects'
import { camFx, colliders, newId, platforms, player } from '../../game/world'
import { sfx } from '../../game/audio'
import { BuildSpot } from './Props'
import { ARK, ARK_STAGES, COAT_SPOTS, DECK_SPOTS, DOOR_SPOT, PLANK_DROP, ROOF_SPOT, WOODPILE, arkBuild, camCine, flyFrom } from './gatherState'
import { COAT_GOAL, PITCH_GOAL, PLANK_GOAL, WOOD_GOAL, gatherStep, t, useGame } from '../../store'

type V3 = [number, number, number]

/*
 * The ark, built in the order Genesis 6:14–16 gives it: a keel of gopher
 * wood, three decks with rooms, pitch inside and out, a roof with a window a
 * cubit below it, and a door in the side. Every stage is a slice of one
 * brick list drawn with a handful of instanced meshes; build spots report
 * progress and the bricks fly in from the spot.
 */

const STAGES = ARK_STAGES
const ST_KEEL = 0
const ST_ROOF = 4
const ST_DOOR = 5

/* ------------------------------------------------------------------ */
/* The brick list                                                       */
/* ------------------------------------------------------------------ */

type ArkBrick = { w: number; d: number; h: number; studs: boolean; c: string; p: V3; stage: number; coat: boolean }

const WOOD_A = COLORS.gopher
const WOOD_B = '#a96a31'
const PITCH_A = '#2a211c'
const PITCH_B = '#3d2c21'
const FLOOR_C = COLORS.tan
const GLASS = '#ffe3a3' // lamplight in the window
const HAY = '#e9c46a'

/** Coating sections along the hull: stern end, stern half, bow half, bow end. */
const sectionOf = (x: number) => (x < -4.8 ? 0 : x < 0 ? 1 : x < 4.8 ? 2 : 3)

function arkBricks(): ArkBrick[] {
  const out: ArkBrick[] = []
  const add = (stage: number, w: number, d: number, h: number, c: string, x: number, y: number, z: number, coat = false, studs = true) =>
    out.push({ w, d, h, studs, c, p: [x, y, z], stage, coat })

  // keel: a double spine of planks, ribs fanning out, stem and stern posts
  for (let i = -2; i <= 2; i++) {
    add(ST_KEEL, 8, 2, 1, WOOD_A, i * 3.2, 0, 0)
    add(ST_KEEL, 8, 2, 1, WOOD_B, i * 3.2, BH, 0)
    for (const side of [-1, 1]) {
      add(ST_KEEL, 1, 1, 1, WOOD_A, i * 3.2, 0, side * 0.8)
      add(ST_KEEL, 1, 1, 1, WOOD_A, i * 3.2, 0, side * 1.2)
      add(ST_KEEL, 1, 1, 1, COLORS.pitch, i * 3.2, 0, side * 1.6)
      add(ST_KEEL, 1, 1, 1, WOOD_B, i * 3.2, BH, side * 0.8)
      add(ST_KEEL, 1, 1, 1, WOOD_B, i * 3.2, BH, side * 1.2)
    }
  }
  for (const sx of [-1, 1]) add(ST_KEEL, 2, 2, 2, WOOD_A, sx * 8.8, 0, 0, true)

  // hull walls: one layer = two long sides (staggered like real brickwork) + two ends,
  // and the prow curls upward at both ends
  const wallLayer = (stage: number, k: number) => {
    const y = k * BH
    const c = k % 2 ? WOOD_B : WOOD_A
    for (const z of [-2.2, 2.2]) {
      if (k % 2 === 0) for (let j = 0; j < 10; j++) add(stage, 4, 1, 1, c, -7.2 + j * 1.6, y, z, true)
      else {
        for (let j = 0; j < 9; j++) add(stage, 4, 1, 1, c, -6.4 + j * 1.6, y, z, true)
        add(stage, 2, 1, 1, c, -7.6, y, z, true)
        add(stage, 2, 1, 1, c, 7.6, y, z, true)
      }
    }
    for (const sx of [-1, 1]) {
      add(stage, 1, 6, 1, c, sx * 8.2, y, -1.2, true)
      add(stage, 1, 6, 1, c, sx * 8.2, y, 1.2, true)
      // stem and stern sweep outward as they rise
      if (k >= 2) add(stage, 2, 4, 1, c, sx * 8.8, y, 0, true)
      if (k >= 3) add(stage, 1, 2, 1, c, sx * 9.4, y, 0, true)
      if (k >= 4) add(stage, 1, 2, 1, c, sx * 9.8, y, 0, true)
      if (k >= 5) add(stage, 1, 1, 1, c, sx * 10.2, y, 0, true)
    }
  }

  // decks: two wall layers, a floor, and rooms on it ("make rooms in the ark")
  const ROOM_X = [-4.8, -1.6, 1.6, 4.8]
  for (let deck = 0; deck < 3; deck++) {
    const stage = 1 + deck
    wallLayer(stage, deck * 2)
    wallLayer(stage, deck * 2 + 1)
    const fy = (deck * 2 + 2) * BH
    for (let i = -2; i <= 2; i++) add(stage, 8, 10, 1 / 3, FLOOR_C, i * 3.2, fy, 0)
    const ry = fy + BH / 3
    const wallH = deck < 2 ? 1 : 2 / 3
    for (const x of ROOM_X) for (const z of [-1.4, 1.4]) add(stage, 1, 3, wallH, WOOD_B, x, ry, z)
    if (deck === 0) {
      // the lower deck: hay for the big animals, a water trough
      for (const [x, z] of [[-6.4, 1.4], [-3.2, -1.4], [0, 1.4], [3.2, -1.4], [6.4, 1.4]]) add(stage, 2, 2, 2 / 3, HAY, x, ry, z)
      for (const [x, z] of [[-6.4, -1.4], [3.2, 1.4]]) add(stage, 2, 1, 1 / 3, COLORS.blue, x, ry, z)
    } else if (deck === 1) {
      // the second deck: the food store (Genesis 6:21)
      for (const [x, z] of [[-6.4, -1.4], [0, -1.4], [6.4, 1.4]]) add(stage, 2, 2, 1, COLORS.brown, x, ry, z)
      for (const [x, z] of [[-6.4, -1.4], [0, -1.4], [6.4, 1.4]]) add(stage, 1, 1, 1 / 3, COLORS.red, x, ry + BH, z)
      for (const [x, z] of [[-3.2, 1.4], [3.2, -1.4], [-6.4, 1.4]]) add(stage, 1, 1, 2 / 3, COLORS.lime, x, ry, z)
      for (const [x, z] of [[-2.8, 1.4], [3.6, -1.4], [3.2, 1.4]]) add(stage, 1, 1, 2 / 3, '#e8dcc0', x, ry, z)
    } else {
      // the third deck: nests for the birds, beds for Noah's family
      for (const [x, z] of [[-6.4, 1.4], [-3.2, -1.4], [0, 1.4]]) {
        add(stage, 2, 2, 1 / 3, '#c8a165', x, ry, z)
        add(stage, 1, 1, 1 / 3, COLORS.white, x, ry + BH / 3, z)
      }
      for (const [x, z] of [[3.2, 1.4], [6.4, 1.4], [3.2, -1.4], [6.4, -1.4]]) add(stage, 2, 3, 1 / 3, x > 5 ? COLORS.red : COLORS.blue, x, ry, z)
    }
  }

  // roof stage: a window band a cubit high under the roof, then a stepped gable roof
  const wy = 6 * BH
  for (const z of [-2.2, 2.2]) {
    for (let j = 0; j < 10; j++) {
      const cx = -7.2 + j * 1.6
      add(ST_ROOF, 1, 1, 1, WOOD_A, cx - 0.6, wy, z)
      add(ST_ROOF, 3, 1, 1, GLASS, cx + 0.2, wy, z, false, false)
    }
  }
  for (const sx of [-1, 1]) {
    add(ST_ROOF, 1, 6, 1, WOOD_A, sx * 8.2, wy, -1.2)
    add(ST_ROOF, 1, 6, 1, WOOD_A, sx * 8.2, wy, 1.2)
    add(ST_ROOF, 1, 2, 1, PITCH_A, sx * 9.4, wy, 0)
    add(ST_ROOF, 1, 2, 1, PITCH_A, sx * 9.8, wy, 0)
    add(ST_ROOF, 1, 1, 1, PITCH_A, sx * 10.2, wy, 0)
    add(ST_ROOF, 1, 1, 1, PITCH_B, sx * 10.6, wy, 0)
    add(ST_ROOF, 1, 1, 1, PITCH_B, sx * 10.6, wy + BH, 0)
    add(ST_ROOF, 1, 1, 1, WOOD_A, sx * 10.6, wy + 2 * BH, 0)
  }
  const ry = 7 * BH
  for (let i = -2; i <= 2; i++) add(ST_ROOF, 9, 14, 1 / 3, COLORS.darkTan, i * 3.6, ry, 0, false, false)
  const steps: [number, number, string][] = [
    [2.2, 0, COLORS.reddishBrown],
    [1.4, 1, COLORS.brown],
    [0.6, 2, COLORS.reddishBrown],
  ]
  for (const [z, s, c] of steps) {
    for (let i = -2; i <= 2; i++) {
      add(ST_ROOF, 9, 3, 2 / 3, c, i * 3.6, ry + BH / 3 + (s * 2 * BH) / 3, z)
      add(ST_ROOF, 9, 3, 2 / 3, c, i * 3.6, ry + BH / 3 + (s * 2 * BH) / 3, -z)
    }
  }
  for (let i = -2; i <= 2; i++) add(ST_ROOF, 9, 2, 2 / 3, COLORS.tan, i * 3.6, ry + BH / 3 + 2 * BH, 0)

  // door stage: a dark doorway, posts and a lintel (the door itself is animated separately)
  add(ST_DOOR, 6, 1, 4, COLORS.black, 0, 0, 2.45, false, false)
  for (const sx of [-1, 1]) add(ST_DOOR, 1, 1, 4, WOOD_A, sx * 1.4, 0, 2.6)
  add(ST_DOOR, 8, 1, 1, WOOD_A, 0, 4 * BH, 2.6)
  return out
}

/* ------------------------------------------------------------------ */
/* The model                                                            */
/* ------------------------------------------------------------------ */

const FLY_SPEED = 3.2 // 1 / seconds a brick spends in the air
const tmpO = new THREE.Object3D()
const tmpC = new THREE.Color()
const hiddenM = new THREE.Matrix4().makeScale(0, 0, 0)

type ArkData = {
  bricks: ArkBrick[]
  n: number
  shapes: { w: number; d: number; h: number; studs: boolean; count: number }[]
  group: Int16Array
  slot: Int16Array
  order: number[][]
  coatOrder: number[][]
  base: THREE.Color[]
  coated: THREE.Color[]
}

let arkDataCache: ArkData | null = null
/** The ark's bricks, grouped into instanced shapes and ordered per stage. Built once. */
function arkData(): ArkData {
  if (arkDataCache) return arkDataCache
  const bricks = arkBricks()
  const n = bricks.length
  const shapeKeys: string[] = []
  const shapes: ArkData['shapes'] = []
  const group = new Int16Array(n)
  const slot = new Int16Array(n)
  bricks.forEach((b, i) => {
    const key = `${b.w}|${b.d}|${b.h}|${b.studs}`
    let g = shapeKeys.indexOf(key)
    if (g < 0) {
      g = shapeKeys.push(key) - 1
      shapes.push({ w: b.w, d: b.d, h: b.h, studs: b.studs, count: 0 })
    }
    group[i] = g
    slot[i] = shapes[g].count++
  })
  // each stage reveals bottom-up, then along the hull
  const order: number[][] = Array.from({ length: STAGES }, () => [])
  bricks.forEach((b, i) => order[b.stage].push(i))
  for (const o of order) o.sort((a, b) => bricks[a].p[1] - bricks[b].p[1] || bricks[a].p[0] - bricks[b].p[0])
  // each pitch patch coats its section of the hull, bottom-up
  const coatOrder: number[][] = Array.from({ length: COAT_GOAL }, () => [])
  bricks.forEach((b, i) => b.coat && coatOrder[sectionOf(b.p[0])].push(i))
  for (const o of coatOrder) o.sort((a, b) => bricks[a].p[1] - bricks[b].p[1])
  const base = bricks.map((b) => new THREE.Color(b.c))
  const coated = bricks.map((b) => new THREE.Color(Math.round(b.p[1] / BH) % 2 ? PITCH_B : PITCH_A))
  arkDataCache = { bricks, n, shapes, group, slot, order, coatOrder, base, coated }
  return arkDataCache
}

/** Animation bookkeeping for the single ark on screen; reset when the model mounts. */
const live = {
  shown: new Int32Array(STAGES),
  coatedN: new Int32Array(COAT_GOAL),
  fly: new Float32Array(0),
  paint: new Float32Array(0),
  flying: [] as number[],
  painting: [] as number[],
  dirtyM: new Uint8Array(0),
  dirtyC: new Uint8Array(0),
}
const arkMeshes: (THREE.InstancedMesh | null)[] = []

function placeFinal(data: ArkData, i: number) {
  const b = data.bricks[i]
  const m = arkMeshes[data.group[i]]
  if (!m) return
  tmpO.position.set(b.p[0], b.p[1], b.p[2])
  tmpO.rotation.set(0, 0, 0)
  tmpO.scale.setScalar(1)
  tmpO.updateMatrix()
  m.setMatrixAt(data.slot[i], tmpO.matrix)
  live.dirtyM[data.group[i]] = 1
}

function ArkModel() {
  const data = arkData()
  const doorRef = useRef<THREE.Group>(null)
  const doorPanel = useRef<THREE.Group>(null)
  const doorT = useRef(0)

  // start from the store: everything hidden except stages already done
  useEffect(() => {
    const st = useGame.getState()
    const done = [st.keelBuilt, st.decks > 0, st.decks > 1, st.decks > 2, st.roofBuilt, st.arkComplete]
    arkBuild.progress.fill(0)
    arkBuild.coat.fill(0)
    for (let s = 0; s < STAGES; s++) if (done[s]) arkBuild.progress[s] = 1
    for (let c = 0; c < COAT_GOAL; c++) if (st.coatMask & (1 << c)) arkBuild.coat[c] = 1
    live.shown.fill(0)
    live.coatedN.fill(0)
    live.fly = new Float32Array(data.n)
    live.paint = new Float32Array(data.n)
    live.flying.length = 0
    live.painting.length = 0
    live.dirtyM = new Uint8Array(data.shapes.length)
    live.dirtyC = new Uint8Array(data.shapes.length)
    for (let i = 0; i < data.n; i++) {
      const m = arkMeshes[data.group[i]]
      m?.setMatrixAt(data.slot[i], hiddenM)
      m?.setColorAt(data.slot[i], data.base[i])
    }
    for (let s = 0; s < STAGES; s++) {
      if (!done[s]) continue
      for (const i of data.order[s]) placeFinal(data, i)
      live.shown[s] = data.order[s].length
    }
    for (let c = 0; c < COAT_GOAL; c++) {
      if (!arkBuild.coat[c]) continue
      for (const i of data.coatOrder[c]) arkMeshes[data.group[i]]?.setColorAt(data.slot[i], data.coated[i])
      live.coatedN[c] = data.coatOrder[c].length
    }
    arkMeshes.forEach((m) => {
      if (!m) return
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    })
    if (st.arkComplete) doorT.current = 1
  }, [data])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    // queue newly earned bricks
    for (let s = 0; s < STAGES; s++) {
      const order = data.order[s]
      const want = Math.min(order.length, Math.ceil(arkBuild.progress[s] * order.length - 1e-4))
      while (live.shown[s] < want) {
        const i = order[live.shown[s]++]
        live.fly[i] = 0
        live.flying.push(i)
      }
    }
    for (let c = 0; c < COAT_GOAL; c++) {
      const order = data.coatOrder[c]
      const want = Math.min(order.length, Math.ceil(arkBuild.coat[c] * order.length - 1e-4))
      while (live.coatedN[c] < want) {
        const i = order[live.coatedN[c]++]
        live.paint[i] = 0
        live.painting.push(i)
        if (live.coatedN[c] % 4 === 0) {
          const b = data.bricks[i]
          fx.burst(ARK[0] + b.p[0], b.p[1] + 0.3, ARK[2] + b.p[2] + Math.sign(b.p[2]) * 0.3, [PITCH_A, PITCH_B, '#5a4030'], 2, 0.25)
        }
      }
    }

    // bricks in flight: from the build spot, in an arc, spinning into place
    for (let k = live.flying.length - 1; k >= 0; k--) {
      const i = live.flying[k]
      const b = data.bricks[i]
      const m = arkMeshes[data.group[i]]
      live.fly[i] = Math.min(1, live.fly[i] + dt * FLY_SPEED)
      const f = live.fly[i]
      if (f >= 1) {
        placeFinal(data, i)
        live.flying[k] = live.flying[live.flying.length - 1]
        live.flying.pop()
        continue
      }
      const from = arkBuild.from[b.stage]
      const e = 1 - (1 - f) * (1 - f)
      tmpO.position.set(
        from.x + (b.p[0] - from.x) * e,
        from.y + (b.p[1] - from.y) * e + Math.sin(f * Math.PI) * 2.2,
        from.z + (b.p[2] - from.z) * e,
      )
      tmpO.rotation.set(0, (1 - f) * 3, 0)
      tmpO.scale.setScalar(0.5 + 0.5 * f)
      tmpO.updateMatrix()
      m?.setMatrixAt(data.slot[i], tmpO.matrix)
      live.dirtyM[data.group[i]] = 1
    }

    // pitch soaking in: wood colour fades to glossy black
    for (let k = live.painting.length - 1; k >= 0; k--) {
      const i = live.painting[k]
      live.paint[i] = Math.min(1, live.paint[i] + dt * 3)
      tmpC.copy(data.base[i]).lerp(data.coated[i], live.paint[i])
      arkMeshes[data.group[i]]?.setColorAt(data.slot[i], tmpC)
      live.dirtyC[data.group[i]] = 1
      if (live.paint[i] >= 1) {
        live.painting[k] = live.painting[live.painting.length - 1]
        live.painting.pop()
      }
    }

    for (let g = 0; g < data.shapes.length; g++) {
      const m = arkMeshes[g]
      if (!m) continue
      if (live.dirtyM[g]) m.instanceMatrix.needsUpdate = true
      if (live.dirtyC[g] && m.instanceColor) m.instanceColor.needsUpdate = true
      live.dirtyM[g] = 0
      live.dirtyC[g] = 0
    }

    // the door: pops in near the end of its build, swings down into a ramp once the ark is done
    const door = doorRef.current
    if (door) {
      const p = arkBuild.progress[ST_DOOR]
      door.visible = p >= 0.8
      door.scale.setScalar(Math.min(1, Math.max(0.001, (p - 0.8) * 5)))
      if (useGame.getState().arkComplete && doorT.current < 1) {
        const before = doorT.current
        doorT.current = Math.min(1, doorT.current + dt * 0.9)
        if (before < 0.75 && doorT.current >= 0.75) {
          sfx.smash()
          camFx.shake = Math.max(camFx.shake, 0.6)
          fx.puff(ARK[0], 0.2, ARK[2] + 4.3)
          fx.puff(ARK[0] - 0.8, 0.2, ARK[2] + 4.6)
          fx.puff(ARK[0] + 0.8, 0.2, ARK[2] + 4.6)
        }
      }
      if (doorPanel.current) {
        // ease in like gravity, with a small bounce at the end
        const d = Math.max(0, (doorT.current - 0.15) / 0.6)
        const fall = d < 1 ? d * d : 1 - Math.sin(Math.min(1, (doorT.current - 0.75) / 0.25) * Math.PI) * 0.06
        doorPanel.current.rotation.x = fall * (Math.PI / 2)
      }
    }
  })

  return (
    <group position={ARK}>
      {data.shapes.map((sh, g) => (
        <instancedMesh
          key={g}
          ref={(m) => {
            arkMeshes[g] = m
          }}
          args={[brickGeometry(sh.w, sh.d, sh.h, sh.studs), plasticFade('#ffffff'), sh.count]}
          frustumCulled={false}
        />
      ))}
      <group ref={doorRef} position={[0, BH / 3, 3.05]} visible={false}>
        <group ref={doorPanel}>
          <Brick w={6} d={1} h={4} studs={false} color={COLORS.brown} position={[0, 0, -0.2]} />
          {/* cleats so it reads as a ramp once it is down */}
          {[0.4, 0.9, 1.4].map((y) => (
            <Brick key={y} w={6} d={1} h={1 / 3} color={WOOD_A} position={[0, y, 0.0]} />
          ))}
        </group>
      </group>
      <BlobShadow size={13} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Planks: pick up at the woodpile, carry, drop at the ark site          */
/* ------------------------------------------------------------------ */

function Woodpile({ active }: { active: boolean }) {
  useEffect(() => {
    const id = newId()
    colliders.set(id, { x: WOODPILE[0], z: WOODPILE[2], r: 1.0 })
    return () => {
      colliders.delete(id)
    }
  }, [])
  return (
    <group position={WOODPILE}>
      {[-0.5, 0, 0.5].map((z, i) => (
        <Brick key={z} w={6} d={1} color={i % 2 ? COLORS.gopher : WOOD_B} position={[0, 0, z]} />
      ))}
      {[-0.25, 0.25].map((z, i) => (
        <Brick key={z} w={6} d={1} color={i % 2 ? WOOD_B : COLORS.gopher} position={[0, BH, z]} />
      ))}
      <Brick w={1} d={4} h={1 / 3} color={COLORS.reddishBrown} position={[-0.9, BH * 2, 0]} />
      <Brick w={1} d={4} h={1 / 3} color={COLORS.reddishBrown} position={[0.9, BH * 2, 0]} />
      <Brick w={6} d={1} color={COLORS.gopher} position={[0, BH * 2 + BH / 3, 0]} />
      {active && <Motes count={14} area={[2.2, 1.4]} height={2.4} color="#ffd75e" size={9} rise={0.6} />}
      <BlobShadow size={3} />
    </group>
  )
}

function PlankBundle({ position, rotation = 0 }: { position?: V3; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Brick w={6} d={2} h={1 / 3} color={COLORS.gopher} />
      <Brick w={6} d={2} h={1 / 3} color={WOOD_B} position={[0.1, BH / 3, 0]} />
      <Brick w={6} d={2} h={1 / 3} color={COLORS.gopher} position={[-0.1, (BH * 2) / 3, 0]} />
    </group>
  )
}

/** The bundles waiting at the ark site, and the glowing drop marker while planks are needed. */
function PlankDrop({ waiting, marker }: { waiting: number; marker: boolean }) {
  const ring = useRef<THREE.Mesh>(null)
  const ringGeo = useMemo(() => new THREE.RingGeometry(1.05, 1.35, 32).rotateX(-Math.PI / 2), [])
  useFrame((state) => {
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 4) * 0.06)
  })
  return (
    <group position={PLANK_DROP}>
      {marker && (
        <mesh ref={ring} geometry={ringGeo} position={[0, 0.2, 0]} renderOrder={2}>
          <meshBasicMaterial color="#ffd23f" transparent opacity={0.85} depthWrite={false} />
        </mesh>
      )}
      {Array.from({ length: Math.min(waiting, PLANK_GOAL) }, (_, i) => (
        <PlankBundle key={i} position={[0, BH / 3 + i * BH, 0]} rotation={i % 2 ? 0.25 : -0.1} />
      ))}
    </group>
  )
}

/** The load on Noah's shoulders, plus the pick-up / drop-off triggers. */
function PlankCarry() {
  const carrying = useGame((s) => s.carrying)
  const g = useRef<THREE.Group>(null)
  useFrame((state) => {
    const st = useGame.getState()
    if (st.keelBuilt && st.planks < PLANK_GOAL && !st.arkComplete && player.pos.y < 1.2) {
      if (!st.carrying && Math.hypot(player.pos.x - WOODPILE[0], player.pos.z - WOODPILE[2]) < 1.9) {
        st.pickPlank()
        sfx.pickup()
        fx.burst(WOODPILE[0], 1, WOODPILE[2], [COLORS.gopher, WOOD_B, '#ffe08a'], 8, 0.6)
        st.toast(t().toastPlankPick)
      } else if (st.carrying && Math.hypot(player.pos.x - PLANK_DROP[0], player.pos.z - PLANK_DROP[2]) < 1.6) {
        st.dropPlank()
        sfx.built()
        fx.burst(PLANK_DROP[0], 0.8, PLANK_DROP[2], [COLORS.gopher, WOOD_B, '#ffe08a', '#ffffff'], 14, 0.8)
        fx.studs(PLANK_DROP[0], 0.6, PLANK_DROP[2], 150)
        st.toast(t().toastPlank)
      }
    }
    const o = g.current
    if (o) {
      const moving = Math.hypot(player.vel.x, player.vel.z) > 0.5
      o.position.set(player.pos.x, player.pos.y + 1.52 + (moving ? Math.abs(Math.sin(state.clock.elapsedTime * 10)) * 0.05 : 0), player.pos.z)
      o.rotation.y = player.facing
    }
  })
  if (!carrying) return null
  return (
    <group ref={g}>
      <PlankBundle />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Pitch patch visual: a bubbling puddle and a bucket with a brush      */
/* ------------------------------------------------------------------ */

const puddleGeo = new THREE.CircleGeometry(0.7, 20).rotateX(-Math.PI / 2)
const bucketGeo = new THREE.CylinderGeometry(0.26, 0.2, 0.42, 12)

function PitchPatch() {
  return (
    <>
      {/* above the sand plate's studs so it never z-fights */}
      <mesh geometry={puddleGeo} material={plastic(COLORS.pitch, { rough: 0.1 })} position={[0, 0.25, 0]} />
      <mesh geometry={bucketGeo} material={plastic(COLORS.brown)} position={[0.3, 0.46, 0.25]} />
      <mesh geometry={puddleGeo} material={plastic(COLORS.pitch, { rough: 0.1 })} position={[0.3, 0.68, 0.25]} scale={0.32} />
      <Brick w={1} d={1} h={2} color={COLORS.gopher} position={[0.38, 0.5, 0.2]} rotation={[0, 0, -0.35]} />
      <Motes count={10} area={[1, 1]} height={1.6} color="#ffd75e" size={8} rise={0.6} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Celebration once the door is in                                      */
/* ------------------------------------------------------------------ */

const CONFETTI = ['#ffd23f', '#ffffff', COLORS.red, COLORS.blue, COLORS.lime, COLORS.orange]
const PARTY_SECONDS = 7

function Celebration() {
  const time = useRef(0)
  const nextBurst = useRef(0)
  const done = useRef(false)
  useFrame((_, rawDt) => {
    const st = useGame.getState()
    if (!st.arkComplete) return
    const dt = Math.min(rawDt, 1 / 30)
    if (time.current === 0) {
      // frame the whole ark, and bring Noah to the foot of the ramp
      camCine.on = true
      camCine.x = ARK[0]
      camCine.y = 2.2
      camCine.z = ARK[2] + 2
      camCine.width = 23
      fx.puff(player.pos.x, player.pos.y, player.pos.z)
      player.pos.set(ARK[0], player.pos.y, ARK[2] + 6.3)
      player.vel.set(0, 0, 0)
      player.facing = 0
      fx.puff(player.pos.x, 0.2, player.pos.z)
    }
    time.current += dt
    if (time.current < PARTY_SECONDS - 1.5 && time.current > nextBurst.current) {
      nextBurst.current = time.current + 0.3
      const x = ARK[0] + (Math.random() - 0.5) * 18
      fx.burst(x, 5 + Math.random() * 2, ARK[2] + (Math.random() - 0.5) * 3, CONFETTI, 16, 1.1)
      sfx.stud(Math.random() > 0.5 ? 100 : 1000)
      if (Math.random() < 0.25) fx.studs(x, 5, ARK[2] + 3, 300)
    }
    if (time.current > PARTY_SECONDS && !done.current && st.screen === 'gather') {
      done.current = true
      st.setScreen('complete')
    }
  })
  return null
}

/* ------------------------------------------------------------------ */
/* The ark site: model, collider, the active build spot                 */
/* ------------------------------------------------------------------ */

const KEEL_PILE = [COLORS.gopher, WOOD_B, COLORS.pitch]
const DECK_PILE = [COLORS.gopher, WOOD_B, FLOOR_C]
const ROOF_PILE = [COLORS.reddishBrown, COLORS.brown, GLASS]
const DOOR_PILE = [COLORS.brown, COLORS.gopher, COLORS.black]
const COAT_PILE = [COLORS.pitch, PITCH_B]

export function ArkSite() {
  const step = useGame(gatherStep)
  const keelBuilt = useGame((s) => s.keelBuilt)
  const decks = useGame((s) => s.decks)
  const coatMask = useGame((s) => s.coatMask)
  const planks = useGame((s) => s.planks)
  const carrying = useGame((s) => s.carrying)
  const arkComplete = useGame((s) => s.arkComplete)

  useEffect(() => {
    camCine.on = false
    return () => {
      camCine.on = false
    }
  }, [])

  // once the keel is down the hull is solid (too tall to climb)
  useEffect(() => {
    if (!keelBuilt) return
    const id = newId()
    platforms.set(id, { x: ARK[0], z: ARK[2], hw: 9.5, hd: 2.6, top: 99 })
    return () => {
      platforms.delete(id)
    }
  }, [keelBuilt])

  return (
    <>
      <ArkModel />

      {!keelBuilt && (
        <BuildSpot
          position={ARK}
          radius={3.2}
          seconds={2.6}
          pileColors={KEEL_PILE}
          ready={() => {
            const st = useGame.getState()
            return st.wood >= WOOD_GOAL && st.pitch >= PITCH_GOAL
          }}
          onProgress={(p) => {
            arkBuild.from[ST_KEEL].set(0, 0.4, 0)
            arkBuild.progress[ST_KEEL] = p
          }}
          onBuilt={() => {
            const st = useGame.getState()
            st.setKeelBuilt()
            st.toast(t().toastKeel)
            fx.studs(ARK[0], 1, ARK[2], 500)
          }}
        />
      )}

      <Woodpile active={step === 4 && !carrying} />
      <PlankDrop waiting={Math.max(0, planks - decks)} marker={step === 4 && carrying} />
      <PlankCarry />

      {step === 5 && (
        <BuildSpot
          key={`deck${decks}`}
          position={DECK_SPOTS[decks]}
          seconds={2.4}
          pileColors={DECK_PILE}
          onProgress={(p) => {
            flyFrom(1 + decks, DECK_SPOTS[decks])
            arkBuild.progress[1 + decks] = p
          }}
          onBuilt={() => {
            const st = useGame.getState()
            st.toast(t().toastDecks[st.decks] ?? '')
            st.addDeck()
          }}
        />
      )}

      {step === 6 &&
        COAT_SPOTS.map((p, i) =>
          coatMask & (1 << i) ? null : (
            <BuildSpot
              key={`coat${i}`}
              position={p}
              radius={0.9}
              seconds={1.6}
              pile={false}
              pileColors={COAT_PILE}
              label={() => t().promptCoat}
              onProgress={(v) => {
                arkBuild.coat[i] = v
              }}
              onBuilt={() => {
                const st = useGame.getState()
                st.coatPatch(i)
                const all = useGame.getState().coatMask === (1 << COAT_GOAL) - 1
                st.toast(all ? t().toastCoatDone : t().toastCoat)
              }}
            >
              <PitchPatch />
            </BuildSpot>
          ),
        )}

      {step === 7 && (
        <BuildSpot
          position={ROOF_SPOT}
          seconds={3}
          pileColors={ROOF_PILE}
          onProgress={(p) => {
            flyFrom(ST_ROOF, ROOF_SPOT)
            arkBuild.progress[ST_ROOF] = p
          }}
          onBuilt={() => {
            const st = useGame.getState()
            st.setRoofBuilt()
            st.toast(t().toastRoof)
          }}
        />
      )}

      {step === 8 && (
        <BuildSpot
          position={DOOR_SPOT}
          seconds={2.2}
          pileColors={DOOR_PILE}
          onProgress={(p) => {
            flyFrom(ST_DOOR, DOOR_SPOT)
            arkBuild.progress[ST_DOOR] = p
          }}
          onBuilt={() => {
            const st = useGame.getState()
            st.setArkComplete()
            st.toast(t().toastArk)
            sfx.complete()
            fx.burst(ARK[0], 2, ARK[2], ['#ffffff', '#fff3c4', '#ffe08a'], 40, 1.4)
            fx.studs(ARK[0], 2, ARK[2] + 3, 1000)
          }}
        />
      )}

      {arkComplete && (
        // heavenly light over the finished ark
        <group position={ARK}>
          <Beam radius={6} height={30} position={[0, 15, 0]} color="#fff6d6" intensity={1.1} />
          <Motes count={70} area={[14, 5]} height={7} color="#ffe7a6" size={8} rise={1.2} />
        </group>
      )}
      <Celebration />
    </>
  )
}
