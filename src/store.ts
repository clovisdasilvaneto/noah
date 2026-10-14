import { create } from 'zustand'
import { STRINGS, type Lang } from './i18n/strings'

export type PromptKind = 'chop' | 'smash' | 'build' | null

export type Screen =
  | 'language'
  | 'title'
  | 'chapterCall' // ch1 cutscene: God speaks to Noah
  | 'call'
  | 'chapterGather' // ch2 level: build the ark
  | 'gather'
  | 'complete'
  | 'chapterAnimalsCall' // ch3 cutscene: God sends Noah for the animals
  | 'animalsCall'
  | 'chapterAnimals' // ch4 level: gather the animals
  | 'animals'
  | 'animalsComplete'
  | 'chapterFlood' // ch5 finale: the flood
  | 'flood'

export const WOOD_GOAL = 5
export const PITCH_GOAL = 3
export const PLANK_GOAL = 3
export const DECK_GOAL = 3
export const COAT_GOAL = 4
export const FAITH_GOAL = 3000

type Toast = { id: number; text: string }

export type GameState = {
  screen: Screen
  lang: Lang | null
  paused: boolean
  // gather level progress
  studs: number
  wood: number
  pitch: number
  cauldronBuilt: boolean
  keelBuilt: boolean
  /** plank loads delivered to the ark site */
  planks: number
  /** Noah has a plank load on his shoulders */
  carrying: boolean
  decks: number
  /** bit i = pitch patch i coated */
  coatMask: number
  roofBuilt: boolean
  /** the door is in: the ark is finished and the level is won */
  arkComplete: boolean
  prompt: string | null
  promptKind: PromptKind
  muted: boolean
  buildProgress: number | null
  toasts: Toast[]
  levelRun: number
  setScreen: (s: Screen) => void
  setLang: (l: Lang) => void
  setPaused: (p: boolean) => void
  addStuds: (n: number) => void
  addWood: () => void
  addPitch: () => void
  setCauldronBuilt: () => void
  setKeelBuilt: () => void
  pickPlank: () => void
  dropPlank: () => void
  addDeck: () => void
  coatPatch: (i: number) => void
  setRoofBuilt: () => void
  setArkComplete: () => void
  setPrompt: (p: string | null, kind?: PromptKind) => void
  toggleMuted: () => void
  setBuildProgress: (p: number | null) => void
  toast: (text: string) => void
  restartLevel: () => void
}

function loadLang(): Lang | null {
  try {
    const v = localStorage.getItem('noah.lang')
    return v === 'pt' || v === 'en' || v === 'es' || v === 'de' ? v : null
  } catch {
    return null
  }
}

function loadMuted() {
  try {
    return localStorage.getItem('noah.muted') === '1'
  } catch {
    return false
  }
}

let toastId = 0

const levelReset = {
  studs: 0,
  wood: 0,
  pitch: 0,
  cauldronBuilt: false,
  keelBuilt: false,
  planks: 0,
  carrying: false,
  decks: 0,
  coatMask: 0,
  roofBuilt: false,
  arkComplete: false,
  prompt: null,
  promptKind: null as PromptKind,
  buildProgress: null,
  toasts: [] as Toast[],
}

export const useGame = create<GameState>((set, get) => ({
  screen: 'language',
  lang: loadLang(),
  paused: false,
  muted: loadMuted(),
  ...levelReset,
  levelRun: 0,
  setScreen: (screen) => set({ screen, paused: false }),
  setLang: (lang) => {
    try {
      localStorage.setItem('noah.lang', lang)
    } catch {
      /* storage unavailable: language just won't persist */
    }
    set({ lang })
  },
  setPaused: (paused) => set({ paused }),
  addStuds: (n) => set({ studs: get().studs + n }),
  addWood: () => set({ wood: get().wood + 1 }),
  addPitch: () => set({ pitch: get().pitch + 1 }),
  setCauldronBuilt: () => set({ cauldronBuilt: true }),
  setKeelBuilt: () => set({ keelBuilt: true }),
  pickPlank: () => set({ carrying: true }),
  dropPlank: () => set({ carrying: false, planks: get().planks + 1 }),
  addDeck: () => set({ decks: get().decks + 1 }),
  coatPatch: (i) => set({ coatMask: get().coatMask | (1 << i) }),
  setRoofBuilt: () => set({ roofBuilt: true }),
  setArkComplete: () => set({ arkComplete: true }),
  setPrompt: (prompt, promptKind = null) => {
    if (get().prompt !== prompt || get().promptKind !== promptKind) set({ prompt, promptKind })
  },
  toggleMuted: () => {
    const muted = !get().muted
    try {
      localStorage.setItem('noah.muted', muted ? '1' : '0')
    } catch {
      /* not persisted */
    }
    set({ muted })
  },
  setBuildProgress: (buildProgress) => {
    if (get().buildProgress !== buildProgress) set({ buildProgress })
  },
  toast: (text) => {
    const id = ++toastId
    set({ toasts: [...get().toasts, { id, text }].slice(-3) })
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 2200)
  },
  restartLevel: () => set({ ...levelReset, paused: false, levelRun: get().levelRun + 1 }),
}))

export function coatCount(mask: number) {
  let n = 0
  for (let m = mask; m; m &= m - 1) n++
  return n
}

/** Gather-level step: 0 wood, 1 cauldron, 2 pitch, 3 keel, 4 planks, 5 decks, 6 coat, 7 roof, 8 door, 9 done. */
export function gatherStep(st: GameState) {
  if (st.wood < WOOD_GOAL) return 0
  if (!st.cauldronBuilt) return 1
  if (st.pitch < PITCH_GOAL) return 2
  if (!st.keelBuilt) return 3
  if (st.planks < PLANK_GOAL) return 4
  if (st.decks < DECK_GOAL) return 5
  if (coatCount(st.coatMask) < COAT_GOAL) return 6
  if (!st.roofBuilt) return 7
  if (!st.arkComplete) return 8
  return 9
}

export function useT() {
  const lang = useGame((s) => s.lang) ?? 'en'
  return STRINGS[lang]
}

export function t() {
  return STRINGS[useGame.getState().lang ?? 'en']
}
