import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Brick } from '../../three/common'
import { BH, COLORS, brickGeometry, plastic } from '../../three/bricks'
import { Motes } from '../../three/common'
import { input } from '../../game/input'
import { sfxFlood } from '../../game/audio'
import { ARK_REST, BOW_NOAH, OLIVE } from './layout'
import { sim } from './sim'
import { setDoveStage, setPhase, story, useFlood } from './state'
import { DOVE_AFTER } from '../../i18n/flood'

const FLY_SECONDS = 16
const FOUND_SECONDS = 2.4
const RETURN_SECONDS = 3.4
/** Auto-release so a child who just watches still sees the whole story. */
const AUTO_RELEASE = 9

/** Where the dove perches: Noah's raised hands at the bow (world space; the ark is at rest by now). */
export const PERCH = new THREE.Vector3(ARK_REST.x + BOW_NOAH.x, ARK_REST.y + BOW_NOAH.y + 1.55, ARK_REST.z + BOW_NOAH.z + 0.45)
export const TREE_TOP = new THREE.Vector3(OLIVE.x, OLIVE.y + BH * 6 + 0.3, OLIVE.z + 0.2)

const PATH = new THREE.CatmullRomCurve3(
  [
    PERCH.clone(),
    PERCH.clone().add(new THREE.Vector3(-1.5, 3, -2)),
    new THREE.Vector3(-5, 9.5, -5),
    new THREE.Vector3(-12, 10, -8),
    new THREE.Vector3(-20, 9, -9),
    new THREE.Vector3(-28, 7.5, -6),
    TREE_TOP.clone().add(new THREE.Vector3(2.5, 2.2, 2.5)),
    TREE_TOP.clone(),
  ],
  false,
  'centripetal',
)

const EYE = new THREE.SphereGeometry(0.045, 8, 6)

const STAR_U = [0.13, 0.19, 0.25, 0.31, 0.37, 0.43, 0.49, 0.55, 0.61, 0.67, 0.73, 0.79]
const STAR_X = [0, 1.4, 2.2, 1.2, 0, -1.3, -2.2, -1.2, 0, 1.3, 2.0, 0.6]
const STAR_Y = [0, 0.7, 1.2, 0.6, 0, -0.6, -1.0, -0.4, 0, 0.8, 1.1, 0.4]
const STEER_X = 2.6
const STEER_Y = 1.6
const UP = new THREE.Vector3(0, 1, 0)

/** Frame (tangent, right, up) of the flight path at `u`, without allocating. */
function frameAt(u: number, pos: THREE.Vector3, fwd: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3) {
  PATH.getPointAt(u, pos)
  PATH.getTangentAt(u, fwd)
  right.crossVectors(fwd, UP).normalize()
  up.crossVectors(right, fwd).normalize()
}

const STARS = (() => {
  const p = new THREE.Vector3()
  const f = new THREE.Vector3()
  const r = new THREE.Vector3()
  const u = new THREE.Vector3()
  return STAR_U.map((su, i) => {
    frameAt(su, p, f, r, u)
    return p.clone().addScaledVector(r, STAR_X[i]).addScaledVector(u, STAR_Y[i])
  })
})()

