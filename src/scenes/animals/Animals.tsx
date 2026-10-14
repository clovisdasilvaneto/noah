// The animals: plain mutable agents updated by one brain each frame, plus a
// view component per agent that poses its brick model (trot, tail wag, ear
// flaps, head bobs). Doves are a separate instanced flock.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BlobShadow } from '../../three/common'
import { plasticVC } from '../../three/bricks'
import { fx } from '../../three/Effects'
import { colliders, newId, platforms, player } from '../../game/world'
import { sfx } from '../../game/audio'
import { useGame } from '../../store'
import { ANIMALS_STRINGS, type SpeciesId } from '../../i18n/animals'
import { animalModel, doveGeometry, type AnimalModel } from './models'
import { asfx } from './asfx'
import { useAnimals } from './state'
import {
  APPROACH,
  CLEARING,
  DECK_Y,
  DOOR_X,
  DOVE_TREE,
  EXIT,
  GRASS,
  HILL,
  HULL_FRONT,
  LION_GRASS,
  PEN,
  POND,
  RAMP_FOOT,
  RAMP_RUN,
  SHEEP_HOMES,
  ainteract,
  animalGround,
  type AInteract,
  type V2,
} from './layout'

type Walker = Exclude<SpeciesId, 'doves'>

export type AgentState = 'home' | 'hidden' | 'caught' | 'follow' | 'walk' | 'ramp' | 'inside' | 'aboard'

export type Agent = {
  species: Walker
  variant: number
  idx: number
  x: number
  y: number
  z: number
  facing: number
  state: AgentState
  path: V2[]
  pathI: number
  ox: number
  /** 0..1 planar speed, drives the trot */
  speed: number
  homeX: number
  homeZ: number
  tx: number
  tz: number
  wait: number
  t: number
  duck: number
  hopY: number
  hopT: number
  hopDX: number
  hopDZ: number
  rest: number
  soundCd: number
  followOrder: number
  visible: boolean
  /** turtles: waiting for Noah to come closer */
  stalled: boolean
}

type SpeciesDef = { count: number; walk: number; follow: number; wander: number; body: number; sound: () => void }

export const SPECIES: Record<Walker, SpeciesDef> = {
  lions: { count: 2, walk: 3, follow: 5.4, wander: 0, body: 0.4, sound: asfx.roar },
  elephants: { count: 2, walk: 1.9, follow: 3, wander: 1.4, body: 0.8, sound: asfx.trumpet },
  giraffes: { count: 2, walk: 2.1, follow: 3, wander: 0.5, body: 0.45, sound: asfx.hum },
  zebras: { count: 2, walk: 3.6, follow: 4, wander: 2.2, body: 0.45, sound: asfx.neigh },
  sheep: { count: 6, walk: 2.4, follow: 5.4, wander: 1.0, body: 0.4, sound: asfx.baa },
  rabbits: { count: 2, walk: 3, follow: 5, wander: 0, body: 0.25, sound: asfx.squeak },
  turtles: { count: 2, walk: 1.3, follow: 1.5, wander: 0.4, body: 0.35, sound: asfx.bloop },
}
export const DOVE_COUNT = 14 // seven pairs of birds (Genesis 7:3)
export const speciesTotal = (s: SpeciesId) => (s === 'doves' ? DOVE_COUNT : SPECIES[s].count)

/** Level flags shared by the brain, props and guide. Reset on mount. */
export const lvl = {
  logHits: 0,
  logGone: false,
  bridgeBuilt: false,
  bellRung: false,
  grassAlive: GRASS.map(() => true),
  followCounter: 0,
  turtleToastCd: 0,
  rabbitsCaught: 0,
}

export const agents: Agent[] = []

function makeAgent(species: Walker, variant: number, idx: number, x: number, z: number, state: AgentState = 'home'): Agent {
  return {
    species,
    variant,
    idx,
    x,
    y: animalGround(x, z),
    z,
    facing: Math.random() * Math.PI * 2,
    state,
    path: [],
    pathI: 0,
    ox: idx % 2 ? 0.45 : -0.45,
    speed: 0,
    homeX: x,
    homeZ: z,
    tx: x,
    tz: z,
    wait: Math.random() * 2,
    t: Math.random() * 10,
    duck: 0,
    hopY: 0,
    hopT: 0,
    hopDX: 0,
    hopDZ: 0,
    rest: 0,
    soundCd: 2 + Math.random() * 4,
    followOrder: 0,
    visible: true,
    stalled: false,
  }
}

