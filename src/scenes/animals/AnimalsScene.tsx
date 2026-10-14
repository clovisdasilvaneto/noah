// Chapter 4 playable level: Noah finds the animals around the finished ark;
// each pair follows him or walks on its own up the ramp and through the door.
// When everyone is aboard the family and Noah go in and "the LORD shut him
// in" (Genesis 7:16) while the storm rolls in.
import { useCallback, useMemo, useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Beam, Motes } from '../../three/common'
import { Effects, fx } from '../../three/Effects'
import { camFx, clearWorld, player } from '../../game/world'
import { input } from '../../game/input'
import { sfx } from '../../game/audio'
import { useGame } from '../../store'
import { ANIMALS_STRINGS, SPECIES_ORDER, type SpeciesId } from '../../i18n/animals'
import { PlacedStuds, type PlacedStud } from '../gather/Props'
import { useAnimals, aboardCount } from './state'
import { AnimalsPlayer, AnimalsCamera } from './AnimalsPlayer'
import { AnimalsBrain, AnimalViews, Doves, agents, lvl, resetAnimals, speciesTotal } from './Animals'
import { Ark, DOOR_OPEN, Family, arkFx, closing } from './Ark'
import { BellPost, DoveTree, FallenLog, GiraffeHill, Pond, RabbitPen, StreamAndBridge, TallGrass } from './LevelProps'
import { AnimalsWorld } from './World'
import { AnimalsGuide } from './Guide'
import { AnimalsHUDView, AnimalsResults } from './AnimalsHUD'
import { asfx } from './asfx'
import {
  APPROACH,
  BELL,
  BELL_TOP,
  CLEARING,
  DECK_Y,
  DOOR_X,
  HILL,
  HILL_TIERS,
  HULL_FRONT,
  PEN,
  POND,
  RAMP_FOOT,
  RAMP_RUN,
  START,
  ainteract,
  camOverride,
  clearLevelRegistries,
  noahScript,
} from './layout'

const L = () => ANIMALS_STRINGS[useGame.getState().lang ?? 'en']

function studLayout(): PlacedStud[] {
  const out: PlacedStud[] = []
  const trail = (ax: number, az: number, bx: number, bz: number, n: number, y = 0.7) => {
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1)
      out.push({ p: [ax + (bx - ax) * k, y, az + (bz - az) * k], value: 10 })
    }
  }
  trail(3, -4.5, 3, 4, 8)
  trail(-1, -2.4, -11.5, 0.2, 8)
  trail(5.5, -0.8, 13.4, 0, 7)
  trail(5, 7, 12, 10.2, 6)
  trail(-1.5, -9.6, -10.5, -11.2, 7)
  trail(POND.x - 2.4, POND.z + POND.r + 0.6, POND.x + 2.4, POND.z + POND.r + 0.6, 5, 0.55)
  // rewards for climbing and exploring
  out.push({ p: [BELL.x + 0.3, BELL_TOP + 0.6, BELL.z + 0.4], value: 100 })
  out.push({ p: [HILL.x + HILL_TIERS[0].hw - 0.5, HILL_TIERS[0].top + 0.55, HILL.z + 2.5], value: 100 })
  out.push({ p: [HILL.x + HILL_TIERS[1].hw - 0.5, HILL_TIERS[1].top + 0.55, HILL.z - 1.6], value: 100 })
  out.push({ p: [HILL.x + 1.2, HILL_TIERS[2].top + 0.6, HILL.z - 1.2], value: 1000 })
  out.push({ p: [PEN.x - 2.8, 0.55, PEN.z + 1.8], value: 100 }, { p: [PEN.x + 3.4, 0.55, PEN.z + 2.2], value: 100 })
  out.push({ p: [CLEARING.x + 1.8, 0.55, CLEARING.z - 1.4], value: 100 }, { p: [CLEARING.x, 0.55, CLEARING.z + 2.2], value: 100 })
  out.push({ p: [24.5, 0.55, 4.5], value: 1000 })
  trail(20, -5, 25, -5, 5, 0.55)
  return out
}

