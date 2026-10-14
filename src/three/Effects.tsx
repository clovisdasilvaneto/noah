import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { brickGeometry, plastic } from './bricks'
import { player } from '../game/world'
import { sfx } from '../game/audio'
import { useGame } from '../store'

/**
 * Pooled particle systems. Each pool is a single InstancedMesh, so a whole
 * shower of bricks or studs is one draw call. Spawning never allocates.
 */

const DEBRIS_MAX = 140
const STUD_MAX = 240

type Debris = { alive: boolean; p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; w: THREE.Vector3; life: number; s: number }
type Stud = { alive: boolean; p: THREE.Vector3; v: THREE.Vector3; age: number; value: number; spin: number }

const debris: Debris[] = Array.from({ length: DEBRIS_MAX }, () => ({
  alive: false,
  p: new THREE.Vector3(),
  v: new THREE.Vector3(),
  r: new THREE.Euler(),
  w: new THREE.Vector3(),
  life: 0,
  s: 1,
}))
const studs: Stud[] = Array.from({ length: STUD_MAX }, () => ({
  alive: false,
  p: new THREE.Vector3(),
  v: new THREE.Vector3(),
  age: 0,
  value: 10,
  spin: 0,
}))
let debrisCursor = 0
let studCursor = 0
const debrisColors: THREE.Color[] = Array.from({ length: DEBRIS_MAX }, () => new THREE.Color())
let debrisDirty = false
// live counts let the frame loop skip all work (and GPU uploads) when idle
let debrisLive = 0
let studLive = 0

const STUD_COLORS: Record<number, THREE.Color> = {
  10: new THREE.Color('#d9dde2'),
  100: new THREE.Color('#f2c230'),
  1000: new THREE.Color('#3a8ee6'),
}

export const fx = {
  burst(x: number, y: number, z: number, colors: string[], count = 14, force = 1) {
    for (let i = 0; i < count; i++) {
      const d = debris[debrisCursor]
      if (!d.alive) debrisLive++
      debrisColors[debrisCursor].set(colors[i % colors.length])
      debrisCursor = (debrisCursor + 1) % DEBRIS_MAX
      d.alive = true
      d.p.set(x + (Math.random() - 0.5) * 0.6, y + Math.random() * 0.6, z + (Math.random() - 0.5) * 0.6)
      const a = Math.random() * Math.PI * 2
      const sp = (2 + Math.random() * 3) * force
      d.v.set(Math.cos(a) * sp, 4 + Math.random() * 4 * force, Math.sin(a) * sp)
      d.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)
      d.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14)
      d.life = 1.1 + Math.random() * 0.5
      d.s = 0.7 + Math.random() * 0.6
    }
    debrisDirty = true
  },
  /** Little dust puff (landing). Low force, tan/white bits. */
  puff(x: number, y: number, z: number) {
    const before = debrisCursor
    this.burst(x, y, z, ['#e8dcc0', '#d8c7a0', '#ffffff'], 6, 0.35)
    // keep the puff low and short-lived
    for (let i = 0; i < 6; i++) {
      const d = debris[(before + i) % DEBRIS_MAX]
      d.v.y = 1.5 + Math.random() * 1.5
      d.life = 0.35 + Math.random() * 0.2
      d.s = 0.35
    }
  },
  /** Spray studs worth roughly `total`, LEGO style (silver 10, gold 100, blue 1000). */
  studs(x: number, y: number, z: number, total: number) {
    let rest = total
    const values: number[] = []
    while (rest >= 1000 && values.length < 3) {
      values.push(1000)
      rest -= 1000
    }
    while (rest >= 100 && values.length < 8) {
      values.push(100)
      rest -= 100
    }
    while (rest > 0 && values.length < 16) {
      values.push(10)
      rest -= 10
    }
    for (const value of values) {
      const s = studs[studCursor]
      studCursor = (studCursor + 1) % STUD_MAX
      if (!s.alive) studLive++
      s.alive = true
      s.value = value
      s.age = 0
      s.spin = Math.random() * 6
      s.p.set(x, y + 0.5, z)
      const a = Math.random() * Math.PI * 2
      const sp = 1.5 + Math.random() * 2.5
      s.v.set(Math.cos(a) * sp, 5 + Math.random() * 3, Math.sin(a) * sp)
    }
  },
  reset() {
    debris.forEach((d) => (d.alive = false))
    studs.forEach((s) => (s.alive = false))
    debrisLive = studLive = 0
  },
}

const tmpM = new THREE.Matrix4()
const tmpQ = new THREE.Quaternion()
const tmpS = new THREE.Vector3()
const tmpP = new THREE.Vector3()
const hidden = new THREE.Matrix4().makeScale(0, 0, 0)

