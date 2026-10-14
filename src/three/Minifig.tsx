import { forwardRef, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { COLORS, plasticVC } from './bricks'

/** Pose inputs written by whoever drives the figure (player controller, NPC brain or cutscene). */
export type Pose = {
  speed: number // 0..1 walk blend
  airborne: boolean
  swing: number // 0..1 axe swing progress, 0 = idle
  building: boolean
  kneel: number // 0..1
  raiseArms: number // 0..1
  wave?: number // 0..1 friendly wave (NPCs)
  land?: number // 0..1 landing squash, decays
  // optional cutscene acting; leaving them unset keeps the default animation
  lookUp?: number // radians, head tilts back (negative looks down)
  headTurn?: number // radians, head yaw added to the idle sway
  shield?: number // 0..1 right hand raised to shade the eyes
  bow?: number // radians, torso leans forward
}

/**
 * Hip height that puts the feet exactly on the ground: legs hang 0.08 below
 * the hips and are 0.42 long including the foot, so 0.5. (It was 0.82, which
 * left every figure hovering a third of a unit above the floor.)
 */
const HIP_Y = 0.5

export const makePose = (): Pose => ({ speed: 0, airborne: false, swing: 0, building: false, kneel: 0, raiseArms: 0, wave: 0 })

export type Look = {
  robe: string
  legs: string
  hood: string
  /** null = no beard */
  beard: string | null
  skin?: string
  axe?: boolean
}

export const NOAH: Look = { robe: COLORS.tan, legs: COLORS.reddishBrown, hood: COLORS.darkTan, beard: COLORS.white, axe: true }

function torsoGeometry() {
  // A box with a narrower top: the classic minifig torso trapezoid.
  const g = new THREE.BoxGeometry(0.48, 0.5, 0.26)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0) pos.setX(i, pos.getX(i) * 0.8)
  }
  g.translate(0, 0.25, 0)
  return g
}

const tmpM = new THREE.Matrix4()
const tmpE = new THREE.Euler()
const tmpQ = new THREE.Quaternion()
const tmpC = new THREE.Color()

