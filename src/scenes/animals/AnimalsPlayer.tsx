// Noah's controller and follow camera for chapter 4. Copied from
// scenes/gather/Player.tsx (same feel: coyote time, buffered double jump,
// circle/box collision) and adapted: interactions come from this level's own
// registry (call / smash / ring / build / catch), the level locks it during
// the closing cutscene, and the camera can be pointed at the ark door.
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Minifig, makePose } from '../../three/Minifig'
import { BlobShadow } from '../../three/common'
import { occlusion } from '../../three/bricks'
import { consumePresses, input, moveVector } from '../../game/input'
import { camFx, colliders, platforms, player, surfaceHeight } from '../../game/world'
import { fx } from '../../three/Effects'
import { sfx } from '../../game/audio'
import { LEVEL_BOUNDS, ainteract, camOverride, guide, noahFx, noahScript, type AInteract, type V3 } from './layout'
import { useAnimals } from './state'

const SPEED = 5.2
const ACCEL = 16
const AIR_ACCEL = 7
const GRAVITY = 30
const FALL_MULT = 1.65
const MAX_FALL = 22
const JUMP_V = 9.2
const JUMP_CUT = 0.45
const COYOTE = 0.1
const BUFFER = 0.12
const REACH = 1.1
const SWING_TIME = 0.32
const STEP = 0.3
const BODY_R = 0.35
const LEDGE = 0.22

export function groundAt(x: number, z: number, y: number) {
  let g = surfaceHeight(x, z)
  for (const p of platforms.values()) {
    if (Math.abs(x - p.x) < p.hw + LEDGE && Math.abs(z - p.z) < p.hd + LEDGE && p.top <= y + STEP && p.top > g) g = p.top
  }
  for (const c of colliders.values()) {
    if (c.top === undefined || c.top > y + STEP || c.top <= g) continue
    const dx = x - c.x
    const dz = z - c.z
    if (dx * dx + dz * dz < (c.r + LEDGE) * (c.r + LEDGE)) g = c.top
  }
  return g
}

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

