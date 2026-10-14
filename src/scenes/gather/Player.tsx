import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Minifig, makePose } from '../../three/Minifig'
import { BlobShadow } from '../../three/common'
import { occlusion } from '../../three/bricks'
import { consumePresses, input, moveVector } from '../../game/input'
import { BOUNDS, camFx, colliders, interactables, objective, platforms, player, surfaceHeight, type Interactable } from '../../game/world'
import { fx } from '../../three/Effects'
import { sfx } from '../../game/audio'
import { t, useGame, type PromptKind } from '../../store'
import { buildLabels, camCine } from './gatherState'

const SPEED = 5.2
const ACCEL = 16 // ground
const AIR_ACCEL = 7 // less steering in the air
const GRAVITY = 30
const FALL_MULT = 1.65 // fall faster than you rise: snappier, less floaty
const MAX_FALL = 22
const JUMP_V = 9.2
const JUMP_CUT = 0.45 // releasing jump early while rising cuts the hop short
const COYOTE = 0.1 // can still jump just after walking off a ledge
const BUFFER = 0.12 // a jump pressed just before landing still fires
const REACH = 1.1
const SWING_TIME = 0.32
const STEP = 0.3 // ledges lower than this are walked onto
const BODY_R = 0.35
const LEDGE = 0.22

/**
 * Floor height under (x, z) for a body at height y: raised floor plates,
 * platforms, and the top of any low obstacle (crate, bush, stump...) that is
 * no higher than a step above y.
 */
function groundAt(x: number, z: number, y: number) {
  let g = surfaceHeight(x, z)
  for (const p of platforms.values()) {
    if (Math.abs(x - p.x) < p.hw + LEDGE && Math.abs(z - p.z) < p.hd + LEDGE && p.top <= y + STEP && p.top > g) g = p.top
  }
  for (const c of colliders.values()) {
    if (c.top === undefined || c.top > y + STEP || c.top <= g) continue
    const dx = x - c.x
    const dz = z - c.z
    // generous: landing with part of the foot over the edge still counts
    if (dx * dx + dz * dz < (c.r + LEDGE) * (c.r + LEDGE)) g = c.top
  }
  return g
}

/** Push out of anything taller than our feet. Two passes so corners resolve. */
function resolveSides() {
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders.values()) {
      if (c.top !== undefined && player.pos.y >= c.top - STEP) continue
      const dx = player.pos.x - c.x
      const dz = player.pos.z - c.z
      const min = c.r + BODY_R
      const d2 = dx * dx + dz * dz
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2)
        player.pos.x = c.x + (dx / d) * min
        player.pos.z = c.z + (dz / d) * min
        // kill velocity into the obstacle so we slide along it
        const nx = dx / d
        const nz = dz / d
        const into = player.vel.x * nx + player.vel.z * nz
        if (into < 0) {
          player.vel.x -= into * nx
          player.vel.z -= into * nz
        }
      }
    }
    for (const p of platforms.values()) {
      if (player.pos.y >= p.top - STEP) continue
      const ox = p.hw + BODY_R - Math.abs(player.pos.x - p.x)
      const oz = p.hd + BODY_R - Math.abs(player.pos.z - p.z)
      if (ox > 0 && oz > 0) {
        if (ox < oz) {
          player.pos.x += Math.sign(player.pos.x - p.x) * ox
          player.vel.x = 0
        } else {
          player.pos.z += Math.sign(player.pos.z - p.z) * oz
          player.vel.z = 0
        }
      }
    }
  }
}

/**
 * Noah's controller: camera-relative movement on the XZ plane, double jump,
 * circle and box collision, platforms to hop onto, and contextual action
 * (tap = chop/smash, hold = build) like the LEGO games.
 */
