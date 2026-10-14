import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BlobShadow, Brick, Motes } from '../../three/common'
import { BH, COLORS, brickGeometry, plastic } from '../../three/bricks'
import { Minifig, NOAH, makePose, type Look, type Pose } from '../../three/Minifig'
import { sfxFlood } from '../../game/audio'
import { ARK_REST, BOW_NOAH, OLIVE, PL } from './layout'
import { sim, since } from './sim'
import { story } from './state'
import { Elephant, Giraffe, Lion, Sheep } from './Animals'

const FLOWER_COLORS = ['#ff6fa8', '#ffd83a', '#ffffff', '#ff8a3d', '#b28dff', '#ff4b4b']
import { DOVE_AFTER } from '../../i18n/flood'

type V3 = [number, number, number]

export const DOOR_BEAT = 9
export const EXIT_BEAT = 10
export const ALTAR_BEAT = 11
export const WAVE_BEAT = 13

const ALTAR: V3 = [-4.2, 0, 4.4]
const DOOR_IN: V3 = [1.6, 0.15, 1.2]
const RAMP_END: V3 = [1.6, 0.02, 2.95]

/** A path walked at constant speed; `at` writes the position and returns the heading. */
function makePath(points: V3[]) {
  const pts = points.map((p) => new THREE.Vector3(...p))
  const lens = pts.slice(1).map((p, i) => p.distanceTo(pts[i]))
  const total = lens.reduce((a, b) => a + b, 0)
  return {
    total,
    at(dist: number, out: THREE.Vector3) {
      let d = THREE.MathUtils.clamp(dist, 0, total)
      for (let i = 0; i < lens.length; i++) {
        if (d <= lens[i] || i === lens.length - 1) {
          const k = lens[i] > 0 ? Math.min(1, d / lens[i]) : 1
          out.lerpVectors(pts[i], pts[i + 1], k)
          return Math.atan2(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z)
        }
        d -= lens[i]
      }
      return 0
    },
  }
}

const FAMILY: { look: Look; spot: V3 }[] = [
  { look: { ...NOAH, axe: false }, spot: [0.9, 0, 4.7] },
  { look: { robe: '#4a7ab8', legs: '#2f4f7a', hood: '#d9c7a5', beard: null }, spot: [0.05, 0, 5.0] },
  { look: { robe: COLORS.white, legs: COLORS.brown, hood: COLORS.reddishBrown, beard: '#5a3a1e' }, spot: [2.0, 0, 5.1] },
  { look: { robe: COLORS.orange, legs: COLORS.darkTan, hood: COLORS.black, beard: COLORS.black }, spot: [-0.9, 0, 5.4] },
  { look: { robe: COLORS.green, legs: COLORS.reddishBrown, hood: COLORS.sand, beard: '#a0522d' }, spot: [3.0, 0, 4.7] },
  { look: { robe: '#d4609a', legs: '#7a2f55', hood: '#fff1d6', beard: null }, spot: [-1.75, 0, 5.0] },
  { look: { robe: '#2fa39a', legs: '#1d5f5a', hood: '#f6e3b0', beard: null }, spot: [3.85, 0, 5.3] },
  { look: { robe: '#e6b422', legs: COLORS.brown, hood: '#8e5bb0', beard: null }, spot: [-2.5, 0, 4.6] },
]

const WALK_SPEED = 1.5

