import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Brick, StaticBricks, type StaticBrick } from '../../three/common'
import { BH, COLORS, PLATE, brickGeometry, plastic } from '../../three/bricks'
import { Minifig, NOAH, makePose, type Look } from '../../three/Minifig'
import { DECK_Y } from './layout'
import { sim } from './sim'
import { Sheep, Lion } from './Animals'

type V3 = [number, number, number]

const ROOF = '#8a2f22'
const ROOF_DARK = '#6e241a'
const HULL_DOOR_X = 1.6

/** Fill a w x d stud rectangle at height y with 4x2 bricks (2x2 at the ends), offset every other row like real masonry. */
function layer(out: StaticBrick[], w: number, d: number, y: number, color: string, alt: string, odd: boolean) {
  for (let row = 0; row < d / 2; row++) {
    const z = (row * 2 + 1 - d / 2) * 0.4
    let x0 = 0
    const start = odd ? 2 : 0
    if (start) {
      out.push({ w: 2, d: 2, c: alt, p: [(1 - w / 2) * 0.4, y, z] })
      x0 = 2
    }
    while (x0 < w) {
      const len = Math.min(4, w - x0)
      const cx = (x0 + len / 2 - w / 2) * 0.4
      out.push({ w: len, d: 2, c: (x0 / 4 + row) % 3 === 0 ? alt : color, p: [cx, y, z] })
      x0 += len
    }
  }
}

/** The ark's hull, deck house and roof as one baked list (local space, door on the +z side). */
function arkBricks() {
  const hull: StaticBrick[] = []
  const front: StaticBrick[] = []
  const windows: StaticBrick[] = []
  const frontWindows: StaticBrick[] = []
  // hull: keel up to the gunwale, widening as it rises
  layer(hull, 12, 4, 0, COLORS.reddishBrown, COLORS.brown, false)
  layer(hull, 14, 6, BH, COLORS.brown, COLORS.reddishBrown, true)
  layer(hull, 16, 6, BH * 2, COLORS.gopher, '#a96a31', false)
  layer(hull, 16, 6, BH * 3, COLORS.brown, COLORS.gopher, true)
  // the doorway: dark bricks standing just proud of the hull, hidden behind the shut ramp
  for (let k = 1; k < 4; k++) hull.push({ w: 4, d: 1, studs: false, c: COLORS.pitch, p: [HULL_DOOR_X, BH * k, 1.05] })
  // gunwale trim
  hull.push({ w: 16, d: 1, h: 1 / 3, c: COLORS.reddishBrown, p: [0, DECK_Y, 1.0] })
  hull.push({ w: 16, d: 1, h: 1 / 3, c: COLORS.reddishBrown, p: [0, DECK_Y, -1.0] })
  // curled bow and stern
  for (const s of [-1, 1]) {
    hull.push({ w: 1, d: 4, c: COLORS.brown, p: [s * 3.4, BH * 2, 0] })
    hull.push({ w: 1, d: 4, c: COLORS.brown, p: [s * 3.4, BH * 3, 0] })
    hull.push({ w: 1, d: 2, c: COLORS.reddishBrown, p: [s * 3.6, BH * 4, 0] })
    hull.push({ w: 1, d: 2, c: COLORS.reddishBrown, p: [s * 3.8, BH * 5, 0] })
  }
  // deck house: back and side walls (the front wall is separate so it can open for the cutaway)
  for (let k = 0; k < 4; k++) {
    const y = DECK_Y + k * BH
    const col = k % 2 ? COLORS.tan : COLORS.darkTan
    for (let x = -1.6; x <= 1.61; x += 0.8) {
      const win = k === 2 && Math.abs(Math.abs(x) - 0.8) < 0.01
      ;(win ? windows : hull).push({ w: 2, d: 1, c: win ? '#ffd76a' : col, p: [x, y, -0.6] })
      ;(win ? frontWindows : front).push({ w: 2, d: 1, c: win ? '#ffd76a' : col, p: [x, y, 0.6] })
    }
    for (const s of [-1, 1]) hull.push({ w: 1, d: 2, c: col, p: [s * 1.8, y, 0] })
  }
  // roof: a wide plate then two stepped courses
  hull.push({ w: 12, d: 6, h: 1 / 3, studs: false, c: ROOF_DARK, p: [0, DECK_Y + BH * 4, 0] })
  hull.push({ w: 12, d: 4, c: ROOF, p: [0, DECK_Y + BH * 4 + PLATE, 0] })
  hull.push({ w: 12, d: 2, c: ROOF_DARK, p: [0, DECK_Y + BH * 5 + PLATE, 0] })
  return { hull, front, windows, frontWindows }
}