export function Player({ start }: { start: [number, number, number] }) {
  const group = useRef<THREE.Group>(null)
  const shadow = useRef<THREE.Group>(null)
  const pose = useRef(makePose())
  const jumps = useRef(0)
  const jumpBuffer = useRef(0)
  const coyote = useRef(0)
  const cut = useRef(false)
  const visualY = useRef(0)
  const swingHit = useRef<Interactable | null>(null)
  const buildTick = useRef(0)

  useEffect(() => {
    player.pos.set(...start)
    player.vel.set(0, 0, 0)
    player.facing = Math.PI
    player.grounded = true
    player.swingT = 0
  }, [start])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const store = useGame.getState()
    const g = group.current
    if (!g) return
    // the level is won: Noah stops and celebrates
    const locked = store.arkComplete

    // --- movement (camera looks down -Z, so stick up = -Z) ---
    const [mx, my] = locked ? [0, 0] : moveVector()
    const building = player.building
    const targetVx = building ? 0 : mx * SPEED
    const targetVz = building ? 0 : my * SPEED
    const a = 1 - Math.exp(-dt * (player.grounded ? ACCEL : AIR_ACCEL))
    player.vel.x += (targetVx - player.vel.x) * a
    player.vel.z += (targetVz - player.vel.z) * a

    // --- jumping: buffer + coyote time + double jump + variable height ---
    if (input.jumpPressed && !building && !locked) jumpBuffer.current = BUFFER
    else jumpBuffer.current = Math.max(0, jumpBuffer.current - dt)
    coyote.current = player.grounded ? COYOTE : Math.max(0, coyote.current - dt)
    if (jumpBuffer.current > 0) {
      const fromGround = player.grounded || coyote.current > 0
      if (fromGround || jumps.current < 2) {
        player.vel.y = fromGround ? JUMP_V : JUMP_V * 0.85
        jumps.current = fromGround ? 1 : 2
        player.grounded = false
        coyote.current = 0
        jumpBuffer.current = 0
        cut.current = false
        sfx.jump()
      }
    }
    if (!input.jumpDown && player.vel.y > 0 && !cut.current && !player.grounded) {
      player.vel.y *= JUMP_CUT
      cut.current = true
    }
    player.vel.y -= GRAVITY * (player.vel.y < 0 ? FALL_MULT : 1) * dt
    player.vel.y = Math.max(player.vel.y, -MAX_FALL)
    const fallSpeed = -player.vel.y
    player.pos.addScaledVector(player.vel, dt)

    resolveSides()
    player.pos.x = THREE.MathUtils.clamp(player.pos.x, BOUNDS.minX, BOUNDS.maxX)
    player.pos.z = THREE.MathUtils.clamp(player.pos.z, BOUNDS.minZ, BOUNDS.maxZ)

    const ground = groundAt(player.pos.x, player.pos.z, player.pos.y)
    if (player.pos.y <= ground) {
      if (!player.grounded) {
        // landing: squash and a puff of dust if it was a real fall
        if (fallSpeed > 6) {
          pose.current.land = Math.min(1, fallSpeed / 16)
          fx.puff(player.pos.x, ground, player.pos.z)
        }
        jumps.current = 0
      }
      player.pos.y = ground
      player.vel.y = 0
      player.grounded = true
    } else if (player.grounded && player.pos.y - ground > STEP) {
      // walked off a ledge (coyote time still allows a jump)
      player.grounded = false
      jumps.current = 1
    } else if (player.grounded) {
      // small step down (e.g. off a floor plate): stick to the ground
      player.pos.y = ground
    }

    const planar = Math.hypot(player.vel.x, player.vel.z)
    if (planar > 0.3) {
      const want = Math.atan2(player.vel.x, player.vel.z)
      let diff = want - player.facing
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      player.facing += diff * (1 - Math.exp(-dt * 14))
    }

    // --- contextual interaction ---
    let nearest: Interactable | null = null
    let best = Infinity
    for (const it of interactables.values()) {
      const d = Math.hypot(player.pos.x - it.x, player.pos.z - it.z) - it.r
      if (d < REACH && d < best) {
        best = d
        nearest = it
      }
    }

    const s = t()
    let prompt: string | null = null
    let kind: PromptKind = null
    let progress: number | null = null
    player.building = false
    if (nearest && !locked && player.pos.y - groundAt(player.pos.x, player.pos.z, 0) < 0.5) {
      kind = nearest.kind
      if (nearest.kind === 'build') {
        const ready = nearest.ready ? nearest.ready() : true
        const lbl = buildLabels.get(nearest.id)
        prompt = ready ? lbl?.ready?.() || s.promptBuild : lbl?.need?.() || s.promptNeedMaterials
        if (ready && input.actionDown && player.grounded && nearest.build) {
          player.building = true
          // face the build
          player.facing = Math.atan2(nearest.x - player.pos.x, nearest.z - player.pos.z)
          progress = nearest.build(dt)
          buildTick.current -= dt
          if (buildTick.current <= 0) {
            sfx.buildTick()
            buildTick.current = 0.09
          }
        }
      } else {
        prompt = nearest.kind === 'chop' ? s.promptChop : s.promptSmash
        if (input.actionPressed && player.swingT <= 0) {
          player.swingT = SWING_TIME
          swingHit.current = nearest
          player.facing = Math.atan2(nearest.x - player.pos.x, nearest.z - player.pos.z)
        }
      }
    } else if (input.actionPressed && player.swingT <= 0 && !locked) {
      // swing at the air: still feels responsive
      player.swingT = SWING_TIME
      swingHit.current = null
    }

    if (player.swingT > 0) {
      const before = player.swingT
      player.swingT -= dt
      // the blow lands at ~45% of the swing
      if (before > SWING_TIME * 0.55 && player.swingT <= SWING_TIME * 0.55 && swingHit.current) {
        const target = swingHit.current
        swingHit.current = null
        if (interactables.has(target.id)) target.hit?.()
      }
    }

    store.setPrompt(prompt, kind)
    store.setBuildProgress(progress)
    consumePresses()

    // --- drive the minifig ---
    // ease small step-ups so stepping onto a plate doesn't pop
    visualY.current = player.grounded ? visualY.current + (player.pos.y - visualY.current) * (1 - Math.exp(-dt * 25)) : player.pos.y
    g.position.set(player.pos.x, visualY.current, player.pos.z)
    g.rotation.y = player.facing
    pose.current.speed = Math.min(1, planar / SPEED)
    pose.current.airborne = !player.grounded
    pose.current.building = player.building
    pose.current.swing = player.swingT > 0 ? 1 - player.swingT / SWING_TIME : 0
    pose.current.raiseArms += ((locked ? 1 : 0) - pose.current.raiseArms) * (1 - Math.exp(-dt * 6))
    if (shadow.current) {
      shadow.current.position.set(player.pos.x, ground + 0.03, player.pos.z)
      shadow.current.scale.setScalar(1.1 / (1 + (player.pos.y - ground) * 0.25))
    }
  })

  return (
    <>
      <Minifig ref={group} pose={pose} />
      <group ref={shadow}>
        <BlobShadow size={1.1} position={[0, 0, 0]} />
      </group>
    </>
  )
}