export function resetAnimals() {
  agents.length = 0
  lvl.logHits = 0
  lvl.logGone = false
  lvl.bridgeBuilt = false
  lvl.bellRung = false
  lvl.grassAlive = GRASS.map(() => true)
  lvl.followCounter = 0
  lvl.turtleToastCd = 0
  lvl.rabbitsCaught = 0
  LION_GRASS.forEach((g, i) => agents.push(makeAgent('lions', i, i, GRASS[g][0], GRASS[g][1], 'hidden')))
  agents.push(makeAgent('elephants', 0, 0, CLEARING.x - 0.6, CLEARING.z - 1.2), makeAgent('elephants', 0, 1, CLEARING.x + 1, CLEARING.z + 1))
  agents.push(makeAgent('giraffes', 0, 0, HILL.x - 0.8, HILL.z - 0.5), makeAgent('giraffes', 0, 1, HILL.x + 0.6, HILL.z + 0.7))
  agents.push(makeAgent('zebras', 0, 0, 22, -1.8), makeAgent('zebras', 0, 1, 23.5, 1.6))
  SHEEP_HOMES.forEach(([x, z], i) => {
    const a = makeAgent('sheep', 0, i, x, z)
    a.ox = ((i % 3) - 1) * 0.55
    agents.push(a)
  })
  agents.push(makeAgent('rabbits', 0, 0, PEN.x + 1.5, PEN.z + 0.6), makeAgent('rabbits', 1, 1, PEN.x + 2.8, PEN.z - 0.8))
  agents.push(makeAgent('turtles', 0, 0, POND.x - 0.8, POND.z + POND.r + 0.9), makeAgent('turtles', 0, 1, POND.x + 0.5, POND.z + POND.r + 1.2))
}

const L = () => ANIMALS_STRINGS[useGame.getState().lang ?? 'en']
const toast = (s: string) => useGame.getState().toast(s)

/** Send an agent along an exit route to the ramp. */
export function sendToArk(a: Agent, route: V2[]) {
  a.state = 'walk'
  a.path = [...route, APPROACH, RAMP_FOOT]
  a.pathI = 0
}

function markFound(species: Walker) {
  const st = useAnimals.getState()
  if (agents.every((a) => a.species !== species || (a.state !== 'home' && a.state !== 'hidden' && a.state !== 'caught'))) st.setStatus(species, 'found')
}

export function startFollow(a: Agent) {
  a.state = 'follow'
  a.followOrder = ++lvl.followCounter
  markFound(a.species)
}

export function revealLion(grassIndex: number) {
  const slot = LION_GRASS.indexOf(grassIndex)
  if (slot < 0) return false
  const a = agents.find((g) => g.species === 'lions' && g.idx === slot)
  if (!a) return false
  asfx.roar()
  fx.burst(a.x, 1, a.z, ['#ffe08a', '#ffffff', '#dca447'], 14, 0.8)
  toast(L().toastLionFound)
  startFollow(a)
  return true
}

export function bridgeDone() {
  lvl.bridgeBuilt = true
  asfx.neigh()
  for (const a of agents) if (a.species === 'zebras') sendToArk(a, EXIT.zebras)
  markFound('zebras')
  toast(L().species.zebras.found)
}

/* ------------------------------------------------------------------ */
/* Breadcrumb trail: followers walk where Noah walked (around trees).   */
/* ------------------------------------------------------------------ */

const TRAIL_N = 160
const TRAIL_STEP = 0.3
const trail = new Float32Array(TRAIL_N * 2)
let trailHead = 0
let trailLen = 0
function resetTrail() {
  trailHead = 0
  trailLen = 1
  trail[0] = player.pos.x
  trail[1] = player.pos.z
}
function pushTrail() {
  const hx = trail[trailHead * 2]
  const hz = trail[trailHead * 2 + 1]
  if (Math.hypot(player.pos.x - hx, player.pos.z - hz) < TRAIL_STEP) return
  trailHead = (trailHead + 1) % TRAIL_N
  trail[trailHead * 2] = player.pos.x
  trail[trailHead * 2 + 1] = player.pos.z
  trailLen = Math.min(TRAIL_N, trailLen + 1)
}
const trailOut = { x: 0, z: 0 }
/** Point `dist` units back along the trail from Noah. */
function trailPoint(dist: number) {
  let px = player.pos.x
  let pz = player.pos.z
  let left = dist
  for (let k = 0; k < trailLen; k++) {
    const i = (trailHead - k + TRAIL_N) % TRAIL_N
    const qx = trail[i * 2]
    const qz = trail[i * 2 + 1]
    const seg = Math.hypot(qx - px, qz - pz)
    if (seg >= left) {
      const f = left / (seg || 1)
      trailOut.x = px + (qx - px) * f
      trailOut.z = pz + (qz - pz) * f
      return trailOut
    }
    left -= seg
    px = qx
    pz = qz
  }
  trailOut.x = px
  trailOut.z = pz
  return trailOut
}

