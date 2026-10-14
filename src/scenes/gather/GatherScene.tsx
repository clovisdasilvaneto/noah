import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Baseplate, Beam, BlobShadow, InstancedBricks, Motes, PlasticEnvironment, Sky, StaticBricks, placeBricks, type StaticBrick } from '../../three/common'
import { BH, COLORS, P } from '../../three/bricks'
import { Effects } from '../../three/Effects'
import { CameraRig, Player } from './Player'
import { Npcs } from './Npcs'
import { BuildPile, CrateStack, GopherTree, PickupCollector, PitchJar, PlacedStuds, Smashable, type ModelBrick, type PlacedStud, type SmashKind } from './Props'
import { ArkSite } from './Ark'
import { ARK, COAT_SPOTS, DECK_SPOTS, DOOR_SPOT, PLANK_DROP, ROOF_SPOT, WOODPILE } from './gatherState'
import { SURFACE_CELL, cellKey, clearWorld, colliders, interactables, newId, objective, pickups, platforms, player, surface } from '../../game/world'
import { gatherStep, t, useGame } from '../../store'

type V3 = [number, number, number]

const FOG = '#cfe3f0'
const START: V3 = [2, 0, 4]
const CAULDRON: V3 = [-11, 0, 2]
const GOPHER_TREES: V3[] = [
  [11, 0, -5],
  [18, 0, -11],
  [21, 0, -1],
  [13, 0, -17],
  [23, 0, -18],
]
const HOUSES: { p: V3; c: string; ry: number }[] = [
  { p: [-19, 0, -4], c: COLORS.sand, ry: 0 },
  { p: [-13, 0, -9], c: COLORS.tan, ry: Math.PI / 2 },
  { p: [-20, 0, 6], c: COLORS.white, ry: 0 },
]
const SMASHABLES: { kind: SmashKind; p: V3; ry?: number }[] = [
  { kind: 'pot', p: [-15, 0, -2] },
  { kind: 'pot', p: [-15.8, 0, -1.4] },
  { kind: 'crate', p: [-9, 0, -6] },
  { kind: 'crate', p: [-9.8, 0, -6.8] },
  { kind: 'crate', p: [-16, 0, 7] },
  { kind: 'pot', p: [-22, 0, 1] },
  { kind: 'fence', p: [-8, 0, 5], ry: 0 },
  { kind: 'fence', p: [-6.4, 0, 5], ry: 0 },
  { kind: 'fence', p: [-4.8, 0, 5], ry: 0 },
  { kind: 'bush', p: [5, 0, 6] },
  { kind: 'bush', p: [-4, 0, 9] },
  { kind: 'bush', p: [7, 0, -10] },
  { kind: 'bush', p: [16, 0, 4] },
  { kind: 'bush', p: [-6, 0, -11] },
  { kind: 'bush', p: [4, 0, 15] },
  { kind: 'bush', p: [-7, 0, 17] },
  { kind: 'crate', p: [5, 0, 20] },
  { kind: 'crate', p: [-5, 0, 21] },
  { kind: 'pot', p: [5, 0, -10] },
  { kind: 'bush', p: [25, 0, 8] },
]

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/**
 * Floor plates (paths + the sandy ark site) on one fixed grid of whole 4x4
 * plates. Every cell holds at most one plate, so tops never overlap and can't
 * z-fight; the same cells tell the physics where the floor is raised.
 */
type FloorCell = { ix: number; iz: number; c: string }
function layoutFloor(): FloorCell[] {
  const cells = new Map<string, FloorCell>()
  const C = SURFACE_CELL
  // sandy ark site first, so paths running into it don't override it
  for (let ix = Math.round(-10 / C); ix <= Math.round(10 / C); ix++) {
    for (let iz = Math.round(-22 / C); iz <= Math.round(-14 / C); iz++) {
      cells.set(cellKey(ix, iz), { ix, iz, c: (ix * 7 + iz * 3) % 4 === 0 ? '#e2c98c' : COLORS.sand })
    }
  }
  const path = (points: [number, number][]) => {
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, az] = points[i]
      const [bx, bz] = points[i + 1]
      const n = Math.ceil(Math.hypot(bx - ax, bz - az) / (C * 0.25))
      for (let k = 0; k <= n; k++) {
        const ix = Math.round((ax + ((bx - ax) * k) / n) / C)
        const iz = Math.round((az + ((bz - az) * k) / n) / C)
        const key = cellKey(ix, iz)
        if (!cells.has(key)) cells.set(key, { ix, iz, c: (ix + iz) % 5 === 0 ? COLORS.darkTan : COLORS.tan })
      }
    }
  }
  path([
    [0, 12],
    [0, -13],
  ])
  path([
    [0, 3],
    [-10, 1],
    [-17, 0],
  ])
  path([
    [0, -1],
    [8, -4],
    [14, -9],
  ])
  return [...cells.values()]
}