export function DoveModel({ wings, leaf }: { wings: RefObject<THREE.Group[]>; leaf: RefObject<THREE.Mesh | null> }) {
  return (
    <group scale={0.85}>
      <Brick w={1} d={2} h={2 / 3} color={COLORS.white} position={[0, -0.16, 0]} studs={false} />
      <Brick w={1} d={1} color={COLORS.white} position={[0, 0.0, 0.32]} studs={false} />
      <Brick w={1} d={1} h={1 / 3} color={COLORS.orange} position={[0, 0.12, 0.52]} studs={false} />
      {[-1, 1].map((e) => (
        <mesh key={e} geometry={EYE} material={plastic(COLORS.black)} position={[e * 0.205, 0.3, 0.38]} />
      ))}
      <Brick w={2} d={1} h={1 / 3} color="#e9eef2" position={[0, -0.02, -0.5]} studs={false} />
      {[-1, 1].map((s, i) => (
        <group
          key={s}
          ref={(g) => {
            if (g && wings.current) wings.current[i] = g
          }}
          position={[s * 0.2, 0.08, 0.02]}
        >
          <Brick w={2} d={2} h={1 / 3} color={COLORS.white} position={[s * 0.4, 0, 0]} studs={false} />
          <Brick w={1} d={1} h={1 / 3} color="#dfe6ec" position={[s * 0.85, 0, -0.1]} studs={false} />
        </group>
      ))}
      <mesh ref={leaf} geometry={brickGeometry(1, 2, 1 / 3, false)} material={plastic('#5f9e2f')} position={[0.14, 0.08, 0.72]} rotation={[0.2, 0.5, 0.3]} scale={1.5} visible={false} />
    </group>
  )
}

/**
 * The dove: perches on Noah, then (dove phase) follows the flight path to the
 * olive tree while the player nudges it up/down/left/right to collect stars.
 * Progress along the path is automatic, so it can't be failed or stalled.
 */
