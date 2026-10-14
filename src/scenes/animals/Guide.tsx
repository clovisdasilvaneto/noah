// Guidance, LEGO style (copied from the gather level's ObjectiveGuide): a
// golden beam over the next animal, a bobbing arrow at Noah's feet, and an
// arrow pinned to the screen edge when the goal is off-screen. While animals
// follow Noah it points to the ark's ramp.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Beam } from '../../three/common'
import { player } from '../../game/world'
import { SPECIES_ORDER } from '../../i18n/animals'
import { agents, lvl } from './Animals'
import { useAnimals } from './state'
import { APPROACH, BELL, BRIDGE_PILE, GRASS, LOG, guide } from './layout'

const GRASS_CENTER = { x: GRASS.reduce((s, g) => s + g[0], 0) / GRASS.length, z: GRASS.reduce((s, g) => s + g[1], 0) / GRASS.length }

function arrowShape(scale: number) {
  const s = new THREE.Shape()
  s.moveTo(0, 0.55 * scale)
  s.lineTo(0.36 * scale, 0.08 * scale)
  s.lineTo(0.14 * scale, 0.08 * scale)
  s.lineTo(0.14 * scale, -0.3 * scale)
  s.lineTo(-0.14 * scale, -0.3 * scale)
  s.lineTo(-0.14 * scale, 0.08 * scale)
  s.lineTo(-0.36 * scale, 0.08 * scale)
  s.closePath()
  return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2)
}

const pick = { x: 0, z: 0, d: Infinity }
function consider(x: number, z: number) {
  const d = Math.hypot(x - player.pos.x, z - player.pos.z)
  if (d < pick.d) {
    pick.d = d
    pick.x = x
    pick.z = z
  }
}

/** Writes the next goal into `guide`. No allocations. */
function updateGuide() {
  const st = useAnimals.getState()
  guide.active = false
  if (st.phase !== 'play') return
  pick.d = Infinity
  // an escort that has stalled needs Noah back
  for (const a of agents) {
    if (a.species === 'turtles' && a.state === 'follow' && a.stalled) {
      consider(a.x, a.z)
      break
    }
  }
  if (pick.d === Infinity && agents.some((a) => a.state === 'follow')) consider(APPROACH[0], APPROACH[1])
  if (pick.d === Infinity) {
    for (const s of SPECIES_ORDER) {
      if (st.status[s] !== 'hidden') continue
      switch (s) {
        case 'lions':
          consider(GRASS_CENTER.x, GRASS_CENTER.z)
          break
        case 'elephants':
        case 'giraffes':
        case 'turtles': {
          if (s === 'elephants' && !lvl.logGone) {
            consider(LOG.x, LOG.z)
            break
          }
          const a = agents.find((g) => g.species === s)
          if (a) consider(a.x, a.z)
          break
        }
        case 'zebras':
          consider(BRIDGE_PILE[0], BRIDGE_PILE[1])
          break
        case 'doves':
          consider(BELL.x, BELL.z)
          break
        case 'sheep':
        case 'rabbits':
          for (const a of agents) if (a.species === s && a.state === 'home') consider(a.x, a.z)
          break
      }
    }
  }
  if (pick.d < Infinity) {
    guide.active = true
    guide.x = pick.x
    guide.z = pick.z
  }
}

const EDGE_MARGIN = 56

export function AnimalsGuide() {
  const beam = useRef<THREE.Group>(null)
  const arrow = useRef<THREE.Group>(null)
  const { camera, size } = useThree()
  const proj = useMemo(() => new THREE.Vector3(), [])
  const edgeEl = useRef<HTMLElement | null>(null)
  const geos = useMemo(() => ({ fill: arrowShape(2), outline: arrowShape(2.35) }), [])

  useFrame((state) => {
    updateGuide()
    const active = guide.active
    const tx = guide.x
    const tz = guide.z
    const t = state.clock.elapsedTime
    if (beam.current) {
      beam.current.visible = active
      beam.current.position.set(tx, 0, tz)
    }
    const d = Math.hypot(tx - player.pos.x, tz - player.pos.z)
    if (arrow.current) {
      arrow.current.visible = active && d > 3.2
      arrow.current.position.set(player.pos.x, player.pos.y + 0.3, player.pos.z)
      arrow.current.rotation.y = Math.atan2(-(tx - player.pos.x), -(tz - player.pos.z))
      const c = arrow.current.children[0]
      if (c) c.position.z = -1.5 - Math.abs(Math.sin(t * 4)) * 0.35
    }
    edgeEl.current ??= document.getElementById('animals-edge-arrow')
    const el = edgeEl.current
    if (el) {
      proj.set(tx, 1.5, tz).project(camera)
      const behind = proj.z > 1
      let x = (proj.x * 0.5 + 0.5) * size.width
      let y = (-proj.y * 0.5 + 0.5) * size.height
      if (behind) {
        x = size.width - x
        y = size.height - y
      }
      const off = behind || x < 0 || x > size.width || y < 0 || y > size.height
      if (!active || !off) {
        el.style.opacity = '0'
      } else {
        const cx = size.width / 2
        const cy = size.height / 2
        const ang = Math.atan2(y - cy, x - cx)
        const sx = (cx - EDGE_MARGIN) / Math.max(1e-3, Math.abs(Math.cos(ang)))
        const sy = (cy - EDGE_MARGIN) / Math.max(1e-3, Math.abs(Math.sin(ang)))
        const r = Math.min(sx, sy)
        el.style.opacity = '1'
        el.style.transform = `translate(${cx + Math.cos(ang) * r}px, ${cy + Math.sin(ang) * r}px) rotate(${ang}rad)`
      }
    }
  })
  useEffect(
    () => () => {
      if (edgeEl.current) edgeEl.current.style.opacity = '0'
    },
    [],
  )
  return (
    <>
      <group ref={beam}>
        <Beam radius={0.9} height={14} position={[0, 7, 0]} color="#ffd970" intensity={0.9} />
      </group>
      <group ref={arrow}>
        <group>
          <mesh geometry={geos.outline} position={[0, 0, 0.12]} renderOrder={2}>
            <meshBasicMaterial color="#5a3c00" transparent opacity={0.55} depthWrite={false} />
          </mesh>
          <mesh geometry={geos.fill} position={[0, 0.01, 0]} renderOrder={3}>
            <meshBasicMaterial color="#ffd23f" depthWrite={false} transparent />
          </mesh>
        </group>
      </group>
    </>
  )
}