const FLOOR = layoutFloor()
const FLOOR_TOP = BH / 3 // a plate; studs are decoration

type TreeSpot = { x: number; z: number; h: number; ry: number; dark: boolean; lime: boolean }

/** Deterministic decorative forest: east woods plus a ring around the map edge. */
function layoutTrees(): TreeSpot[] {
  const rnd = seeded(7)
  const spots: [number, number][] = []
  for (let i = 0; i < 70; i++) spots.push([8 + rnd() * 20, -24 + rnd() * 30])
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2
    const r = 29 + rnd() * 5
    spots.push([Math.cos(a) * r, Math.sin(a) * r * 0.9])
  }
  const clear = (x: number, z: number) =>
    GOPHER_TREES.every((g) => Math.hypot(g[0] - x, g[2] - z) > 3) &&
    // the whole ark site stays clear: hull, prows, build spots and the plank drop
    (Math.abs(x - ARK[0]) > 13.5 || z < ARK[2] - 6 || z > ARK[2] + 7.5) &&
    Math.hypot(x - CAULDRON[0], z - CAULDRON[2]) > 4 &&
    Math.hypot(x - WOODPILE[0], z - WOODPILE[2]) > 3.2 &&
    SMASHABLES.every((s) => Math.hypot(s.p[0] - x, s.p[2] - z) > 1.8)
  const out: TreeSpot[] = []
  for (const [x, z] of spots) {
    if (!clear(x, z) || out.some((t) => Math.hypot(t.x - x, t.z - z) < 2.2)) continue
    out.push({ x, z, h: 2 + Math.floor(rnd() * 3), ry: Math.floor(rnd() * 4) * (Math.PI / 4), dark: rnd() > 0.5, lime: rnd() > 0.6 })
  }
  return out
}

const TREES = layoutTrees()

/** Static scenery: one instanced draw call per brick shape. */
function Scenery() {
  const { trunks, canopyL, canopyM, canopyS, hills, floor } = useMemo(() => {
    const rnd = seeded(11)
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
    return { trunks, canopyL, canopyM, canopyS, hills, floor }
  }, [])

  return (
    <>
      <InstancedBricks items={trunks} w={2} d={2} fade />
      <InstancedBricks items={canopyL} w={6} d={6} fade />
      <InstancedBricks items={canopyM} w={4} d={4} fade />
      <InstancedBricks items={canopyS} w={2} d={2} fade />
      <InstancedBricks items={hills} w={8} d={8} studs={false} />
      <InstancedBricks items={floor} w={4} d={4} h={1 / 3} />
    </>
  )
}

/** Houses and decorative trees are solid. */
function useStaticColliders() {
  useEffect(() => {
    const ids: number[] = []
    const add = (x: number, z: number, r: number) => {
      const id = newId()
      colliders.set(id, { x, z, r })
      ids.push(id)
    }
    TREES.forEach((t) => add(t.x, t.z, 0.5))
    FLOOR.forEach((f) => surface.set(cellKey(f.ix, f.iz), FLOOR_TOP))
    // houses are boxes, too tall to jump onto
    const boxIds = HOUSES.map((h) => {
      const id = newId()
      const turned = Math.abs(Math.sin(h.ry)) > 0.5
      const hw = (HOUSE_W * P) / 2
      const hd = (HOUSE_D * P) / 2
      platforms.set(id, { x: h.p[0], z: h.p[2], hw: turned ? hd : hw, hd: turned ? hw : hd, top: HOUSE_LAYERS * BH })
      return id
    })
    return () => {
      ids.forEach((id) => colliders.delete(id))
      boxIds.forEach((id) => platforms.delete(id))
    }
  }, [])
}

const HOUSE_W = 14
const HOUSE_D = 10
const HOUSE_LAYERS = 6