function FamilyMember({ index, look, spot }: { index: number; look: Look; spot: V3 }) {
  const ref = useRef<THREE.Group>(null)
  const pose = useRef<Pose>(makePose())
  const path = useMemo(() => makePath([DOOR_IN, RAMP_END, spot]), [spot])
  const altarPath = useMemo(() => makePath([spot, [ALTAR[0] + 0.2, 0, ALTAR[2] + 1.1]]), [spot])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const isNoah = index === 0
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    const t = since(EXIT_BEAT) - index * 0.65
    g.visible = t >= 0
    if (t < 0) return
    const dist = t * WALK_SPEED
    let heading = path.at(dist, pos)
    let moving = dist < path.total
    const p = pose.current
    p.kneel = 0
    p.raiseArms = 0
    // Noah goes to the altar and gives thanks (Genesis 8:20)
    const ta = isNoah ? since(ALTAR_BEAT) : -1
    if (ta >= 0 && !moving) {
      const ad = ta * WALK_SPEED
      heading = altarPath.at(ad, pos)
      moving = ad < altarPath.total
      if (!moving) {
        const tw = since(WAVE_BEAT)
        heading = tw >= 0 ? 0 : Math.PI
        p.kneel = tw >= 0 ? 0 : THREE.MathUtils.clamp((ta - altarPath.total / WALK_SPEED - 0.2) * 2, 0, 1)
        p.raiseArms = tw >= 0 ? 0 : p.kneel
      }
    } else if (!moving) heading = 0
    p.speed = moving ? 1 : 0
    // everyone waves at the rainbow celebration
    const tw = since(WAVE_BEAT)
    p.wave = tw >= 0 && !moving ? (Math.sin(sim.t * 0.9 + index) > -0.6 ? 1 : 0) : 0
    g.position.copy(pos)
    const diff = Math.atan2(Math.sin(heading - g.rotation.y), Math.cos(heading - g.rotation.y))
    g.rotation.y += diff * (1 - Math.exp(-dt * 8))
  })
  return (
    <group ref={ref} visible={false}>
      <Minifig pose={pose} look={look} />
      <BlobShadow size={1.1} position={[0, 0.03, 0]} />
    </group>
  )
}

const ANIMALS: { kind: 'elephant' | 'giraffe' | 'lion' | 'sheep'; spot: V3 }[] = [
  { kind: 'elephant', spot: [6.2, 0, 3.6] },
  { kind: 'elephant', spot: [7.4, 0, 4.9] },
  { kind: 'giraffe', spot: [-8.4, 0, -0.4] },
  { kind: 'giraffe', spot: [-9.0, 0, 1.3] },
  { kind: 'lion', spot: [4.6, 0, 7.2] },
  { kind: 'lion', spot: [5.8, 0, 7.9] },
  { kind: 'sheep', spot: [-3.4, 0, 7.4] },
  { kind: 'sheep', spot: [-2.3, 0, 8.0] },
]

function AnimalWalker({ index, kind, spot }: { index: number; kind: string; spot: V3 }) {
  const ref = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const side = index % 2 ? 0.45 : -0.45
  const path = useMemo(
    () => makePath([[DOOR_IN[0] + side * 0.6, DOOR_IN[1], DOOR_IN[2]], [RAMP_END[0] + side, RAMP_END[1], RAMP_END[2] + 0.4], spot]),
    [side, spot],
  )
  const pos = useMemo(() => new THREE.Vector3(), [])
  const speed = kind === 'elephant' ? 1.1 : kind === 'sheep' ? 1.5 : 1.3
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    // two by two: each pair leaves together, after the family
    const t = since(EXIT_BEAT) - 5.2 - Math.floor(index / 2) * 1.7
    g.visible = t >= 0
    if (t < 0) return
    const dist = t * speed
    const moving = dist < path.total
    let heading = path.at(dist, pos)
    if (!moving) heading = Math.atan2(-spot[0], 6 - spot[2]) * 0.5
    g.position.copy(pos)
    const diff = Math.atan2(Math.sin(heading - g.rotation.y), Math.cos(heading - g.rotation.y))
    g.rotation.y += diff * (1 - Math.exp(-dt * 6))
    if (body.current) {
      // happy bounce: a trot while walking, the odd hop of joy once out
      const bounce = moving ? Math.abs(Math.sin(dist * 5)) * 0.08 : Math.max(0, Math.sin(sim.t * 2.4 + index * 1.3)) ** 8 * 0.25
      body.current.position.y = bounce
      body.current.rotation.z = moving ? Math.sin(dist * 5) * 0.05 : 0
    }
  })
  return (
    <group ref={ref} visible={false}>
      <group ref={body}>
        {kind === 'elephant' && <Elephant />}
        {kind === 'giraffe' && <Giraffe />}
        {kind === 'lion' && <Lion />}
        {kind === 'sheep' && <Sheep />}
      </group>
      <BlobShadow size={kind === 'elephant' ? 2 : 1.4} position={[0, 0.03, 0]} />
    </group>
  )
}