export function Effects() {
  const debrisRef = useRef<THREE.InstancedMesh>(null)
  const studRef = useRef<THREE.InstancedMesh>(null)
  const addStuds = useGame((s) => s.addStuds)

  const studGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.16, 0.16, 0.08, 14)
    g.rotateX(Math.PI / 2)
    return g
  }, [])
  const studMat = useMemo(() => {
    const m = plastic('#ffffff', { rough: 0.12 }).clone()
    m.metalness = 0.6
    m.emissive = new THREE.Color('#222')
    return m
  }, [])

  useEffect(() => {
    fx.reset()
    const dm = debrisRef.current!
    const sm = studRef.current!
    for (let i = 0; i < DEBRIS_MAX; i++) {
      dm.setMatrixAt(i, hidden)
      dm.setColorAt(i, debrisColors[i])
    }
    for (let i = 0; i < STUD_MAX; i++) {
      sm.setMatrixAt(i, hidden)
      sm.setColorAt(i, STUD_COLORS[10])
    }
    return () => fx.reset()
  }, [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const dm = debrisRef.current
    const sm = studRef.current
    if (!dm || !sm) return

    const debrisWasLive = debrisLive > 0
    for (let i = 0; i < DEBRIS_MAX && debrisWasLive; i++) {
      const d = debris[i]
      if (!d.alive) {
        dm.setMatrixAt(i, hidden)
        continue
      }
      d.life -= dt
      if (d.life <= 0) {
        d.alive = false
        debrisLive--
        dm.setMatrixAt(i, hidden)
        continue
      }
      d.v.y -= 22 * dt
      d.p.addScaledVector(d.v, dt)
      if (d.p.y < 0.05) {
        d.p.y = 0.05
        d.v.y *= -0.35
        d.v.x *= 0.7
        d.v.z *= 0.7
      }
      d.r.x += d.w.x * dt
      d.r.y += d.w.y * dt
      d.r.z += d.w.z * dt
      const shrink = Math.min(1, d.life / 0.3) * d.s
      tmpQ.setFromEuler(d.r)
      tmpS.setScalar(shrink)
      tmpM.compose(d.p, tmpQ, tmpS)
      dm.setMatrixAt(i, tmpM)
    }
    if (debrisDirty) {
      for (let i = 0; i < DEBRIS_MAX; i++) dm.setColorAt(i, debrisColors[i])
      if (dm.instanceColor) dm.instanceColor.needsUpdate = true
      debrisDirty = false
    }
    if (debrisWasLive) dm.instanceMatrix.needsUpdate = true

    const vacuum = useGame.getState().arkComplete
    let colorsChanged = false
    let collected = 0
    const studsWereLive = studLive > 0
    for (let i = 0; i < STUD_MAX && studsWereLive; i++) {
      const s = studs[i]
      if (!s.alive) {
        sm.setMatrixAt(i, hidden)
        continue
      }
      s.age += dt
      s.spin += dt * 5
      tmpP.set(player.pos.x - s.p.x, player.pos.y + 0.7 - s.p.y, player.pos.z - s.p.z)
      const dist = tmpP.length()
      // once the level is won, every stud left on the ground flies to Noah
      if (s.age > 0.45 && (dist < 3.2 || vacuum)) {
        // magnet towards Noah
        s.v.lerp(tmpP.normalize().multiplyScalar(14), 1 - Math.exp(-dt * 10))
        if (dist < 0.6) {
          s.alive = false
          studLive--
          collected += s.value
          sfx.stud(s.value)
          sm.setMatrixAt(i, hidden)
          continue
        }
      } else {
        s.v.y -= 20 * dt
      }
      s.p.addScaledVector(s.v, dt)
      if (s.p.y < 0.2) {
        s.p.y = 0.2
        s.v.y = Math.abs(s.v.y) * 0.45
        s.v.x *= 0.8
        s.v.z *= 0.8
      }
      // uncollected studs fade away after a while, like the games
      if (s.age > 20) {
        s.alive = false
        studLive--
        sm.setMatrixAt(i, hidden)
        continue
      }
      if (s.age < dt * 1.5) {
        sm.setColorAt(i, STUD_COLORS[s.value])
        colorsChanged = true
      }
      tmpQ.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, s.spin)
      tmpS.setScalar(s.value >= 1000 ? 1.5 : s.value >= 100 ? 1.2 : 1)
      tmpM.compose(s.p, tmpQ, tmpS)
      sm.setMatrixAt(i, tmpM)
    }
    if (studsWereLive) sm.instanceMatrix.needsUpdate = true
    if (colorsChanged && sm.instanceColor) sm.instanceColor.needsUpdate = true
    if (collected) addStuds(collected)
  })

  return (
    <>
      <instancedMesh
        ref={debrisRef}
        args={[brickGeometry(1, 2, 1 / 3), plastic('#ffffff'), DEBRIS_MAX]}
        frustumCulled={false}
      />
      <instancedMesh ref={studRef} args={[studGeo, studMat, STUD_MAX]} frustumCulled={false} />
    </>
  )
}