/** Boarding tally, cheering, and the closing cutscene timeline. */
function Director() {
  const [shut, setShut] = useState(false)
  const done = useRef({ creak: false, thud: false, thunder: false, end: false })

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    arkFx.cheer = Math.max(0, arkFx.cheer - dt)
    const lv = useAnimals.getState()
    if (lv.phase === 'play' && aboardCount(lv.status) === SPECIES_ORDER.length && closing.t < 0) {
      closing.t = 0
      lv.setPhase('closing')
      useGame.getState().toast(L().toastAllAboard)
      sfx.complete()
      camOverride.active = true
      camOverride.x = DOOR_X - 0.5
      camOverride.y = 3.4
      camOverride.z = HULL_FRONT + 2.4
      camOverride.dist = 1
      // Noah joins the family; from far away he is brought to the yard (the camera is on the door)
      const far = Math.hypot(player.pos.x - APPROACH[0], player.pos.z - APPROACH[1]) > 9 || player.pos.y > 0.5
      noahScript.active = true
      noahScript.visible = true
      noahScript.x = far ? APPROACH[0] - 2.6 : player.pos.x
      noahScript.z = far ? APPROACH[1] + 1.2 : player.pos.z
      noahScript.y = 0
      noahScript.facing = Math.PI
      noahScript.speed = 0
    }
    if (closing.t < 0) return
    closing.t += dt
    const t = closing.t
    const d = done.current

    // Noah walks to the ramp, up and in
    if (noahScript.visible && t > 3.2) {
      const onRamp = noahScript.z < RAMP_FOOT[1] + 0.15
      const tx = DOOR_X
      const tz = onRamp || Math.hypot(noahScript.x - DOOR_X, noahScript.z - RAMP_FOOT[1]) < 0.2 ? HULL_FRONT - 1.8 : RAMP_FOOT[1]
      const dx = tx - noahScript.x
      const dz = tz - noahScript.z
      const dist = Math.hypot(dx, dz)
      const step = Math.min(dist, 2.6 * dt)
      if (dist > 1e-3) {
        noahScript.x += (dx / dist) * step
        noahScript.z += (dz / dist) * step
        noahScript.facing = Math.atan2(dx, dz)
      }
      noahScript.speed = 0.6
      const k = Math.min(1, Math.max(0, (HULL_FRONT + RAMP_RUN - noahScript.z) / RAMP_RUN))
      noahScript.y = DECK_Y * k
      if (noahScript.z < HULL_FRONT - 1.4) noahScript.visible = false
    } else if (noahScript.visible) {
      noahScript.facing = Math.atan2(DOOR_X - noahScript.x, HULL_FRONT - noahScript.z)
    }

    // the door swings up and shuts
    if (t > 7.4) {
      if (!d.creak) {
        d.creak = true
        asfx.doorCreak()
      }
      const k = Math.min(1, (t - 7.4) / 2)
      arkFx.doorAngle = DOOR_OPEN * (1 - k * k)
      if (k >= 1 && !d.thud) {
        d.thud = true
        asfx.doorThud()
        sfx.divine()
        camFx.shake = 1
        fx.burst(DOOR_X, DECK_Y + 1.4, HULL_FRONT + 0.4, ['#ffffff', '#fff3c4', '#ffe08a'], 30, 1)
        lv.setCaption(true)
        setShut(true)
      }
    }
    if (t > 10.6 && !d.thunder) {
      d.thunder = true
      asfx.thunder()
    }
    if (t > 14 && !d.end) {
      d.end = true
      lv.setCaption(false)
      lv.setPhase('done')
      useGame.getState().setScreen('animalsComplete')
    }
  })

  if (!shut) return null
  return (
    <group position={[DOOR_X, 0, HULL_FRONT]}>
      <Beam radius={3.2} height={30} position={[0, 15, 0]} color="#fff6d6" intensity={1.1} />
      <Motes count={50} area={[8, 4]} height={7} color="#ffe7a6" size={8} rise={1.2} />
    </group>
  )
}

function AnimalsLevel() {
  const placedStuds = useMemo(studLayout, [])
  // registries are module-level: start every run clean
  useMemo(() => {
    clearWorld()
    clearLevelRegistries()
    resetAnimals()
    closing.t = -1
    arkFx.doorAngle = DOOR_OPEN
    arkFx.cheer = 0
  }, [])
  useEffect(
    () => () => {
      clearWorld()
      clearLevelRegistries()
    },
    [],
  )

  const onBoard = useCallback((species: SpeciesId) => {
    const st = useAnimals.getState()
    const n = st.addBoarded(species)
    if (n < speciesTotal(species)) return
    st.setStatus(species, 'aboard')
    useGame.getState().toast(L().species[species].aboard)
    sfx.built()
    fx.studs(DOOR_X, DECK_Y + 0.6, HULL_FRONT + 1.2, 500)
    arkFx.cheer = 1.8
  }, [])

  return (
    <>
      <AnimalsWorld />
      <Ark />
      <Family />
      <FallenLog />
      <TallGrass />
      <StreamAndBridge />
      <BellPost />
      <DoveTree />
      <GiraffeHill />
      <RabbitPen />
      <Pond />
      <AnimalsBrain onBoard={onBoard} />
      <AnimalViews />
      <Doves onBoard={onBoard} />
      <PlacedStuds studs={placedStuds} />
      <Motes count={160} area={[56, 50]} height={6} color="#fff6c8" size={4} rise={0.12} />
      <AnimalsGuide />
      <Director />
      <AnimalsPlayer start={START} />
      <AnimalsCamera />
      <Effects />
      {import.meta.env.DEV && <DebugGl />}
    </>
  )
}

/** Dev only: lets playtests read renderer stats. */
function DebugGl() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const h = (window as unknown as { __animals?: Record<string, unknown> }).__animals
    if (h) h.gl = gl
  }, [gl])
  return null
}

export function AnimalsScene() {
  const run = useAnimals((s) => s.run)
  return <AnimalsLevel key={run} />
}

function restart() {
  startAnimalsLevel()
  useGame.getState().setScreen('animals')
}

/** HUD overlay while the level is playing. */
export function AnimalsHUD() {
  return <AnimalsHUDView restart={restart} />
}

/** Results screen; its Continue goes to 'chapterFlood'. */
export function AnimalsComplete() {
  return <AnimalsResults restart={restart} />
}

/** Called when the chapter card hands over to the level (reset level state here). */
export function startAnimalsLevel() {
  // resets studs, toasts and the shared prompt; the gather level isn't mounted here
  useGame.getState().restartLevel()
  useAnimals.getState().reset()
}

export const animalsTitle: Record<string, string> = {
  en: ANIMALS_STRINGS.en.title,
  pt: ANIMALS_STRINGS.pt.title,
  es: ANIMALS_STRINGS.es.title,
  de: ANIMALS_STRINGS.de.title,
}

if (import.meta.env.DEV) {
  // debug handle for automated playtests; stripped from production builds
  ;(window as unknown as Record<string, unknown>).__animals = {
    useAnimals,
    agents,
    lvl,
    ainteract,
    player,
    closing,
    camOverride,
    noahScript,
    input,
    tele: (x: number, z: number, y = 0) => {
      player.pos.set(x, y, z)
      player.vel.set(0, 0, 0)
    },
    start: () => {
      useGame.getState().setScreen('chapterAnimals')
      startAnimalsLevel()
      useGame.getState().setScreen('animals')
    },
  }
}