const ALTAR_BRICKS: { w: number; d: number; c: string; p: V3 }[] = [
  { w: 4, d: 4, c: COLORS.darkGrey, p: [0, 0, 0] },
  { w: 2, d: 4, c: COLORS.grey, p: [-0.4, BH, 0] },
  { w: 2, d: 4, c: '#b9bdc1', p: [0.4, BH, 0] },
  { w: 4, d: 2, c: COLORS.grey, p: [0, BH * 2, -0.4] },
  { w: 4, d: 2, c: COLORS.darkGrey, p: [0, BH * 2, 0.4] },
]

/** Noah's altar: stones drop into place one by one, then a warm little fire. */
function Altar() {
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const fire = useRef<THREE.Group>(null)
  const landed = useRef(0)
  const nextCrackle = useRef(0)
  useFrame(() => {
    const t = since(ALTAR_BEAT) - 1.6
    let count = 0
    ALTAR_BRICKS.forEach((b, i) => {
      const m = refs.current[i]
      if (!m) return
      const k = THREE.MathUtils.clamp((t - i * 0.4) / 0.35, 0, 1)
      m.visible = t - i * 0.4 > 0
      m.position.y = b.p[1] + (1 - k * k) * 3
      if (k >= 1) count++
    })
    if (count > landed.current) sfxFlood.click(0.6 + count * 0.05)
    landed.current = t < 0 ? 0 : count
    const lit = t > ALTAR_BRICKS.length * 0.4 + 0.3
    if (fire.current) {
      fire.current.visible = lit
      fire.current.children.forEach((c, i) => {
        c.scale.y = 0.8 + Math.abs(Math.sin(sim.t * (7 + i * 2) + i)) * 0.6
      })
    }
    if (lit && sim.t > nextCrackle.current && story.phase !== 'end') {
      nextCrackle.current = sim.t + 1.5 + Math.random() * 2
      sfxFlood.crackle()
    }
  })
  return (
    <group position={ALTAR}>
      {ALTAR_BRICKS.map((b, i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)} geometry={brickGeometry(b.w, b.d)} material={plastic(b.c)} position={b.p} visible={false} />
      ))}
      <group ref={fire} position={[0, BH * 3 + 0.05, 0]} visible={false}>
        <mesh geometry={brickGeometry(2, 2, 1, false)} material={plastic('#ff7a1a', { emissive: 1.4 })} position={[0, 0, 0]} />
        <mesh geometry={brickGeometry(1, 1, 1, false)} material={plastic('#ffd23a', { emissive: 1.8 })} position={[0.1, 0.2, 0.05]} />
        <mesh geometry={brickGeometry(1, 1, 1, false)} material={plastic('#ffb02a', { emissive: 1.6 })} position={[-0.15, 0.1, -0.1]} />
        <pointLight color="#ffa040" intensity={4} distance={5} decay={1.6} position={[0, 0.6, 0]} />
        <Motes count={36} area={[0.6, 0.6]} height={4} color="#fff2d8" size={10} rise={0.7} position={[0, 0.5, 0]} />
      </group>
    </group>
  )
}

const FLOWERS = 260

