# Noah's Ark — Brick by Brick

A LEGO-games-style 3D Bible adventure for kids, built with Vite, React and React Three Fiber.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Flow

1. **Language**: Português, English, Español or Deutsch (saved in localStorage).
2. **Chapter 1, God speaks to Noah**: a night cutscene on a brick hilltop with a scripted cinematic camera (`src/scenes/cutscene/rig.ts`). Genesis 6:9, 6:13–21; a blueprint ark builds itself in the sky.
3. **Chapter 2, Gopher wood and pitch**: the playable level, in 9 steps: chop 5 gopher-wood trees, build the pitch cauldron, collect 3 pitch jars, build the keel, carry 3 plank bundles, build the three decks, coat the hull with pitch in 4 places, build the roof and window, put the door in the side. Then a celebration and results (Genesis 6:22).
4. **Chapter 3, Two by two**: a golden-hour cutscene beside the finished ark (Genesis 7:1–5).
5. **Chapter 4, Gathering the animals**: the second level (`src/scenes/animals/`). Eight kinds of animal, each with a mini-challenge (lions in tall grass, elephants behind a log, giraffes on a hill, zebras across a stream, 6 lost sheep, rabbits in a pen, slow turtles to escort, doves called with a bell). The storm builds as they board; ends with Genesis 7:16.
6. **Chapter 5, The flood and the promise**: the finale (`src/scenes/flood/`). Storm, the ark on the waters, the waters recede, an interactive dove flight to the olive tree, the animals leave the ark, the altar, the rainbow covenant (Genesis 7–9), then *The End* and credits.

Scripture text (Genesis 6) by language:

| Lang | Translation |
| --- | --- |
| EN | Berean Standard Bible (public domain), as used by shofar-app.com |
| PT | João Ferreira de Almeida, *Revista e Corrigida*, Lisbon 1911 (public domain; [Project Gutenberg #62383](https://www.gutenberg.org/ebooks/62383)). Words unchanged, only the spelling is modernised. |
| ES | Reina-Valera 1909 (public domain) |
| DE | Elberfelder 1871 (public domain) |

Fonts are the Shofar ones: **Cormorant Garamond** for scripture and **DM Sans** for the UI.

## Controls

| | Keyboard | Touch |
| --- | --- | --- |
| Move | WASD / arrows | floating joystick (left half of the screen) |
| Jump (double jump) | Space | ⤒ button |
| Chop / smash | E (tap) | ✋ button (tap) |
| Build | E (hold) | ✋ button (hold) |
| Pause | Esc / P | ❚❚ button |

## Rendering and performance notes

- **Plastic look**: `MeshStandardMaterial` with low roughness, a fresnel rim injected through `onBeforeCompile`, and a procedural `RoomEnvironment` that is prefiltered once, so there are no HDR downloads. Every plastic material shares one shader program.
- **Baseplate ground**: studs are drawn procedurally in a fragment shader on a single quad, and fade with distance.
- **No shadow maps**: blob shadows only.
- **Instancing**: scenery (forest, hills, paths) uses one `InstancedMesh` per brick shape. Brick debris and studs are pooled instanced meshes with no allocations per frame.
- **Shader particles**: motes, sparkles and god-ray dust animate entirely in the vertex shader, so they cost no CPU per frame.
- **Mobile limits**: device pixel ratio is capped at 1.5 on touch devices, and drei's `PerformanceMonitor` drops it to 1 on slow phones. The frame loop stops while paused.
- **Assets**: sound effects and ambience are synthesized with WebAudio. Voice and music files are streamed on demand. The only images are three painted backdrops made with fal.ai FLUX.1 schnell (`public/art`); the flags are drawn in code.

## Audio and characters

- **Narration:** all 128 voice clips (32 lines in each of PT, EN, ES and DE) are generated with fal.ai `google/gemini-3.8-flash-tts`. The narrator is the "Sulafat" voice and God is "Charon". The clips cover chapters 1–2, the Chapter 3 cutscene (`animals-call-*`), the Chapter 4 results verse (`animals-final`) and the 14 finale lines (`flood-*`). They are normalized to about −17 LUFS and live in `public/audio/voice/{lang}/`, listed in `manifest.json`; each loads only when its line plays.
- **Music:** one track per scenario, generated with fal.ai `stable-audio-3/small` and stored in `public/audio/music/`: `menu` (title and chapter cards), `call` (cutscenes), `gather` (Chapter 2), `animals` (the Chapter 4 animal round-up), `complete` (the results fanfare for chapters 2 and 4, played once), `storm` (the finale while the waters rise), and `promise` (the rainbow, the end card and the credits). In the finale the music follows the story: `storm` first, then `call` when God remembers Noah (Genesis 8:1), then `promise` from the rainbow (9:13) on. Tracks crossfade through WebAudio and get quieter during narration.
- **Ambience:** synthesized wind at night, and wind plus birdsong in the day. The finale adds synthesized rain, then a storm with wind and thunder timed to the lightning, and goes back to the daytime ambience once the waters go down.
- **NPCs:** Noah's wife; his sons Shem, Ham and Japheth (Genesis 6:10, 6:18); two villagers; and a pair of sheep. Each wanders near a home spot, turns and waves when Noah comes near, and shows a localized speech bubble.

## Physics

- Jumping has coyote time, input buffering, a double jump, and a shorter hop if you release early. Falls are faster than rises.
- Noah lands on anything low enough: crates, bushes, pots, fences, stumps, and the crate stairs.
- The floor plates (paths and the ark site) sit on a fixed grid, so they never overlap or flicker, and they raise the ground under Noah and the NPCs.

## Structure

```
src/
  i18n/strings.ts        UI text and scripture in 4 languages
  store.ts               zustand game state
  game/                  input, audio, world registries (colliders, interactables)
  three/                 bricks + plastic material, shaders, minifig, particle FX
  scenes/CallScene.tsx   cutscene
  scenes/gather/         playable level (player + camera, props, scene)
  ui/                    screens, dialogue, HUD + touch controls
```