/* ------------------------------------------------------------------ */
/* Movement helpers                                                     */
/* ------------------------------------------------------------------ */

function turnTo(a: Agent, dx: number, dz: number, dt: number, rate = 8) {
  const want = Math.atan2(dx, dz)
  const diff = Math.atan2(Math.sin(want - a.facing), Math.cos(want - a.facing))
  a.facing += diff * (1 - Math.exp(-dt * rate))
}

/** Step towards (tx, tz); returns the remaining distance. */
function stepTo(a: Agent, tx: number, tz: number, speed: number, dt: number) {
  const dx = tx - a.x
  const dz = tz - a.z
  const d = Math.hypot(dx, dz)
  if (d < 1e-4) return 0
  const s = Math.min(d, speed * dt)
  a.x += (dx / d) * s
  a.z += (dz / d) * s
  turnTo(a, dx, dz, dt)
  return d - s
}

/** Animals ignore the player's physics, but walkers slide around trees, fences and the hull. */
function pushOut(a: Agent) {
  const r = SPECIES[a.species].body
  for (const c of colliders.values()) {
    const dx = a.x - c.x
    const dz = a.z - c.z
    const min = c.r + r
    const d2 = dx * dx + dz * dz
    if (d2 < min * min && d2 > 1e-6) {
      const d = Math.sqrt(d2)
      a.x = c.x + (dx / d) * min
      a.z = c.z + (dz / d) * min
    }
  }
  for (const p of platforms.values()) {
    if (p.top < 2 || hillPlatforms.has(p)) continue
    const ox = p.hw + r - Math.abs(a.x - p.x)
    const oz = p.hd + r - Math.abs(a.z - p.z)
    if (ox > 0 && oz > 0) {
      if (ox < oz) a.x += Math.sign(a.x - p.x) * ox
      else a.z += Math.sign(a.z - p.z) * oz
    }
  }
}
/** The hill tiers are platforms for Noah but walkable slopes for animals. */
export const hillPlatforms = new Set<object>()

function clampPen(a: { x: number; z: number }) {
  a.x = THREE.MathUtils.clamp(a.x, PEN.x - PEN.hw + 0.6, PEN.x + PEN.hw - 0.6)
  a.z = THREE.MathUtils.clamp(a.z, PEN.z - PEN.hd + 0.6, PEN.z + PEN.hd - 0.6)
}
const penTmp = { x: 0, z: 0 }

function catchRabbit(a: Agent) {
  if (a.state !== 'home') return
  a.state = 'caught'
  a.hopT = 0
  a.hopY = 0
  lvl.rabbitsCaught++
  asfx.squeak()
  fx.burst(a.x, 0.6, a.z, ['#ff8fb1', '#ffffff', '#ffe08a'], 10, 0.5)
  fx.studs(a.x, 0.4, a.z, 100)
  if (lvl.rabbitsCaught >= 2) {
    toast(L().species.rabbits.found)
    for (const r of agents) if (r.species === 'rabbits') sendToArk(r, EXIT.rabbits)
    markFound('rabbits')
  } else toast(L().toastRabbitCaught)
}

/* ------------------------------------------------------------------ */
/* The brain                                                            */
/* ------------------------------------------------------------------ */

const FOLLOW_GAP = 0.95
const ESCORT_R = 6