/** A mud-brick house about twice Noah's height, with a shaded roof terrace. */
function houseBricks(c: string): StaticBrick[] {
  const front = (HOUSE_D * P) / 2
  const side = (HOUSE_W * P) / 2
  const roof = HOUSE_LAYERS * BH
  const top = roof + BH / 3
  const out: StaticBrick[] = []
  for (let k = 0; k < HOUSE_LAYERS; k++) out.push({ w: HOUSE_W, d: HOUSE_D, c: k === 0 ? COLORS.darkTan : c, p: [0, k * BH, 0] })
  // tall door with lintel, upper windows front and sides
  out.push({ w: 3, d: 1, h: 4, studs: false, c: COLORS.reddishBrown, p: [0, 0, front] })
  out.push({ w: 5, d: 1, h: 1 / 3, c: COLORS.darkTan, p: [0, 4 * BH, front + 0.05] })
  for (const x of [-1.9, 1.9]) out.push({ w: 2, d: 1, h: 1, studs: false, c: COLORS.black, p: [x, 3 * BH, front] })
  for (const sx of [-1, 1]) out.push({ w: 1, d: 2, h: 1, studs: false, c: COLORS.black, p: [sx * side, 3 * BH, 0] })
  // flat roof with parapet, typical of the ancient near east
  out.push({ w: HOUSE_W, d: HOUSE_D, h: 1 / 3, studs: false, c: COLORS.darkTan, p: [0, roof, 0] })
  out.push({ w: HOUSE_W, d: 1, c, p: [0, top, front - P / 2] })
  out.push({ w: HOUSE_W, d: 1, c, p: [0, top, -front + P / 2] })
  out.push({ w: 1, d: HOUSE_D - 2, c, p: [side - P / 2, top, 0] })
  out.push({ w: 1, d: HOUSE_D - 2, c, p: [-side + P / 2, top, 0] })
  // shaded terrace: posts and a cloth awning
  for (const [x, z] of [[-1.6, -1], [-1.6, 1], [0.8, -1], [0.8, 1]]) out.push({ w: 1, d: 1, h: 3, studs: false, c: COLORS.brown, p: [x, top, z] })
  out.push({ w: 7, d: 6, h: 1 / 3, c: COLORS.white, p: [-0.4, top + 3 * BH, 0] })
  return out
}

/** All houses plus the ark-site timber, baked into a handful of instanced draws. */
function Village() {
  const bricks = useMemo(() => {
    const out: StaticBrick[] = []
    for (const h of HOUSES) out.push(...placeBricks(houseBricks(h.c), h.p, h.ry))
    const timber: StaticBrick[] = [0, 1, 2].map((k) => ({ w: 10, d: 1, c: k % 2 ? COLORS.gopher : '#a96a31', p: [0, k * BH, (k % 2) * 0.2] }))
    out.push(...placeBricks(timber, [ARK[0] - 13.5, 0, ARK[2] - 2]))
    return out
  }, [])
  return (
    <>
      <StaticBricks bricks={bricks} fade />
      {HOUSES.map((h, i) => (
        <BlobShadow key={i} size={8} position={[h.p[0], 0.02, h.p[2]]} />
      ))}
    </>
  )
}

const CAULDRON_MODEL: ModelBrick[] = [
  { w: 1, d: 1, c: COLORS.darkGrey, p: [-0.6, 0, -0.6] },
  { w: 1, d: 1, c: COLORS.darkGrey, p: [0.6, 0, -0.6] },
  { w: 1, d: 1, c: COLORS.darkGrey, p: [-0.6, 0, 0.6] },
  { w: 1, d: 1, c: COLORS.darkGrey, p: [0.6, 0, 0.6] },
  { w: 2, d: 2, h: 1 / 3, c: COLORS.orange, p: [0, 0, 0] },
  { w: 4, d: 4, c: COLORS.darkGrey, p: [0, BH, 0] },
  { w: 4, d: 4, c: COLORS.grey, p: [0, BH * 2, 0] },
  { w: 3, d: 3, h: 1 / 3, c: COLORS.pitch, p: [0, BH * 3, 0] },
]

function arrowShape(scale: number) {
  const s = new THREE.Shape()
  s.moveTo(0, 0.55 * scale)
  s.lineTo(0.36 * scale, 0.08 * scale)
  s.lineTo(0.14 * scale, 0.08 * scale)
  s.lineTo(0.14 * scale, -0.3 * scale)
  s.lineTo(-0.14 * scale, -0.3 * scale)
  s.lineTo(-0.14 * scale, 0.08 * scale)
  s.lineTo(-0.36 * scale, 0.08 * scale)
  s.closePath()
  return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2)
}

/** Nearest registered item matching `ok`, written into `out`. No allocations. */
function nearestInto<T extends { x: number; z: number }>(items: Iterable<T>, ok: (it: T) => boolean, out: { x: number; z: number }) {
  let best = Infinity
  for (const it of items) {
    if (!ok(it)) continue
    const d = Math.hypot(it.x - player.pos.x, it.z - player.pos.z)
    if (d < best) {
      best = d
      out.x = it.x
      out.z = it.z
    }
  }
  return best < Infinity
}