export function AnimalsPlayer({ start }: { start: V3 }) {
  const group = useRef<THREE.Group>(null)
  const shadow = useRef<THREE.Group>(null)
  const pose = useRef(makePose())
  const jumps = useRef(0)
  const jumpBuffer = useRef(0)
  const coyote = useRef(0)
  const cut = useRef(false)
  const visualY = useRef(0)
  const swingHit = useRef<AInteract | null>(null)
  const buildTick = useRef(0)

  useEffect(() => {
    player.pos.set(...start)
    player.vel.set(0, 0, 0)
    player.facing = Math.PI
    player.grounded = true
    player.swingT = 0
    player.building = false
  }, [start])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const lv = useAnimals.getState()
    const g = group.current
    if (!g) return
    const locked = lv.phase !== 'play'
    if (noahScript.active) {
      // the closing cutscene walks Noah aboard
      player.pos.set(noahScript.x, noahScript.y, noahScript.z)
      player.vel.set(0, 0, 0)
      player.facing = noahScript.facing
      g.visible = noahScript.visible
      g.position.copy(player.pos)
      g.rotation.y = noahScript.facing
      pose.current.speed = noahScript.speed
      pose.current.airborne = false
      pose.current.swing = 0
      pose.current.wave = 0
      pose.current.building = false
      if (shadow.current) {
        shadow.current.visible = noahScript.visible
        shadow.current.position.set(player.pos.x, player.pos.y + 0.03, player.pos.z)
      }
      lv.setPrompt(null)
      lv.setBuildProgress(null)
      consumePresses()
      return
    }

    const [mx, my] = locked ? [0, 0] : moveVector()
    const building = player.building
    const targetVx = building ? 0 : mx * SPEED
    const targetVz = building ? 0 : my * SPEED
    const a = 1 - Math.exp(-dt * (player.grounded ? ACCEL : AIR_ACCEL))
    player.vel.x += (targetVx - player.vel.x) * a
    player.vel.z += (targetVz - player.vel.z) * a

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
    player.pos.x = THREE.MathUtils.clamp(player.pos.x, LEVEL_BOUNDS.minX, LEVEL_BOUNDS.maxX)
    player.pos.z = THREE.MathUtils.clamp(player.pos.z, LEVEL_BOUNDS.minZ, LEVEL_BOUNDS.maxZ)

    const ground = groundAt(player.pos.x, player.pos.z, player.pos.y)
    if (player.pos.y <= ground) {
      if (!player.grounded) {
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
      player.grounded = false
      jumps.current = 1
    } else if (player.grounded) {
      player.pos.y = ground
    }

    const planar = Math.hypot(player.vel.x, player.vel.z)
    if (planar > 0.3) {
      const want = Math.atan2(player.vel.x, player.vel.z)
      let diff = want - player.facing
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      player.facing += diff * (1 - Math.exp(-dt * 14))
    }

    // --- contextual interaction (this level's registry) ---
    let nearest: AInteract | null = null
    let best = Infinity
    for (const it of ainteract.values()) {
      if (it.enabled && !it.enabled()) continue
      const d = Math.hypot(player.pos.x - it.x, player.pos.z - it.z) - it.r
      if (d < REACH && d < best) {
        best = d
        nearest = it
      }
    }

    let prompt: string | null = null
    let icon: AInteract['icon'] | null = null
    let progress: number | null = null
    player.building = false
    if (nearest && !locked) {
      const high = (nearest.minY === undefined || (player.pos.y >= nearest.minY - 0.05 && player.grounded)) && !nearest.blocked?.()
      icon = nearest.icon
      if (!high) {
        prompt = nearest.blockedLabel ? nearest.blockedLabel() : null
        icon = null
      } else if (nearest.hold) {
        prompt = nearest.label()
        if (input.actionDown && player.grounded && nearest.build) {
          player.building = true
          player.facing = Math.atan2(nearest.x - player.pos.x, nearest.z - player.pos.z)
          progress = nearest.build(dt)
          buildTick.current -= dt
          if (buildTick.current <= 0) {
            sfx.buildTick()
            buildTick.current = 0.09
          }
        }
      } else {
        prompt = nearest.label()
        if (input.actionPressed && player.swingT <= 0) {
          player.facing = Math.atan2(nearest.x - player.pos.x, nearest.z - player.pos.z)
          if (nearest.icon === 'smash' || nearest.icon === 'search' || nearest.icon === 'bell') {
            player.swingT = SWING_TIME
            swingHit.current = nearest
          } else {
            // calling an animal: a friendly wave, no axe
            noahFx.wave = 1.2
            nearest.hit?.()
          }
        }
      }
    } else if (input.actionPressed && player.swingT <= 0 && !locked) {
      player.swingT = SWING_TIME
      swingHit.current = null
    }

    if (player.swingT > 0) {
      const before = player.swingT
      player.swingT -= dt
      if (before > SWING_TIME * 0.55 && player.swingT <= SWING_TIME * 0.55 && swingHit.current) {
        const target = swingHit.current
        swingHit.current = null
        if (ainteract.has(target.id)) target.hit?.()
      }
    }
    noahFx.wave = Math.max(0, noahFx.wave - dt)

    lv.setPrompt(prompt, icon)
    lv.setBuildProgress(progress)
    consumePresses()

    visualY.current = player.grounded ? visualY.current + (player.pos.y - visualY.current) * (1 - Math.exp(-dt * 25)) : player.pos.y
    g.position.set(player.pos.x, visualY.current, player.pos.z)
    g.rotation.y = player.facing
    pose.current.speed = Math.min(1, planar / SPEED)
    pose.current.airborne = !player.grounded
    pose.current.building = player.building
    pose.current.swing = player.swingT > 0 ? 1 - player.swingT / SWING_TIME : 0
    pose.current.wave = noahFx.wave > 0 ? 1 : 0
    pose.current.raiseArms = lv.phase === 'closing' ? Math.min(1, pose.current.raiseArms + dt * 2) : 0
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
const BUILD_OFFSET = new THREE.Vector3(0, 9.5, 6.5)
const CLOSE_OFFSET = new THREE.Vector3(-3.5, 5.2, 15.5)
const INTRO = 3.4

/** Fixed-angle follow camera (same as the gather level) plus a cutscene override. */
export function AnimalsCamera() {
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
    const fov = portrait ? 62 : 45
    if (cam.fov !== fov) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }
    const dist = portrait ? 1.15 : 1

    tmp.current.set(player.pos.x + player.vel.x * 0.35, 0.8 + player.pos.y * 0.5, player.pos.z + player.vel.z * 0.25)

    if (camFx.introT < INTRO) {
      camFx.introT += dt
      if (Math.hypot(player.vel.x, player.vel.z) > 0.5) camFx.introT = INTRO
      if (guide.active) {
        const k = camFx.introT / INTRO
        const w = k < 0.35 ? THREE.MathUtils.smoothstep(k, 0, 0.35) : k < 0.7 ? 1 : 1 - THREE.MathUtils.smoothstep(k, 0.7, 1)
        tmp.current.x += (guide.x - tmp.current.x) * w
        tmp.current.z += (guide.z - tmp.current.z) * w
      }
    }
    if (camOverride.active) tmp.current.set(camOverride.x, camOverride.y, camOverride.z)

    if (!initialised.current) {
      focus.current.copy(tmp.current)
      camera.position.copy(OFFSET).multiplyScalar(dist).add(focus.current)
      initialised.current = true
    }
    focus.current.lerp(tmp.current, 1 - Math.exp(-dt * (camOverride.active ? 1.6 : 4)))
    const wantOffset = camOverride.active ? CLOSE_OFFSET : player.building ? BUILD_OFFSET : OFFSET
    offset.current.lerp(wantOffset, 1 - Math.exp(-dt * (camOverride.active ? 1.2 : 3)))
    want.current.copy(offset.current).multiplyScalar(dist * (camOverride.active ? camOverride.dist : 1)).add(focus.current)
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