function updateAgent(a: Agent, dt: number, onBoard: (a: Agent) => void, followSlot: number) {
  const def = SPECIES[a.species]
  const px = player.pos.x
  const pz = player.pos.z
  const dP = Math.hypot(px - a.x, pz - a.z)
  let moving = 0
  a.t += dt
  a.soundCd -= dt

  switch (a.state) {
    case 'hidden': {
      // a tail swishing above the grass; a soft growl when Noah is close
      if (dP < 7 && a.soundCd <= 0) {
        asfx.roar()
        a.soundCd = 7 + Math.random() * 4
      }
      break
    }
    case 'home': {
      if (a.species === 'rabbits') {
        moving = rabbitHome(a, dt, dP)
        break
      }
      if (a.wait > 0) {
        a.wait -= dt
        if (a.wait <= 0 && def.wander > 0) {
          const ang = Math.random() * Math.PI * 2
          const r = Math.sqrt(Math.random()) * def.wander
          a.tx = a.homeX + Math.cos(ang) * r
          a.tz = a.homeZ + Math.sin(ang) * r
        }
        if (dP < 4) turnTo(a, px - a.x, pz - a.z, dt, 3)
      } else {
        const left = stepTo(a, a.tx, a.tz, def.walk * 0.35, dt)
        moving = 0.35
        if (left < 0.05) a.wait = 1.5 + Math.random() * 3
      }
      if (dP < 6 && a.soundCd <= 0) {
        def.sound()
        a.soundCd = 8 + Math.random() * 6
      }
      break
    }
    case 'caught': {
      turnTo(a, px - a.x, pz - a.z, dt, 4)
      a.hopY = Math.abs(Math.sin(a.t * 6)) * 0.08
      if (a.species === 'giraffes') {
        a.wait -= dt
        if (a.wait <= 0) {
          a.hopY = 0
          sendToArk(a, EXIT.giraffes)
        }
      }
      break
    }
    case 'follow': {
      if (a.species === 'turtles') {
        // escort: they only walk while Noah stays close
        a.stalled = dP > ESCORT_R
        if (a.stalled) {
          if (lvl.turtleToastCd <= 0) {
            toast(L().toastTurtlesWait)
            asfx.bloop()
            lvl.turtleToastCd = 6
          }
          turnTo(a, px - a.x, pz - a.z, dt, 2)
          break
        }
      }
      const gap = a.species === 'turtles' ? 1.4 + a.idx * 0.9 : 1.5 + followSlot * FOLLOW_GAP
      const p = trailPoint(gap)
      const d = Math.hypot(p.x - a.x, p.z - a.z)
      if (d > 0.15) {
        const sp = Math.min(def.follow, 1 + d * 2.6)
        stepTo(a, p.x, p.z, sp, dt)
        moving = Math.min(1, sp / def.follow)
        pushOut(a)
      } else turnTo(a, px - a.x, pz - a.z, dt, 3)
      if (Math.hypot(a.x - APPROACH[0], a.z - APPROACH[1]) < 4.5 && useAnimals.getState().phase === 'play') {
        a.state = 'walk'
        a.path = [APPROACH, RAMP_FOOT]
        a.pathI = 0
      }
      break
    }
    case 'walk': {
      const wp = a.path[a.pathI]
      const tx = wp[0] + (a.pathI >= a.path.length - 2 ? a.ox : 0)
      const tz = wp[1]
      const left = stepTo(a, tx, tz, def.walk, dt)
      moving = 1
      if (a.pathI < a.path.length - 2) pushOut(a)
      if (left < 0.25) {
        a.pathI++
        if (a.pathI >= a.path.length) {
          a.state = 'ramp'
          a.x = RAMP_FOOT[0] + a.ox
        }
      }
      break
    }
    case 'ramp': {
      stepTo(a, DOOR_X + a.ox, HULL_FRONT - 0.3, def.walk * 0.8, dt)
      moving = 0.8
      if (a.z <= HULL_FRONT) a.state = 'inside'
      break
    }
    case 'inside': {
      a.z -= def.walk * 0.8 * dt
      moving = 0.8
      if (a.z < HULL_FRONT - 1.7) {
        a.state = 'aboard'
        a.visible = false
        onBoard(a)
      }
      break
    }
    case 'aboard':
      break
  }

  // height: ramp, deck, or ground (hills included)
  if (a.state === 'ramp' || a.state === 'inside') {
    const k = THREE.MathUtils.clamp((HULL_FRONT + RAMP_RUN - a.z) / RAMP_RUN, 0, 1)
    a.y = DECK_Y * k
    a.duck = Math.min(1, a.duck + dt * 1.5)
  } else if (a.state !== 'aboard') {
    const g = animalGround(a.x, a.z)
    a.y += (g - a.y) * (1 - Math.exp(-dt * (g < a.y ? 8 : 10)))
  }
  a.speed += (moving - a.speed) * (1 - Math.exp(-dt * 8))
}