const isChop = (i: { kind: string }) => i.kind === 'chop'
const any = () => true
const EDGE_MARGIN = 56

/**
 * Guidance, LEGO style: a golden beam over the next goal, a big bobbing arrow
 * at Noah's feet, and an arrow pinned to the screen edge when the goal is
 * off-screen (the DOM element lives in the HUD).
 */
function ObjectiveGuide() {
  const beam = useRef<THREE.Group>(null)
  const arrow = useRef<THREE.Group>(null)
  const { camera, size } = useThree()
  const proj = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => ({ x: 0, z: 0 }), [])
  const edgeEl = useRef<HTMLElement | null>(null)
  const geos = useMemo(() => ({ fill: arrowShape(2), outline: arrowShape(2.35) }), [])

  useFrame((state) => {
    const st = useGame.getState()
    let active = true
    const at = (p: V3) => {
      target.x = p[0]
      target.z = p[2]
    }
    switch (gatherStep(st)) {
      case 0:
        active = nearestInto(interactables.values(), isChop, target)
        break
      case 1:
        at(CAULDRON)
        break
      case 2:
        active = nearestInto(pickups.values(), any, target)
        break
      case 3:
        at(ARK)
        break
      case 4:
        at(st.carrying ? PLANK_DROP : WOODPILE)
        break
      case 5:
        at(DECK_SPOTS[Math.min(st.decks, DECK_SPOTS.length - 1)])
        break
      case 6: {
        // nearest patch still to coat
        let best = Infinity
        for (let i = 0; i < COAT_SPOTS.length; i++) {
          if (st.coatMask & (1 << i)) continue
          const d = Math.hypot(COAT_SPOTS[i][0] - player.pos.x, COAT_SPOTS[i][2] - player.pos.z)
          if (d < best) {
            best = d
            at(COAT_SPOTS[i])
          }
        }
        break
      }
      case 7:
        at(ROOF_SPOT)
        break
      case 8:
        at(DOOR_SPOT)
        break
      default:
        active = false
    }
    objective.active = active
    objective.x = target.x
    objective.z = target.z
    const tx = target.x
    const tz = target.z
    const t = state.clock.elapsedTime

    if (beam.current) {
      beam.current.visible = active
      beam.current.position.set(tx, 0, tz)
    }
    const d = Math.hypot(tx - player.pos.x, tz - player.pos.z)
    if (arrow.current) {
      arrow.current.visible = active && d > 3.2
      // float above path plates (plate + stud ≈ 0.23) so it never z-fights or hides under them
      arrow.current.position.set(player.pos.x, player.pos.y + 0.3, player.pos.z)
      // the arrow shape points along -Z at rotation 0
      arrow.current.rotation.y = Math.atan2(-(tx - player.pos.x), -(tz - player.pos.z))
      // bob outward along its direction
      arrow.current.children.forEach((c) => (c.position.z = -1.5 - Math.abs(Math.sin(t * 4)) * 0.35))
    }

    // edge indicator for off-screen goals
    edgeEl.current ??= document.getElementById('edge-arrow')
    const el = edgeEl.current
    if (el) {
      proj.set(tx, 1.5, tz).project(camera)
      const behind = proj.z > 1
      let x = (proj.x * 0.5 + 0.5) * size.width
      let y = (-proj.y * 0.5 + 0.5) * size.height
      if (behind) {
        x = size.width - x
        y = size.height - y
      }
      const off = behind || x < 0 || x > size.width || y < 0 || y > size.height
      if (!active || !off) {
        el.style.opacity = '0'
      } else {
        const cx = size.width / 2
        const cy = size.height / 2
        const ang = Math.atan2(y - cy, x - cx)
        // clamp along the ray from the centre to a margin inside the screen
        const sx = (cx - EDGE_MARGIN) / Math.max(1e-3, Math.abs(Math.cos(ang)))
        const sy = (cy - EDGE_MARGIN) / Math.max(1e-3, Math.abs(Math.sin(ang)))
        const r = Math.min(sx, sy)
        el.style.opacity = '1'
        el.style.transform = `translate(${cx + Math.cos(ang) * r}px, ${cy + Math.sin(ang) * r}px) rotate(${ang}rad)`
      }
    }
  })
  useEffect(
    () => () => {
      if (edgeEl.current) edgeEl.current.style.opacity = '0'
    },
    [],
  )
  return (
    <>
      <group ref={beam}>
        <Beam radius={0.9} height={14} position={[0, 7, 0]} color="#ffd970" intensity={0.9} />
      </group>
      <group ref={arrow}>
        <group>
          <mesh geometry={geos.outline} position={[0, 0, 0.12]} renderOrder={2}>
            <meshBasicMaterial color="#5a3c00" transparent opacity={0.55} depthWrite={false} />
          </mesh>
          <mesh geometry={geos.fill} position={[0, 0.01, 0]} renderOrder={3}>
            <meshBasicMaterial color="#ffd23f" depthWrite={false} transparent />
          </mesh>
        </group>
      </group>
    </>
  )
}