/** Mutable handles the director animates (no React state, no re-renders). */
export type ArkRig = {
  group: THREE.Group | null
  ramp: THREE.Group | null
  front: THREE.Group | null
  interior: THREE.Group | null
  lantern: THREE.PointLight | null
}

const WIFE: Look = { robe: '#4a7ab8', legs: '#2f4f7a', hood: '#d9c7a5', beard: null }

/** Cosy inside of the deck house, seen when the front wall swings away. */
function Interior({ rig }: { rig: ArkRig }) {
  const noahPose = useRef(makePose())
  const wifePose = useRef(makePose())
  const lanternMesh = useRef<THREE.Group>(null)
  useFrame(() => {
    // the lantern sways with the waves
    if (lanternMesh.current) lanternMesh.current.rotation.z = Math.sin(sim.t * 1.3) * 0.25
    noahPose.current.raiseArms = 0
    wifePose.current.wave = sim.cut > 0.5 ? 0.6 : 0
  })
  return (
    <group ref={(g) => void (rig.interior = g)} visible={false}>
      <Brick w={8} d={2} h={1 / 3} color={COLORS.sand} position={[0, DECK_Y, 0]} studs={false} />
      {/* hay bales */}
      <Brick w={2} d={2} color={COLORS.yellow} position={[1.2, DECK_Y, -0.1]} />
      <Brick w={2} d={2} color="#e4c04a" position={[-1.25, DECK_Y, -0.1]} />
      <Minifig pose={noahPose} look={{ ...NOAH, axe: false }} position={[-0.35, DECK_Y + PLATE, 0]} rotation={[0, 0.25, 0]} />
      <Minifig pose={wifePose} look={WIFE} position={[0.4, DECK_Y + PLATE, -0.05]} rotation={[0, -0.3, 0]} />
      <group position={[1.2, DECK_Y + BH, 0.05]} rotation={[0, -1.2, 0]} scale={0.7}>
        <Sheep />
      </group>
      <group position={[-1.25, DECK_Y + BH, 0.05]} rotation={[0, 1.3, 0]} scale={0.6}>
        <Lion />
      </group>
      {/* lantern hanging from the roof */}
      <group position={[0, DECK_Y + BH * 4 - 0.02, 0]}>
        <group ref={lanternMesh}>
          <mesh geometry={brickGeometry(1, 1, 1 / 3, false)} material={plastic(COLORS.darkGrey)} position={[0, -0.18, 0]} />
          <mesh geometry={brickGeometry(1, 1, 1, false)} material={plastic('#ffcf5a', { emissive: 1.6 })} position={[0, -0.62, 0]} />
        </group>
      </group>
    </group>
  )
}

export function Ark({ rig, children }: { rig: ArkRig; children?: ReactNode }) {
  const { hull, front, windows, frontWindows } = useMemo(() => arkBricks(), [])
  const winMat = useMemo(() => {
    const m = plastic('#ffd76a').clone()
    m.emissive = new THREE.Color('#ffb640')
    m.emissiveIntensity = 1.4
    return m
  }, [])
  const winGeo = brickGeometry(2, 1)
  return (
    <group ref={(g) => void (rig.group = g)}>
      <StaticBricks bricks={hull} />
      <group ref={(g) => void (rig.front = g)}>
        <StaticBricks bricks={front} />
        {frontWindows.map((b, i) => (
          <mesh key={i} geometry={winGeo} material={winMat} position={b.p as V3} />
        ))}
      </group>
      {/* glowing windows: lantern light inside while the storm rages */}
      {windows.map((b, i) => (
        <mesh key={i} geometry={winGeo} material={winMat} position={b.p as V3} />
      ))}
      <Interior rig={rig} />
      {children}
      <pointLight ref={(l) => void (rig.lantern = l)} position={[0, DECK_Y + 1.1, 0.2]} color="#ffb24a" distance={6} decay={1.6} intensity={6} />
      {/* the ramp door: hinged at the bottom of the opening, rotation.x -PI/2 = shut */}
      <group ref={(g) => void (rig.ramp = g)} position={[HULL_DOOR_X, BH * 0.3, 1.43]}>
        <Brick w={4} d={4} h={1 / 3} color={COLORS.gopher} position={[0, 0, 0.8]} studs={false} />
        {[0.35, 0.85, 1.35].map((z) => (
          <Brick key={z} w={4} d={1} h={1 / 3} color={COLORS.brown} position={[0, PLATE, z]} studs={false} />
        ))}
      </group>
    </group>
  )
}
