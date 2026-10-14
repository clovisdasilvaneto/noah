import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { useGame, useT, type Screen } from './store'
import { initKeyboard, isTouchDevice } from './game/input'
import { playMusic, setMuted, startAmbience, stopAmbience, suspendAudio, type MusicTrack } from './game/audio'
import { cancelNarration, pauseNarration, playNarration, setNarrationMuted } from './game/narration'
import { CallScene, cutscene } from './scenes/CallScene'
import { GatherScene } from './scenes/gather/GatherScene'
import { AnimalsCallOverlay, AnimalsCallScene, animalsCallTitle } from './scenes/AnimalsCallScene'
import { AnimalsComplete, AnimalsHUD, AnimalsScene, animalsTitle, startAnimalsLevel } from './scenes/animals/AnimalsScene'
import { FloodOverlay, FloodScene, floodTitle } from './scenes/flood/FloodScene'
import { ChapterCard, CompleteScreen, TitleScreen } from './ui/Screens'
import { LanguageSelect } from './ui/LanguageSelect'
import { Dialogue } from './ui/Dialogue'
import { HUD } from './ui/HUD'

const MUSIC_FOR: Record<Screen, MusicTrack> = {
  language: 'menu',
  title: 'menu',
  chapterCall: 'menu',
  call: 'call',
  chapterGather: 'menu',
  gather: 'gather',
  complete: 'complete',
  chapterAnimalsCall: 'menu',
  animalsCall: 'call',
  chapterAnimals: 'menu',
  animals: 'animals',
  animalsComplete: 'complete',
  chapterFlood: 'menu',
  // the finale starts on the storm bed; FloodScene switches tracks per beat
  flood: 'storm',
}

const SCENES_3D: Screen[] = ['call', 'gather', 'complete', 'animalsCall', 'animals', 'animalsComplete', 'flood']

const MAX_DPR = isTouchDevice ? 1.5 : 2

function World() {
  const screen = useGame((s) => s.screen)
  const paused = useGame((s) => s.paused)
  const [dpr, setDpr] = useState(MAX_DPR)
  return (
    <Canvas
      className="world"
      dpr={[1, dpr]}
      frameloop={paused ? 'never' : 'always'}
      // phones already render at up to 1.5x DPR, so skip MSAA there
      gl={{ antialias: !isTouchDevice, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 45, near: 0.1, far: 220, position: [0, 9, 12] }}
    >
      {/* drop resolution on slow phones instead of dropping frames */}
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(MAX_DPR)} flipflops={3} />
      <Suspense fallback={null}>
        {screen === 'call' && <CallScene />}
        {(screen === 'gather' || screen === 'complete') && <GatherScene />}
        {screen === 'animalsCall' && <AnimalsCallScene />}
        {(screen === 'animals' || screen === 'animalsComplete') && <AnimalsScene />}
        {screen === 'flood' && <FloodScene />}
      </Suspense>
    </Canvas>
  )
}

function CallOverlay() {
  const s = useT()
  const setScreen = useGame((st) => st.setScreen)
  const lines = useMemo(() => [...s.callLines, s.afterCall], [s])
  useEffect(() => {
    cutscene.line = 0
    cutscene.total = lines.length
  }, [lines])
  const lang = useGame((st) => st.lang) ?? 'en'
  const onLine = useCallback(
    (i: number) => {
      cutscene.line = i
      void playNarration(lang, i < lines.length - 1 ? `call-${i}` : 'after')
    },
    [lang, lines.length],
  )
  const onDone = useCallback(() => setScreen('chapterGather'), [setScreen])
  return <Dialogue lines={lines} onLine={onLine} onDone={onDone} letterbox />
}

export default function App() {
  const screen = useGame((s) => s.screen)
  const setScreen = useGame((s) => s.setScreen)
  const restart = useGame((s) => s.restartLevel)
  const s = useT()
  const paused = useGame((st) => st.paused)
  const muted = useGame((st) => st.muted)
  useEffect(() => initKeyboard(), [])
  useEffect(() => {
    setMuted(muted)
    setNarrationMuted(muted)
  }, [muted])
  useEffect(() => {
    suspendAudio(paused)
    pauseNarration(paused)
  }, [paused])
  useEffect(() => {
    if (screen === 'call') startAmbience('night')
    else if (screen === 'gather' || screen === 'animals' || screen === 'animalsCall') startAmbience('day')
    else if (screen !== 'complete' && screen !== 'animalsComplete' && screen !== 'flood') stopAmbience()
    // scenes with their own narration keep it; everything else cuts it
    if (!['call', 'complete', 'animalsCall', 'animalsComplete', 'flood'].includes(screen)) cancelNarration()
    void playMusic(MUSIC_FOR[screen])
  }, [screen])
  const toCall = useCallback(() => setScreen('call'), [setScreen])
  const toGather = useCallback(() => {
    restart()
    setScreen('gather')
  }, [restart, setScreen])
  const lang = useGame((st) => st.lang) ?? 'en'
  const toAnimalsCall = useCallback(() => setScreen('animalsCall'), [setScreen])
  const toAnimals = useCallback(() => {
    startAnimalsLevel()
    setScreen('animals')
  }, [setScreen])
  const toFlood = useCallback(() => setScreen('flood'), [setScreen])

  const show3D = SCENES_3D.includes(screen)
  return (
    <div className="app">
      {show3D && <World />}
      <div className="vignette" aria-hidden />
      {screen === 'language' && <LanguageSelect />}
      {screen === 'title' && <TitleScreen />}
      {screen === 'chapterCall' && <ChapterCard number={1} title={s.chapterCallTitle} image="/art/chapter-call.jpg" next={toCall} />}
      {screen === 'call' && <CallOverlay />}
      {screen === 'chapterGather' && (
        <ChapterCard number={2} title={s.chapterGatherTitle} image="/art/chapter-gather.jpg" next={toGather} />
      )}
      {screen === 'gather' && <HUD />}
      {screen === 'complete' && <CompleteScreen />}
      {screen === 'chapterAnimalsCall' && (
        <ChapterCard number={3} title={animalsCallTitle[lang]} image="/art/chapter-animals-call.jpg" next={toAnimalsCall} />
      )}
      {screen === 'animalsCall' && <AnimalsCallOverlay />}
      {screen === 'chapterAnimals' && (
        <ChapterCard number={4} title={animalsTitle[lang]} image="/art/chapter-animals.jpg" next={toAnimals} />
      )}
      {screen === 'animals' && <AnimalsHUD />}
      {screen === 'animalsComplete' && <AnimalsComplete />}
      {screen === 'chapterFlood' && <ChapterCard number={5} title={floodTitle[lang]} image="/art/chapter-flood.jpg" next={toFlood} />}
      {screen === 'flood' && <FloodOverlay />}
    </div>
  )
}