const OFFSET = new THREE.Vector3(0, 8.2, 9.8)
const BUILD_OFFSET = new THREE.Vector3(0, 9.5, 6.5) // higher and steeper so Noah doesn't hide the build
const INTRO = 3.4
const CINE_DIR = new THREE.Vector3(0.38, 0.55, 1).normalize() // a three-quarter view shows the prow

/**
 * Fixed-angle follow camera in the style of the LEGO games: it never spins
 * with the player, eases after them with a little look-ahead, opens the level
 * with a short pan to the first goal, and shakes on big moments. It also
 * feeds Noah's screen position to the see-through scenery material.
 */
export function CameraRig() {
  const { camera, size, gl } = useThree()
  const focus = useRef(new THREE.Vector3())
  const want = useRef(new THREE.Vector3())
  const offset = useRef(new THREE.Vector3().copy(OFFSET))
  const tmp = useRef(new THREE.Vector3())
  const buf = useRef(new THREE.Vector2())
  const initialised = useRef(false)

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const cam = camera as THREE.PerspectiveCamera
    const portrait = size.width < size.height
    // portrait phones: widen the lens rather than just backing away
    const fov = portrait ? 62 : 45
    if (cam.fov !== fov) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }
    const dist = portrait ? 1.15 : 1

    // follow target with look-ahead
    tmp.current.set(player.pos.x + player.vel.x * 0.35, 0.8 + player.pos.y * 0.5, player.pos.z + player.vel.z * 0.25)

    // intro: glide to the first objective and back, skipped as soon as Noah moves
    if (camFx.introT < INTRO) {
      camFx.introT += dt
      if (Math.hypot(player.vel.x, player.vel.z) > 0.5) camFx.introT = INTRO
      if (objective.active) {
        const k = camFx.introT / INTRO
        const w = k < 0.35 ? THREE.MathUtils.smoothstep(k, 0, 0.35) : k < 0.7 ? 1 : 1 - THREE.MathUtils.smoothstep(k, 0.7, 1)
        tmp.current.x += (objective.x - tmp.current.x) * w
        tmp.current.z += (objective.z - tmp.current.z) * w
      }
    }

    let cineDist = 0
    if (camFx.introT >= INTRO && camCine.on) {
      tmp.current.set(camCine.x, camCine.y, camCine.z)
      // fit the requested width whatever the aspect ratio (portrait phones back off further)
      const halfH = THREE.MathUtils.degToRad(fov / 2)
      const halfW = Math.atan(Math.tan(halfH) * (size.width / size.height))
      cineDist = camCine.width / 2 / Math.tan(halfW) + 2
    }

    if (!initialised.current) {
      focus.current.copy(tmp.current)
      camera.position.copy(OFFSET).multiplyScalar(dist).add(focus.current)
      initialised.current = true
    }
    focus.current.lerp(tmp.current, 1 - Math.exp(-dt * 4))
    if (cineDist > 0) {
      offset.current.lerp(want.current.copy(CINE_DIR).multiplyScalar(cineDist), 1 - Math.exp(-dt * 1.6))
      want.current.copy(offset.current).add(focus.current)
    } else {
      offset.current.lerp(player.building ? BUILD_OFFSET : OFFSET, 1 - Math.exp(-dt * 3))
      want.current.copy(offset.current).multiplyScalar(dist).add(focus.current)
    }
    camera.position.lerp(want.current, 1 - Math.exp(-dt * 5))

    if (camFx.shake > 0) {
      camFx.shake = Math.max(0, camFx.shake - dt * 2.5)
      const a = camFx.shake * camFx.shake * 0.35
      const t = state.clock.elapsedTime * 40
      camera.position.x += Math.sin(t) * a
      camera.position.y += Math.sin(t * 1.3 + 1) * a
    }
    camera.lookAt(focus.current)
    camera.updateMatrixWorld()

    // see-through scenery: where is Noah on screen, and how far away?
    gl.getDrawingBufferSize(buf.current)
    tmp.current.set(player.pos.x, player.pos.y + 0.8, player.pos.z)
    const depth = -want.current.copy(tmp.current).applyMatrix4(camera.matrixWorldInverse).z
    tmp.current.project(camera)
    occlusion.uOccPlayer.value.set((tmp.current.x * 0.5 + 0.5) * buf.current.x, (tmp.current.y * 0.5 + 0.5) * buf.current.y)
    occlusion.uOccDepth.value = depth
    occlusion.uOccRadius.value = 120 * gl.getPixelRatio()
  })
  return null
}