function rabbitHome(a: Agent, dt: number, dP: number) {
  const inPen = Math.abs(player.pos.x - PEN.x) < PEN.hw + 1.5 && Math.abs(player.pos.z - PEN.z) < PEN.hd + 1.5
  if (dP < 0.8 && inPen && player.pos.y < 0.6) {
    catchRabbit(a)
    return 0
  }
  if (a.hopT > 0) {
    a.hopT -= dt
    a.x += a.hopDX * dt
    a.z += a.hopDZ * dt
    clampPen(a)
    a.hopY = Math.sin(Math.max(0, a.hopT / 0.34) * Math.PI) * 0.32
    turnTo(a, a.hopDX, a.hopDZ, dt, 16)
    return 1
  }
  a.hopY = 0
  if (a.rest > 0) {
    a.rest -= dt
    return 0
  }
  if (dP < 4.2 && inPen) {
    // bolt away from Noah, sliding along the fence; corners trap them
    let ax = a.x - player.pos.x
    let az = a.z - player.pos.z
    const l = Math.hypot(ax, az) || 1
    ax /= l
    az /= l
    let bestX = ax
    let bestZ = az
    let bestScore = -Infinity
    for (let k = -2; k <= 2; k++) {
      const ang = k * 0.6 + (Math.random() - 0.5) * 0.3
      const cx = ax * Math.cos(ang) - az * Math.sin(ang)
      const cz = ax * Math.sin(ang) + az * Math.cos(ang)
      penTmp.x = a.x + cx * 2.1
      penTmp.z = a.z + cz * 2.1
      clampPen(penTmp)
      const score = Math.hypot(penTmp.x - player.pos.x, penTmp.z - player.pos.z) + Math.hypot(penTmp.x - a.x, penTmp.z - a.z) * 0.5
      if (score > bestScore) {
        bestScore = score
        bestX = penTmp.x - a.x
        bestZ = penTmp.z - a.z
      }
    }
    const bl = Math.hypot(bestX, bestZ)
    if (bl < 0.3) {
      // cornered: freeze for a moment
      a.rest = 0.5
      return 0
    }
    a.hopDX = (bestX / 0.34) * 0.95
    a.hopDZ = (bestZ / 0.34) * 0.95
    a.hopT = 0.34
    a.rest = 0.28 + Math.random() * 0.35
    if (Math.random() < 0.35) asfx.hop()
    return 1
  }
  // idle: nibble, the odd little hop
  if (Math.random() < dt * 0.4) {
    const ang = Math.random() * Math.PI * 2
    a.hopDX = Math.cos(ang) * 2
    a.hopDZ = Math.sin(ang) * 2
    a.hopT = 0.34
    a.rest = 1 + Math.random() * 2
  }
  return 0
}

export function AnimalsBrain({ onBoard }: { onBoard: (species: SpeciesId) => void }) {
  const onBoardRef = useRef(onBoard)
  useEffect(() => {
    onBoardRef.current = onBoard
  }, [onBoard])
  useEffect(() => resetTrail(), [])
  const board = useMemo(
    () => (a: Agent) => {
      asfx.aboard()
      fx.burst(DOOR_X, DECK_Y + 1, HULL_FRONT + 0.3, ['#ffe08a', '#ffffff'], 6, 0.4)
      onBoardRef.current(a.species)
    },
    [],
  )
  // interactables that ride along with the animals
  useEffect(() => {
    const ids: number[] = []
    const reg = (it: Omit<AInteract, 'id'>) => {
      const id = newId()
      ainteract.set(id, { id, ...it })
      ids.push(id)
      return ainteract.get(id)!
    }
    const s = L
    const elephants = agents.filter((a) => a.species === 'elephants')
    const giraffes = agents.filter((a) => a.species === 'giraffes')
    const turtles = agents.filter((a) => a.species === 'turtles')
    const rabbits = agents.filter((a) => a.species === 'rabbits')
    const sheep = agents.filter((a) => a.species === 'sheep')
    const follow: { it: AInteract; a: Agent }[] = []
    follow.push({
      a: elephants[0],
      it: reg({
        x: 0,
        z: 0,
        r: 2.0,
        icon: 'call',
        label: () => s().species.elephants.prompt,
        enabled: () => elephants[0].state === 'home',
        blocked: () => !lvl.logGone,
        blockedLabel: () => s().promptLogFirst,
        hit: () => {
          asfx.trumpet()
          for (const e of elephants) sendToArk(e, EXIT.elephants.slice(1))
          markFound('elephants')
          toast(s().species.elephants.found)
        },
      }),
    })
    follow.push({
      a: giraffes[0],
      it: reg({
        x: 0,
        z: 0,
        r: 1.8,
        icon: 'call',
        minY: 2.8,
        label: () => s().species.giraffes.prompt,
        blockedLabel: () => s().toastClimb,
        enabled: () => giraffes[0].state === 'home',
        hit: () => {
          asfx.hum()
          // a little happy bounce, then down the hill one after the other
          giraffes.forEach((g, i) => {
            g.state = 'caught'
            g.wait = 0.6 + i * 0.6
          })
          useAnimals.getState().setStatus('giraffes', 'found')
          toast(s().species.giraffes.found)
        },
      }),
    })
    follow.push({
      a: turtles[0],
      it: reg({
        x: 0,
        z: 0,
        r: 1.5,
        icon: 'call',
        label: () => s().species.turtles.prompt,
        enabled: () => turtles[0].state === 'home',
        hit: () => {
          asfx.bloop()
          turtles.forEach((t) => startFollow(t))
          toast(s().species.turtles.found)
        },
      }),
    })
    for (const r of rabbits) {
      follow.push({
        a: r,
        it: reg({ x: 0, z: 0, r: 0.5, icon: 'catch', label: () => s().promptCatch, enabled: () => r.state === 'home', hit: () => catchRabbit(r) }),
      })
    }
    for (const sh of sheep) {
      follow.push({
        a: sh,
        it: reg({
          x: 0,
          z: 0,
          r: 0.9,
          icon: 'call',
          label: () => s().species.sheep.prompt,
          enabled: () => sh.state === 'home',
          hit: () => {
            asfx.baa()
            startFollow(sh)
            const n = useAnimals.getState().addSheepFound()
            toast(n >= 6 ? s().species.sheep.found : `${s().toastSheepFound} ${n}/6`)
          },
        }),
      })
    }
    followers.current = follow
    return () => {
      ids.forEach((id) => ainteract.delete(id))
      followers.current = []
    }
  }, [])
  const followers = useRef<{ it: AInteract; a: Agent }[]>([])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    pushTrail()
    lvl.turtleToastCd -= dt
    // follower slots in the order they were found
    let slot = 0
    for (let order = 1; order <= lvl.followCounter; order++) {
      for (const a of agents) {
        if (a.followOrder !== order) continue
        if (a.state === 'follow' && a.species !== 'turtles') updateAgent(a, dt, board, slot++)
      }
    }
    for (const a of agents) if (!(a.state === 'follow' && a.species !== 'turtles')) updateAgent(a, dt, board, 0)
    for (const f of followers.current) {
      f.it.x = f.a.x
      f.it.z = f.a.z
    }
  })
  return null
}