export function Dove() {
  const group = useRef<THREE.Group>(null)
  const wings = useRef<THREE.Group[]>([])
  const leaf = useRef<THREE.Mesh>(null)
  const starsRef = useRef<THREE.InstancedMesh>(null)
  const treeGlow = useRef<THREE.Group>(null)
  const collected = useRef<boolean[]>(STARS.map(() => false))
  const st = useRef({ u: 0, ox: 0, oy: 0, stageT: 0, stage: 'ready' as string, flap: 0, lastOx: 0, nextCoo: 2 })
  const v = useMemo(
    () => ({ p: new THREE.Vector3(), f: new THREE.Vector3(), r: new THREE.Vector3(), up: new THREE.Vector3(), tmp: new THREE.Vector3(), look: new THREE.Vector3(), from: new THREE.Vector3(-12, 9, -12) }),
    [],
  )
  const obj = useMemo(() => new THREE.Object3D(), [])
  const run = useFlood((s) => s.run)

  useEffect(() => {
    collected.current = STARS.map(() => false)
    st.current.u = 0
    const m = starsRef.current
    if (!m) return
    STARS.forEach((p, i) => {
      obj.position.copy(p)
      obj.scale.setScalar(1)
      obj.updateMatrix()
      m.setMatrixAt(i, obj.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  }, [run, obj])

  useFrame((_, rawDt) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(rawDt, sim.maxDt)
    const s = st.current
    const d = story.dove
    const inDove = story.phase === 'dove'
    const beat = sim.beat
    // reset the flight whenever we're before the dove moment
    if (story.phase === 'storyA') {
      s.u = 0
      s.ox = s.oy = 0
      s.stage = 'ready'
      s.stageT = 0
    }
    if (inDove && d.stage !== s.stage) {
      s.stage = d.stage
      s.stageT = 0
    }
    s.stageT += dt
    let flapSpeed = 0
    let showLeaf = false
    g.visible = (story.phase === 'storyA' && beat >= DOVE_AFTER) || inDove || story.phase === 'storyB' || story.phase === 'end'

    // Noah's hands ride with the ark (it may still be settling when the dove appears)
    v.tmp.set(sim.ark.pos.x + BOW_NOAH.x, sim.ark.pos.y + BOW_NOAH.y + 1.55, sim.ark.pos.z + BOW_NOAH.z + 0.45)
    if (inDove && d.stage === 'ready') {
      // perched, a little hop now and then
      g.position.copy(v.tmp)
      g.position.y += Math.max(0, Math.sin(sim.t * 3)) * 0.06
      g.rotation.set(0, 0.6, 0)
      // ignore a release in the first moment so the tap that ended the dialogue doesn't fire it
      if (d.release && s.stageT < 0.8) d.release = false
      if (d.release || s.stageT > AUTO_RELEASE) {
        d.release = false
        sfxFlood.flap()
        sfxFlood.coo()
        setDoveStage('fly')
      }
    } else if (inDove && d.stage === 'fly') {
      flapSpeed = 14
      s.u = Math.min(1, s.u + dt / FLY_SECONDS)
      // keyboard nudges the target; pointer input writes tx/ty directly
      if (input.keyX || input.keyY) {
        d.tx = THREE.MathUtils.clamp(d.tx + input.keyX * dt * 2.2, -1, 1)
        d.ty = THREE.MathUtils.clamp(d.ty - input.keyY * dt * 2.2, -1, 1)
        d.idle = 0
      } else {
        d.idle += dt
        // hands off for a while: glide back to the middle
        if (d.idle > 2.5) {
          d.tx *= Math.exp(-dt * 0.8)
          d.ty *= Math.exp(-dt * 0.8)
        }
      }
      const k = 1 - Math.exp(-dt * 3.5)
      s.lastOx = s.ox
      s.ox += (d.tx * STEER_X - s.ox) * k
      s.oy += (d.ty * STEER_Y - s.oy) * k
      const env = THREE.MathUtils.smoothstep(s.u, 0, 0.07) * (1 - THREE.MathUtils.smoothstep(s.u, 0.84, 0.96))
      frameAt(s.u, v.p, v.f, v.r, v.up)
      g.position.copy(v.p).addScaledVector(v.r, s.ox * env).addScaledVector(v.up, s.oy * env)
      v.look.copy(g.position).add(v.f)
      g.lookAt(v.look)
      g.rotateZ(THREE.MathUtils.clamp(-(s.ox - s.lastOx) / Math.max(dt, 1e-3) * 0.25, -0.6, 0.6))
      sim.dove.fwd.copy(v.f)
      // stars
      const m = starsRef.current
      for (let i = 0; i < STARS.length; i++) {
        if (collected.current[i]) continue
        if (STARS[i].distanceToSquared(g.position) < 1.25) {
          collected.current[i] = true
          const n = useFlood.getState().stars
          useFlood.setState({ stars: n + 1 })
          sfxFlood.star(n)
          if (m) {
            obj.position.copy(STARS[i])
            obj.scale.setScalar(0)
            obj.updateMatrix()
            m.setMatrixAt(i, obj.matrix)
            m.instanceMatrix.needsUpdate = true
          }
        }
      }
      if (s.u >= 1) {
        sfxFlood.leaf()
        setDoveStage('found')
      }
    } else if (inDove && d.stage === 'found') {
      flapSpeed = 6
      showLeaf = s.stageT > 0.5
      g.position.copy(TREE_TOP)
      g.position.y += 0.15 + Math.sin(sim.t * 4) * 0.05
      g.rotation.set(0, Math.PI * 0.25, 0)
      if (s.stageT > 0.6 && s.stageT - dt <= 0.6) sfxFlood.coo()
      if (s.stageT > FOUND_SECONDS) setDoveStage('return')
    } else if (inDove && d.stage === 'return') {
      flapSpeed = 12
      showLeaf = true
      const k = Math.min(1, s.stageT / RETURN_SECONDS)
      const e = k * k * (3 - 2 * k)
      g.position.lerpVectors(v.from, PERCH, e)
      g.position.y += Math.sin(k * Math.PI) * 2
      v.look.copy(PERCH).sub(v.from).add(g.position)
      g.lookAt(v.look)
      if (k >= 1) {
        sfxFlood.coo()
        setDoveStage('done')
        setPhase('storyB', DOVE_AFTER + 1)
      }
    } else if (story.phase === 'storyA' || beat <= DOVE_AFTER + 1) {
      // perched on Noah (before release, and back home with the leaf)
      g.position.copy(v.tmp)
      g.rotation.set(0, story.phase === 'storyA' ? 0.6 : -0.4, 0)
      showLeaf = story.phase !== 'storyA'
      flapSpeed = story.phase === 'storyA' ? 0 : Math.max(0, 1 - sim.t % 3) * 10
    } else {
      // free again: circling above the family and the ark
      flapSpeed = 10
      const a = sim.t * 0.5
      g.position.set(ARK_REST.x + 1 + Math.cos(a) * 4.5, ARK_REST.y + 6 + Math.sin(a * 2) * 0.6, ARK_REST.z + 3 + Math.sin(a) * 3.5)
      v.look.set(-Math.sin(a), 0, Math.cos(a)).add(g.position)
      g.lookAt(v.look)
      g.rotateZ(-0.3)
      if (sim.t > s.nextCoo) {
        s.nextCoo = sim.t + 6 + Math.random() * 6
        if (story.phase !== 'end' || Math.random() > 0.5) sfxFlood.coo()
      }
    }
    sim.dove.pos.copy(g.position)
    sim.dove.u = s.u
    s.flap += dt * flapSpeed
    const wingA = flapSpeed > 0 ? Math.sin(s.flap) * 0.9 : 1.25
    if (wings.current[0]) wings.current[0].rotation.z = wingA
    if (wings.current[1]) wings.current[1].rotation.z = -wingA
    if (leaf.current) leaf.current.visible = showLeaf
    if (treeGlow.current) treeGlow.current.visible = inDove
    if (starsRef.current) {
      starsRef.current.visible = inDove && (d.stage === 'fly' || d.stage === 'ready')
    }
  })

  const starMat = useMemo(() => plastic('#ffd84a', { emissive: 1.2, rough: 0.2 }), [])
  const starGeo = useMemo(() => {
    const g = new THREE.OctahedronGeometry(0.3, 0)
    return g
  }, [])
  // spin every star about its own centre by turning the shared 6-vertex geometry (only while shown)
  useFrame((_, dt) => {
    if (starsRef.current?.visible) starGeo.rotateY(Math.min(dt, 0.1) * 2)
  })

  return (
    <>
      <group ref={group}>
        <DoveModel wings={wings} leaf={leaf} />
      </group>
      <instancedMesh ref={starsRef} args={[starGeo, starMat, STARS.length]} frustumCulled={false} visible={false} />
      <group ref={treeGlow} visible={false}>
        <Motes count={50} area={[2.5, 2.5]} height={3} color="#fff3b0" size={8} rise={0.6} position={[TREE_TOP.x, TREE_TOP.y - 1.5, TREE_TOP.z]} />
      </group>
    </>
  )
}

/** Path-cloud puffs along the flight so the dove flies through soft white brick clouds. */
export function FlightClouds() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const puffs = useMemo(() => {
    const out: THREE.Matrix4[] = []
    const p = new THREE.Vector3()
    const f = new THREE.Vector3()
    const r = new THREE.Vector3()
    const u = new THREE.Vector3()
    const o = new THREE.Object3D()
    let s = 5
    const rnd = () => {
      s = (s * 16807) % 2147483647
      return s / 2147483647
    }
    for (let i = 0; i < 26; i++) {
      const at = 0.1 + (i / 26) * 0.72
      frameAt(at, p, f, r, u)
      const side = (i % 2 ? 1 : -1) * (5 + rnd() * 5)
      o.position.copy(p).addScaledVector(r, side).addScaledVector(u, -2.5 + rnd() * 2)
      o.rotation.set(0, rnd() * Math.PI, 0)
      o.scale.setScalar(1 + rnd() * 0.8)
      o.updateMatrix()
      out.push(o.matrix.clone())
    }
    return out
  }, [])
  const mat = useMemo(() => plastic('#ffffff', { rough: 0.7 }), [])
  useEffect(() => {
    const m = ref.current
    if (!m) return
    puffs.forEach((mx, i) => m.setMatrixAt(i, mx))
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [puffs])
  useFrame(() => {
    if (ref.current) ref.current.visible = story.phase === 'dove'
  })
  return <instancedMesh ref={ref} args={[brickGeometry(4, 2), mat, puffs.length]} visible={false} />
}