/** The renewed earth: flowers and tufts pop up across the mesa and the plain once the door opens. */
function Flowers() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const items = useMemo(() => {
    const out: { p: V3; c: string; d: number; s: number }[] = []
    let s = 3
    const rnd = () => {
      s = (s * 16807) % 2147483647
      return s / 2147483647
    }
    while (out.length < FLOWERS) {
      const onMesa = out.length < 150
      const a = rnd() * Math.PI * 2
      const r = onMesa ? Math.sqrt(rnd()) * 8.5 : 15 + rnd() * 30
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      // keep clear of the ark and the walkway in front of the door
      if (onMesa && Math.abs(x) < 4 && z > -3.8 && z < 3.4) continue
      if (onMesa && Math.abs(x - 1.6) < 1.4 && z < 6) continue
      const grass = rnd() > 0.65
      out.push({
        p: [ARK_REST.x + x, onMesa ? PL + 0.07 : 0.02, ARK_REST.z + 2 + z],
        c: grass ? (rnd() > 0.5 ? COLORS.lime : '#59b23a') : FLOWER_COLORS[Math.floor(rnd() * FLOWER_COLORS.length)],
        d: (onMesa ? 0 : 1.2) + rnd() * 3.5,
        s: grass ? 1 : 0.9 + rnd() * 0.4,
      })
    }
    return out
  }, [])
  const obj = useMemo(() => new THREE.Object3D(), [])
  const col = useMemo(() => new THREE.Color(), [])
  const done = useRef(false)
  useEffect(() => {
    const m = ref.current
    if (!m) return
    items.forEach((it, i) => m.setColorAt(i, col.set(it.c)))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [items, col])
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const t = since(DOOR_BEAT)
    m.visible = t >= 0
    if (t < 0) {
      done.current = false
      return
    }
    if (done.current) return
    let all = true
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const k = THREE.MathUtils.clamp((t - it.d) / 0.4, 0, 1)
      if (k < 1) all = false
      const e = k === 0 ? 0.0001 : 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2)
      obj.position.set(it.p[0], it.p[1], it.p[2])
      obj.scale.setScalar(it.s * e)
      obj.updateMatrix()
      m.setMatrixAt(i, obj.matrix)
    }
    m.instanceMatrix.needsUpdate = true
    if (all) done.current = true
  })
  return <instancedMesh ref={ref} args={[brickGeometry(1, 1, 2 / 3), plastic('#ffffff'), items.length]} frustumCulled={false} visible={false} />
}

/** The olive tree on the far hill, where the dove plucks her leaf. */
export function OliveTree() {
  return (
    <group position={[OLIVE.x, OLIVE.y + 0.07, OLIVE.z]}>
      {[0, 1, 2].map((i) => (
        <Brick key={i} w={1} d={1} color={COLORS.brown} position={[0, i * BH, 0]} />
      ))}
      <Brick w={4} d={4} color="#5f7f2f" position={[0, BH * 3, 0]} />
      <Brick w={3} d={3} color="#7a9a3a" position={[0.2, BH * 4, 0.1]} />
      <Brick w={2} d={3} color="#93b44a" position={[0, BH * 5, 0.2]} />
      <Brick w={1} d={1} h={1 / 3} color="#2f3f1a" position={[0.6, BH * 4, 0.7]} studs={false} />
      <Brick w={1} d={1} h={1 / 3} color="#2f3f1a" position={[-0.6, BH * 4, -0.6]} studs={false} />
    </group>
  )
}

/** Noah at the bow, sending out the dove (child of the ark so it rides the waves). */
export function DeckNoah() {
  const ref = useRef<THREE.Group>(null)
  const pose = useRef<Pose>(makePose())
  useFrame(() => {
    const g = ref.current
    if (!g) return
    const show = (story.phase === 'storyA' && sim.beat >= DOVE_AFTER) || story.phase === 'dove' || (story.phase === 'storyB' && sim.beat <= DOVE_AFTER + 1)
    g.visible = show
    const holding = story.phase !== 'dove' || story.dove.stage === 'ready' || story.dove.stage === 'return' || story.dove.stage === 'done'
    pose.current.raiseArms = holding ? 0.85 : 0
    pose.current.wave = holding ? 0 : 1
  })
  return (
    <group ref={ref} position={BOW_NOAH.toArray() as V3} rotation={[0, -0.25, 0]} visible={false}>
      <Minifig pose={pose} look={{ ...NOAH, axe: false }} />
    </group>
  )
}

/** Everything that happens on Ararat after the flood. Positioned in the resting ark's frame. */
export function Life({ children }: { children?: ReactNode }) {
  return (
    <group position={ARK_REST.toArray() as V3}>
      {FAMILY.map((f, i) => (
        <FamilyMember key={i} index={i} look={f.look} spot={f.spot} />
      ))}
      {ANIMALS.map((a, i) => (
        <AnimalWalker key={i} index={i} kind={a.kind} spot={a.spot} />
      ))}
      <Altar />
      {children}
      <group position={[-ARK_REST.x, -ARK_REST.y, -ARK_REST.z]}>
        <Flowers />
      </group>
    </group>
  )
}
