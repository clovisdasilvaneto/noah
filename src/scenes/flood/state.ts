import { create } from 'zustand'

/**
 * The finale runs in four phases:
 *  storyA: lines 0..DOVE_AFTER (storm, sailing, rest on Ararat, the dove is sent)
 *  dove:   the interactive flight to the olive tree
 *  storyB: lines DOVE_AFTER+1..end (leaf, coming out, altar, rainbow)
 *  end:    "The End" card and credits over the rainbow
 */
export type Phase = 'storyA' | 'dove' | 'storyB' | 'end'
export type DoveStage = 'ready' | 'fly' | 'found' | 'return' | 'done'

/** Re-rendering UI state (changes a handful of times per run). */
export const useFlood = create<{
  phase: Phase
  /** first line shown when a dialogue phase mounts (debug jumps start mid-way) */
  startAt: number
  doveStage: DoveStage
  stars: number
  run: number
}>(() => ({ phase: 'storyA', startAt: 0, doveStage: 'ready', stars: 0, run: 0 }))

/**
 * Per-frame state shared by the overlay (writer) and the 3D scene (reader).
 * A plain object, so writing it never re-renders anything.
 */
export const story = {
  line: 0,
  phase: 'storyA' as Phase,
  /** jump all smoothed scene values straight to their targets (skip / debug jump) */
  snap: true,
  dove: {
    stage: 'ready' as DoveStage,
    /** steering target from pointer or keys, -1..1 on each axis */
    tx: 0,
    ty: 0,
    /** seconds since the last steering input (auto-pilot recentres after a while) */
    idle: 0,
    release: false,
  },
}

export function resetFlood(startPhase: Phase = 'storyA', startAt = 0) {
  story.line = startAt
  story.phase = startPhase
  story.snap = true
  story.dove.stage = startPhase === 'dove' ? 'ready' : startPhase === 'storyA' ? 'ready' : 'done'
  story.dove.tx = story.dove.ty = story.dove.idle = 0
  story.dove.release = false
  useFlood.setState((s) => ({ phase: startPhase, startAt, doveStage: story.dove.stage, stars: 0, run: s.run + 1 }))
}

export function setPhase(phase: Phase, startAt: number) {
  story.phase = phase
  story.line = startAt
  useFlood.setState({ phase, startAt })
}

export function setDoveStage(stage: DoveStage) {
  story.dove.stage = stage
  useFlood.setState({ doveStage: stage })
}

/** A pending jump requested by the dev handle before the screen mounted. */
export const pending: { jump: { phase: Phase; line: number; at: number } | null } = { jump: null }