/* ------------------------------------------------------------------ */
/* Views                                                                */
/* ------------------------------------------------------------------ */

const STYLE: Record<Walker, { stride: number; lift: number; rate: number; wag: number; wagRate: number }> = {
  lions: { stride: 0.12, lift: 0.06, rate: 11, wag: 0.5, wagRate: 2.4 },
  elephants: { stride: 0.14, lift: 0.07, rate: 7, wag: 0.4, wagRate: 2 },
  giraffes: { stride: 0.16, lift: 0.08, rate: 7, wag: 0.4, wagRate: 2.5 },
  zebras: { stride: 0.14, lift: 0.08, rate: 14, wag: 0.5, wagRate: 3 },
  sheep: { stride: 0.08, lift: 0.05, rate: 13, wag: 0.6, wagRate: 7 },
  rabbits: { stride: 0.03, lift: 0.02, rate: 10, wag: 0.3, wagRate: 9 },
  turtles: { stride: 0.06, lift: 0.04, rate: 6, wag: 0.4, wagRate: 3 },
}

function AnimalView({ agent, model }: { agent: Agent; model: AnimalModel }) {
  const root = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Group>(null)
  const legsA = useRef<THREE.Mesh>(null)
  const legsB = useRef<THREE.Mesh>(null)
  const earL = useRef<THREE.Group>(null)
  const earR = useRef<THREE.Group>(null)
  const shadow = useRef<THREE.Group>(null)
  const phase = useRef(agent.idx * 1.7)
  const mat = plasticVC()
  const st = STYLE[agent.species]

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const g = root.current
    if (!g) return
    g.visible = agent.visible
    if (!agent.visible) return
    const a = agent
    const t = a.t
    g.position.set(a.x, a.y, a.z)
    g.rotation.y = a.facing
    phase.current += dt * st.rate * Math.max(a.speed, 0.0001) * (a.speed > 0.05 ? 1 : 0)
    const s = Math.sin(phase.current)
    const sp = Math.min(1, a.speed * 1.5)
    if (legsA.current) legsA.current.position.set(0, Math.max(0, s) * st.lift * sp, s * st.stride * sp)
    if (legsB.current) legsB.current.position.set(0, Math.max(0, -s) * st.lift * sp, -s * st.stride * sp)
    const hidden = a.state === 'hidden'
    if (inner.current) {
      // body bob while walking; hidden lions crouch in the grass
      inner.current.position.y = a.hopY + Math.abs(s) * 0.03 * sp + (hidden ? -0.38 : 0)
      inner.current.rotation.x = a.species === 'rabbits' ? -a.hopY * 0.8 : 0
    }
    if (head.current) {
      const idle = 1 - sp
      let rx = Math.sin(t * 1.3) * 0.06 * idle + Math.abs(s) * 0.05 * sp
      let ry = Math.sin(t * 0.45) * 0.35 * idle
      if (a.species === 'sheep' || a.species === 'zebras') rx += Math.max(0, Math.sin(t * 0.35)) * 0.6 * idle // grazing
      if (a.species === 'giraffes') rx += a.duck * 1.15 // bow through the door
      if (a.species === 'turtles') head.current.position.z = model.head.pivot[2] + (Math.sin(t * 0.8) * 0.5 - 0.2) * 0.12 * idle
      if (a.stalled) ry = 0
      head.current.rotation.set(rx, ry, 0)
    }
    if (tail.current) {
      tail.current.rotation.y = Math.sin(t * st.wagRate * (hidden ? 2 : 1)) * st.wag
      tail.current.rotation.x = hidden ? -1.3 : 0
      tail.current.scale.setScalar(hidden ? 1.9 : 1) // the tip pokes out of the grass
    }
    if (earL.current && earR.current) {
      if (a.species === 'elephants') {
        const f = 0.25 + Math.sin(t * 2.2) * 0.3
        earL.current.rotation.y = -f
        earR.current.rotation.y = f
      } else {
        const tw = Math.sin(t * 5) > 0.92 ? 0.35 : 0
        earL.current.rotation.x = -tw - a.hopY
        earR.current.rotation.x = -tw * 0.6 - a.hopY
      }
    }
    if (shadow.current) shadow.current.visible = !hidden
  })

  return (
    <group ref={root}>
      <group ref={inner}>
        <mesh geometry={model.body} material={mat} />
        <mesh ref={legsA} geometry={model.legsA} material={mat} />
        <mesh ref={legsB} geometry={model.legsB} material={mat} />
        <group ref={head} position={model.head.pivot}>
          <mesh geometry={model.head.geo} material={mat} />
        </group>
        {model.tail && (
          <group ref={tail} position={model.tail.pivot}>
            <mesh geometry={model.tail.geo} material={mat} />
          </group>
        )}
        {model.earL && (
          <group ref={earL} position={model.earL.pivot}>
            <mesh geometry={model.earL.geo} material={mat} />
          </group>
        )}
        {model.earR && (
          <group ref={earR} position={model.earR.pivot}>
            <mesh geometry={model.earR.geo} material={mat} />
          </group>
        )}
      </group>
      <group ref={shadow}>
        <BlobShadow size={model.shadow} />
      </group>
    </group>
  )
}

