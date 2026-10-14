// Level state for chapter 4. Kept local to this folder (the global store only
// holds screen, language, pause, toasts and studs).
import { create } from 'zustand'
import { SPECIES_ORDER, type SpeciesId } from '../../i18n/animals'

/** hidden: still at its spot. found: on its way (following Noah or walking). aboard: all through the door. */
export type SpeciesStatus = 'hidden' | 'found' | 'aboard'

export type Phase = 'play' | 'closing' | 'done'

export type ActionIcon = 'call' | 'smash' | 'build' | 'bell' | 'search' | 'catch'

type AnimalsState = {
  run: number
  phase: Phase
  status: Record<SpeciesId, SpeciesStatus>
  /** how many individuals of each species have walked through the door */
  boarded: Record<SpeciesId, number>
  sheepFound: number
  prompt: string | null
  promptIcon: ActionIcon | null
  buildProgress: number | null
  /** 0..1 storm amount: follows the number of species aboard */
  storm: number
  /** "Then the LORD shut him in." caption during the closing cutscene */
  caption: boolean
  setCaption: (c: boolean) => void
  setPrompt: (p: string | null, icon?: ActionIcon | null) => void
  setBuildProgress: (p: number | null) => void
  setStatus: (id: SpeciesId, s: SpeciesStatus) => void
  addBoarded: (id: SpeciesId) => number
  addSheepFound: () => number
  setPhase: (p: Phase) => void
  reset: () => void
}

const fresh = () => ({
  phase: 'play' as Phase,
  status: Object.fromEntries(SPECIES_ORDER.map((s) => [s, 'hidden'])) as Record<SpeciesId, SpeciesStatus>,
  boarded: Object.fromEntries(SPECIES_ORDER.map((s) => [s, 0])) as Record<SpeciesId, number>,
  sheepFound: 0,
  prompt: null,
  promptIcon: null,
  buildProgress: null,
  storm: 0,
  caption: false,
})

export const useAnimals = create<AnimalsState>((set, get) => ({
  run: 0,
  ...fresh(),
  setPrompt: (prompt, promptIcon = null) => {
    if (get().prompt !== prompt || get().promptIcon !== promptIcon) set({ prompt, promptIcon })
  },
  setBuildProgress: (buildProgress) => {
    if (get().buildProgress !== buildProgress) set({ buildProgress })
  },
  setStatus: (id, s) => {
    if (get().status[id] === s) return
    const status = { ...get().status, [id]: s }
    const aboard = SPECIES_ORDER.filter((k) => status[k] === 'aboard').length
    set({ status, storm: aboard / SPECIES_ORDER.length })
  },
  addBoarded: (id) => {
    const n = get().boarded[id] + 1
    set({ boarded: { ...get().boarded, [id]: n } })
    return n
  },
  addSheepFound: () => {
    const n = get().sheepFound + 1
    set({ sheepFound: n })
    return n
  },
  setPhase: (phase) => set({ phase }),
  setCaption: (caption) => set({ caption }),
  reset: () => set({ ...fresh(), run: get().run + 1 }),
}))

export const aboardCount = (s: Record<SpeciesId, SpeciesStatus>) => SPECIES_ORDER.filter((k) => s[k] === 'aboard').length