const PLATFORMS: { p: V3; levels: number }[] = [
  { p: [-4, 0, -4], levels: 1 },
  { p: [-4, 0, -5.6], levels: 2 },
]

/** Stud trails that lead the eye (start → forest, path → village) plus rewards on the crates. */
function studLayout(): PlacedStud[] {
  const out: PlacedStud[] = []
  const trail = (ax: number, az: number, bx: number, bz: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1)
      out.push({ p: [ax + (bx - ax) * k, 0.55, az + (bz - az) * k], value: 10 })
    }
  }
  trail(3.5, 2.6, 9.2, -3.4, 7)
  trail(-1.5, 2.6, -8.5, 1.4, 6)
  trail(0, -2, 0, -12, 7)
  // reward the jump: gold on the low crate, a blue stud on the tall one
  out.push({ p: [-4, 1.6, -4], value: 100 })
  out.push({ p: [-4, 2.6, -5.6], value: 1000 })
  return out
}

export function GatherScene() {
  const levelRun = useGame((s) => s.levelRun)
  return <GatherLevel key={levelRun} />
}

function GatherLevel() {
  const cauldronBuilt = useGame((s) => s.cauldronBuilt)
  const placedStuds = useMemo(studLayout, [])

  // world registries are module-level: start every run clean
  useMemo(() => clearWorld(), [])
  useEffect(() => () => clearWorld(), [])
  useStaticColliders()

  const onWood = () => {
    const st = useGame.getState()
    st.addWood()
    st.toast(t().toastWood)
  }
  const onPitch = () => {
    const st = useGame.getState()
    st.addPitch()
    st.toast(t().toastPitch)
  }

  const jarSpots = useMemo<V3[]>(
    () => [
      [CAULDRON[0] + 2.4, 0, CAULDRON[2] + 1.2],
      [CAULDRON[0] - 2.2, 0, CAULDRON[2] + 2.0],
      [CAULDRON[0] + 0.4, 0, CAULDRON[2] - 2.6],
    ],
    [],
  )

  return (
    <>
      <color attach="background" args={[FOG]} />
      <Sky top="#4f8fd8" horizon={FOG} sun="#fff1c9" sunDir={[0.5, 0.55, -0.6]} />
      <PlasticEnvironment intensity={0.5} />
      <hemisphereLight args={['#dff1ff', '#5d7a3a', 0.75]} />
      <directionalLight position={[8, 14, 6]} intensity={1.15} color="#fff3dc" />

      <Baseplate size={[140, 140]} color={COLORS.green} fog={FOG} fogNear={26} fogFar={70} />
      <Scenery />
      <Village />
      {SMASHABLES.map((s, i) => (
        <Smashable key={i} kind={s.kind} position={s.p} rotation={s.ry} />
      ))}
      {GOPHER_TREES.map((p, i) => (
        <GopherTree key={i} position={p} onWood={onWood} />
      ))}
      {PLATFORMS.map((pl, i) => (
        <CrateStack key={i} position={pl.p} levels={pl.levels} />
      ))}
      <PlacedStuds studs={placedStuds} />
      <Npcs />

      <BuildPile
        position={CAULDRON}
        model={CAULDRON_MODEL}
        radius={1.4}
        pileColors={[COLORS.darkGrey, COLORS.grey, COLORS.orange]}
        built={cauldronBuilt}
        ready={() => true}
        onBuilt={() => {
          const st = useGame.getState()
          st.setCauldronBuilt()
          st.toast(t().toastCauldron)
        }}
      >
        <Motes count={30} area={[1.2, 1.2]} height={3.5} color="#d8d8d8" size={14} rise={0.9} position={[0, BH * 3, 0]} />
      </BuildPile>
      {cauldronBuilt && jarSpots.map((p, i) => <PitchJar key={i} position={p} onCollect={onPitch} />)}

      {/* the ark site: keel, planks, decks, pitch, roof, door and the finale */}
      <ArkSite />

      <ObjectiveGuide />
      <Motes count={220} area={[56, 50]} height={6} color="#fff6c8" size={4} rise={0.12} />
      <Player start={START} />
      <PickupCollector />
      <CameraRig />
      <Effects />
    </>
  )
}