/** Clone, place, and paint a primitive so many can be merged into one mesh. */
function part(geo: THREE.BufferGeometry, color: string, pos: [number, number, number] = [0, 0, 0], rot: [number, number, number] = [0, 0, 0]) {
  const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(
    tmpM.compose(new THREE.Vector3(...pos), tmpQ.setFromEuler(tmpE.set(...rot)), new THREE.Vector3(1, 1, 1)),
  )
  tmpC.set(color)
  const n = g.attributes.position.count
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    col[i * 3] = tmpC.r
    col[i * 3 + 1] = tmpC.g
    col[i * 3 + 2] = tmpC.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

function merge(parts: THREE.BufferGeometry[]) {
  const g = mergeGeometries(parts, false)!
  g.computeVertexNormals()
  return g
}

const prim = {
  torso: torsoGeometry(),
  hips: new THREE.BoxGeometry(0.46, 0.1, 0.26).translate(0, 0.05, 0),
  leg: new THREE.BoxGeometry(0.22, 0.42, 0.28).translate(0, -0.21, 0),
  foot: new THREE.BoxGeometry(0.22, 0.1, 0.36).translate(0, -0.37, 0.04),
  arm: new THREE.CylinderGeometry(0.075, 0.085, 0.36, 8).translate(0, -0.18, 0),
  hand: new THREE.TorusGeometry(0.06, 0.035, 6, 10, Math.PI * 1.5),
  neck: new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8),
  head: new THREE.CylinderGeometry(0.16, 0.16, 0.3, 16).translate(0, 0.15, 0),
  eye: new THREE.SphereGeometry(0.025, 6, 4),
  mouth: new THREE.TorusGeometry(0.045, 0.012, 4, 8, Math.PI),
  beard: new THREE.BoxGeometry(0.3, 0.2, 0.08),
  beardTip: new THREE.ConeGeometry(0.13, 0.18, 6).rotateX(Math.PI),
  hood: new THREE.CylinderGeometry(0.19, 0.2, 0.22, 16, 1, false, Math.PI * 0.3, Math.PI * 1.4),
  hoodTop: new THREE.SphereGeometry(0.19, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  belt: new THREE.BoxGeometry(0.47, 0.06, 0.27),
  axeHandle: new THREE.CylinderGeometry(0.025, 0.025, 0.6, 6),
  axeHead: new THREE.BoxGeometry(0.06, 0.16, 0.2),
}

type Parts = { body: THREE.BufferGeometry; leg: THREE.BufferGeometry; armL: THREE.BufferGeometry; armR: THREE.BufferGeometry; head: THREE.BufferGeometry }
const partsCache = new Map<string, Parts>()

/** Six merged, vertex-coloured meshes per figure (one shared material) instead of ~20. */
function buildParts(look: Look): Parts {
  const key = JSON.stringify(look)
  const hit = partsCache.get(key)
  if (hit) return hit
  const skin = look.skin ?? COLORS.skin
  const body = merge([
    part(prim.hips, look.legs, [0, -0.1, 0]),
    part(prim.torso, look.robe),
    part(prim.belt, COLORS.brown, [0, 0.06, 0]),
    part(prim.neck, skin, [0, 0.52, 0]),
  ])
  const leg = merge([part(prim.leg, look.legs), part(prim.foot, look.legs)])
  const handPos: [number, number, number] = [0, -0.4, 0.03]
  const handRot: [number, number, number] = [Math.PI / 2, 0, 0]
  const armL = merge([part(prim.arm, look.robe), part(prim.hand, skin, handPos, handRot)])
  const armRParts = [part(prim.arm, look.robe), part(prim.hand, skin, handPos, handRot)]
  if (look.axe) {
    // axe held in the right hand: handle along the forearm's forward axis
    const grip = new THREE.Matrix4().compose(new THREE.Vector3(0, -0.4, 0.05), tmpQ.setFromEuler(tmpE.set(Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1))
    armRParts.push(part(prim.axeHandle, COLORS.brown, [0, 0.15, 0]).applyMatrix4(grip))
    armRParts.push(part(prim.axeHead, COLORS.grey, [0, 0.4, 0.08]).applyMatrix4(grip))
  }
  const armR = merge(armRParts)
  const headParts = [
    part(prim.head, skin),
    part(prim.eye, COLORS.black, [-0.06, 0.19, 0.15]),
    part(prim.eye, COLORS.black, [0.06, 0.19, 0.15]),
    part(prim.hood, look.hood, [0, 0.2, 0]),
    part(prim.hoodTop, look.hood, [0, 0.3, 0]),
  ]
  if (look.beard) {
    headParts.push(part(prim.beard, look.beard, [0, 0.06, 0.13]))
    headParts.push(part(prim.beardTip, look.beard, [0, -0.11, 0.14]))
  } else {
    headParts.push(part(prim.mouth, COLORS.black, [0, 0.1, 0.158], [0, 0, Math.PI]))
  }
  const parts = { body, leg, armL, armR, head: merge(headParts) }
  partsCache.set(key, parts)
  return parts
}

export type MinifigProps = {
  pose: React.MutableRefObject<Pose>
  look?: Look
  position?: [number, number, number]
  rotation?: [number, number, number]
}

/** A classic minifigure, ~1.5 units tall, origin at the feet. */
export const Minifig = forwardRef<THREE.Group, MinifigProps>(function Minifig({ pose, look = NOAH, position, rotation }, ref) {
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const phase = useRef(0)
  const parts = useMemo(() => buildParts(look), [look])
  const mat = plasticVC()

  useFrame((state, dt) => {
    const p = pose.current
    const t = state.clock.elapsedTime
    phase.current += dt * (6 + p.speed * 8) * (p.speed > 0.05 ? 1 : 0)
    const walk = Math.sin(phase.current) * 0.8 * p.speed
    let lL = walk
    let lR = -walk
    let aL = -walk * 0.8
    let aR = walk * 0.8
    let aRz = 0
    let bodyY = HIP_Y
    let squash = 1
    let bodyRx = 0
    if (p.airborne) {
      lL = -0.6
      lR = 0.4
      aL = -2.4
      aR = -2.4
    }
    if (p.building) {
      // the bouncy two-handed LEGO build animation
      const b = Math.sin(t * 18)
      aL = -1.4 + b * 0.5
      aR = -1.4 - b * 0.5
      bodyY += Math.abs(Math.sin(t * 9)) * 0.06
    }
    if (p.swing > 0) {
      // wind up then chop
      const s = p.swing
      aR = s < 0.35 ? THREE.MathUtils.lerp(0, -2.6, s / 0.35) : THREE.MathUtils.lerp(-2.6, -0.3, Math.min(1, (s - 0.35) / 0.25))
      bodyRx = s < 0.35 ? -0.1 : 0.15
    }
    if (p.wave && p.wave > 0) {
      aR = THREE.MathUtils.lerp(aR, -2.8 + Math.sin(t * 10) * 0.25, p.wave)
      aRz = 0.3 * p.wave
    }
    if (p.kneel > 0) {
      lL = THREE.MathUtils.lerp(lL, -1.5, p.kneel)
      lR = THREE.MathUtils.lerp(lR, -1.5, p.kneel)
      bodyY = THREE.MathUtils.lerp(bodyY, HIP_Y - 0.3, p.kneel)
    }
    if (p.raiseArms > 0) {
      aL = THREE.MathUtils.lerp(aL, -2.7, p.raiseArms)
      aR = THREE.MathUtils.lerp(aR, -2.7, p.raiseArms)
      aRz = 0.25 * p.raiseArms
    }
    if (p.shield && p.shield > 0) {
      aR = THREE.MathUtils.lerp(aR, -2.55, p.shield)
      aRz = THREE.MathUtils.lerp(aRz, -0.62, p.shield)
    }
    if (p.bow) bodyRx += p.bow
    const k = 1 - Math.exp(-dt * 18)
    if (legL.current) legL.current.rotation.x += (lL - legL.current.rotation.x) * k
    if (legR.current) legR.current.rotation.x += (lR - legR.current.rotation.x) * k
    if (armL.current) {
      armL.current.rotation.x += (aL - armL.current.rotation.x) * k
      armL.current.rotation.z = -0.12 - (p.raiseArms > 0 ? aRz : 0)
    }
    if (armR.current) {
      armR.current.rotation.x += (aR - armR.current.rotation.x) * (p.swing > 0 ? 1 - Math.exp(-dt * 40) : k)
      armR.current.rotation.z = 0.12 + aRz
    }
    if (p.land && p.land > 0) {
      squash = 1 - p.land * 0.18
      bodyY -= p.land * 0.08
      p.land = Math.max(0, p.land - dt * 5)
    }
    if (body.current) {
      body.current.scale.set(1 + (1 - squash) * 0.6, squash, 1 + (1 - squash) * 0.6)
      body.current.position.y += (bodyY - body.current.position.y) * k
      body.current.rotation.x += (bodyRx - body.current.rotation.x) * k
    }
    if (head.current) {
      head.current.rotation.y = Math.sin(t * 0.7) * 0.08 * (1 - p.speed) + (p.headTurn ?? 0)
      head.current.rotation.x += (-(p.lookUp ?? 0) - head.current.rotation.x) * k
    }
  })

  return (
    <group ref={ref} position={position} rotation={rotation}>
      <group ref={body} position={[0, HIP_Y, 0]}>
        <mesh geometry={parts.body} material={mat} />
        <group ref={legL} position={[-0.115, -0.08, 0]}>
          <mesh geometry={parts.leg} material={mat} />
        </group>
        <group ref={legR} position={[0.115, -0.08, 0]}>
          <mesh geometry={parts.leg} material={mat} />
        </group>
        <group ref={armL} position={[-0.25, 0.43, 0]}>
          <mesh geometry={parts.armL} material={mat} />
        </group>
        <group ref={armR} position={[0.25, 0.43, 0]}>
          <mesh geometry={parts.armR} material={mat} />
        </group>
        <group ref={head} position={[0, 0.54, 0]}>
          <mesh geometry={parts.head} material={mat} />
        </group>
      </group>
    </group>
  )
})