export function AnimalViews() {
  // agents are created by the level before this mounts
  const list = useMemo(() => agents.map((a) => ({ a, m: animalModel(a.species, a.variant) })), [])
  return (
    <>
      {list.map(({ a, m }, i) => (
        <AnimalView key={i} agent={a} model={m} />
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Doves: perch in the big tree, circle it when the bell rings, then    */
/* stream into the ark door. Three instanced draws for the whole flock. */
/* ------------------------------------------------------------------ */

type Dove = {
  state: 'perch' | 'circle' | 'fly' | 'aboard'
  px: number
  py: number
  pz: number
  x: number
  y: number
  z: number
  yaw: number
  t: number
  delay: number
  // flight curve
  ax: number
  ay: number
  az: number
  bx: number
  by: number
  bz: number
  cx: number
  cy: number
  cz: number
  dur: number
}

export const DOVE_CANOPY_Y = 4.45

export function Doves({ onBoard }: { onBoard: (species: SpeciesId) => void }) {
  const geos = useMemo(doveGeometry, [])
  const bodyRef = useRef<THREE.InstancedMesh>(null)
  const wingLRef = useRef<THREE.InstancedMesh>(null)
  const wingRRef = useRef<THREE.InstancedMesh>(null)
  const onBoardRef = useRef(onBoard)
  useEffect(() => {
    onBoardRef.current = onBoard
  }, [onBoard])
  const doves = useMemo<Dove[]>(
    () =>
      Array.from({ length: DOVE_COUNT }, (_, i) => {
        const ang = (i / DOVE_COUNT) * Math.PI * 2 + (i % 2) * 0.2
        const r = i % 2 ? 1.05 : 0.5
        const px = DOVE_TREE.x + Math.cos(ang) * r
        const pz = DOVE_TREE.z + Math.sin(ang) * r
        const py = DOVE_CANOPY_Y + (i % 2 ? -0.48 : 0.02)
        return { state: 'perch', px, py, pz, x: px, y: py, z: pz, yaw: ang + Math.PI / 2, t: i * 0.37, delay: i * 0.14, ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, cx: 0, cy: 0, cz: 0, dur: 1 }
      }),
    [],
  )
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), w: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), hide: new THREE.Matrix4().makeScale(0, 0, 0) }), [])
  const flutterCd = useRef(0)
  const started = useRef(false)

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const b = bodyRef.current
    const wl = wingLRef.current
    const wr = wingRRef.current
    if (!b || !wl || !wr) return
    if (lvl.bellRung && !started.current) {
      started.current = true
      for (const d of doves) {
        d.state = 'circle'
        d.t = -d.delay
      }
      asfx.flutter()
    }
    flutterCd.current -= dt
    for (let i = 0; i < doves.length; i++) {
      const d = doves[i]
      d.t += dt
      let flap = 0
      let pitch = 0
      if (d.state === 'perch') {
        d.x = d.px
        d.z = d.pz
        d.y = d.py + Math.abs(Math.sin(d.t * 1.7 + i)) * 0.03
        pitch = Math.max(0, Math.sin(d.t * 0.9 + i * 1.3)) * 0.4 // pecking
        flap = Math.sin(d.t * 3 + i) > 0.97 ? 0.6 : 0.05
        if (Math.hypot(player.pos.x - DOVE_TREE.x, player.pos.z - DOVE_TREE.z) < 7 && flutterCd.current <= 0 && Math.random() < 0.01) {
          asfx.coo()
          flutterCd.current = 4
        }
      } else if (d.state === 'circle') {
        if (d.t < 0) continue
        // lift off and wheel round the tree once
        const k = Math.min(1, d.t / 2.2)
        const ang = Math.atan2(d.pz - DOVE_TREE.z, d.px - DOVE_TREE.x) + k * Math.PI * 2
        const r = 2.4 + k * 1.2
        d.x = DOVE_TREE.x + Math.cos(ang) * r
        d.z = DOVE_TREE.z + Math.sin(ang) * r
        d.y = DOVE_CANOPY_Y + Math.sin(k * Math.PI) * 1.6 + k * 1.2
        d.yaw = -ang
        flap = 1
        if (k >= 1) {
          d.state = 'fly'
          d.t = 0
          d.ax = d.x
          d.ay = d.y
          d.az = d.z
          d.cx = DOOR_X + ((i % 3) - 1) * 0.5
          d.cy = DECK_Y + 1.1 + (i % 2) * 0.4
          d.cz = HULL_FRONT - 1.2
          d.bx = (d.ax + d.cx) / 2
          d.by = Math.max(d.ay, d.cy) + 5
          d.bz = (d.az + d.cz) / 2 + 6
          d.dur = Math.hypot(d.cx - d.ax, d.cz - d.az) / 7 + 0.6
          if (i === 0) asfx.coo()
        }
      } else if (d.state === 'fly') {
        const k = Math.min(1, d.t / d.dur)
        const u = 1 - k
        const nx = u * u * d.ax + 2 * u * k * d.bx + k * k * d.cx
        const ny = u * u * d.ay + 2 * u * k * d.by + k * k * d.cy
        const nz = u * u * d.az + 2 * u * k * d.bz + k * k * d.cz
        d.yaw = Math.atan2(nx - d.x, nz - d.z)
        pitch = -Math.atan2(ny - d.y, Math.hypot(nx - d.x, nz - d.z) + 1e-4) * 0.6
        d.x = nx
        d.y = ny
        d.z = nz
        flap = 1
        if (k >= 1) {
          d.state = 'aboard'
          asfx.aboard()
          onBoardRef.current('doves')
        }
      }
      if (d.state === 'aboard') {
        b.setMatrixAt(i, tmp.hide)
        wl.setMatrixAt(i, tmp.hide)
        wr.setMatrixAt(i, tmp.hide)
        continue
      }
      const yaw = d.state === 'perch' ? d.yaw : d.state === 'circle' ? d.yaw : d.yaw
      tmp.q.setFromEuler(tmp.e.set(pitch, yaw, 0, 'YXZ'))
      tmp.m.compose(tmp.p.set(d.x, d.y, d.z), tmp.q, tmp.s)
      b.setMatrixAt(i, tmp.m)
      const ang = flap > 0.5 ? Math.sin(d.t * 26 + i) * 0.9 : flap * 0.8
      tmp.w.makeRotationZ(ang).setPosition(-0.09, 0.06, 0)
      wl.setMatrixAt(i, tmp.w.premultiply(tmp.m))
      tmp.w.makeRotationZ(-ang).setPosition(0.09, 0.06, 0)
      wr.setMatrixAt(i, tmp.w.premultiply(tmp.m))
    }
    b.instanceMatrix.needsUpdate = true
    wl.instanceMatrix.needsUpdate = true
    wr.instanceMatrix.needsUpdate = true
  })

  const mat = plasticVC()
  return (
    <>
      <instancedMesh ref={bodyRef} args={[geos.body, mat, DOVE_COUNT]} frustumCulled={false} />
      <instancedMesh ref={wingLRef} args={[geos.wingL, mat, DOVE_COUNT]} frustumCulled={false} />
      <instancedMesh ref={wingRRef} args={[geos.wingR, mat, DOVE_COUNT]} frustumCulled={false} />
    </>
  )
}

export function ringBell() {
  if (lvl.bellRung) return
  lvl.bellRung = true
  useAnimals.getState().setStatus('doves', 'found')
  toast(L().toastBell)
  sfx.pickup()
}
