import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { brickGeometry, plastic } from '../../three/bricks'
import { beamMaterial } from '../../three/shaders'
import { floodSkyMaterial, rainMaterial } from './materials'
import { sim } from './sim'
import { ARK_REST, PL } from './layout'

export function FloodSky({ material }: { material: ReturnType<typeof floodSkyMaterial> }) {
  const ref = useRef<THREE.Mesh>(null)
  // the dome rides with the camera so wide pull-backs never reach past the far plane
  useFrame(({ camera }) => ref.current?.position.copy(camera.position))
  return (
    <mesh ref={ref} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[180, 32, 16]} />
    </mesh>
  )
}

const RAIN_COUNT = 2400

/** Rain that follows the camera; density and visibility come from `sim.rain`. */
export function Rain() {
  const ref = useRef<THREE.Points>(null)
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(RAIN_COUNT * 3)
    const seed = new Float32Array(RAIN_COUNT)
    let r = 9
    const rnd = () => {
      r = (r * 16807) % 2147483647
      return r / 2147483647
    }
    for (let i = 0; i < RAIN_COUNT; i++) {
      pos[i * 3] = rnd()
      pos[i * 3 + 1] = rnd()
      pos[i * 3 + 2] = rnd()
      seed[i] = rnd()
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    return g
  }, [])
  const mat = useMemo(() => rainMaterial(), [])
  useFrame((state) => {
    mat.uniforms.uTime.value = sim.t
    mat.uniforms.uRain.value = sim.rain
    mat.uniforms.uFlash.value = sim.flash
    mat.uniforms.uPixelRatio.value = state.gl.getPixelRatio()
    if (ref.current) ref.current.visible = sim.rain > 0.01
  })
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} renderOrder={5} />
}

/** A jagged lightning bolt made of thin glowing bars (built once). */
function boltGeometry() {
  const parts: THREE.BufferGeometry[] = []
  let x = 0
  let y = 34
  const seg = (len: number, ang: number, w: number, x0: number, y0: number) => {
    const g = new THREE.BoxGeometry(w, len, w)
    g.translate(0, -len / 2, 0)
    g.rotateZ(ang)
    g.translate(x0, y0, 0)
    parts.push(g.toNonIndexed())
  }
  let seedState = 7
  const rnd = () => {
    seedState = (seedState * 16807) % 2147483647
    return seedState / 2147483647
  }
  while (y > 0) {
    const len = 2 + rnd() * 3
    const ang = (rnd() - 0.5) * 0.9
    seg(len, ang, 0.35, x, y)
    // occasional little fork
    if (rnd() > 0.7) seg(len * 0.8, ang + (rnd() > 0.5 ? 0.9 : -0.9), 0.18, x, y - len * 0.3)
    x += Math.sin(ang) * len
    y -= Math.cos(ang) * len
  }
  return mergeGeometries(parts, false)!
}

export function Lightning() {
  const ref = useRef<THREE.Mesh>(null)
  const geo = useMemo(() => boltGeometry(), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#eef4ff', toneMapped: false, fog: false, transparent: true }), [])
  const fwd = useMemo(() => new THREE.Vector3(), [])
  const last = useRef(-1)
  useFrame(({ camera }) => {
    const m = ref.current
    if (!m) return
    // a new strike: drop the bolt somewhere ahead of the camera
    if (sim.flash > 0.95 && last.current < 0) {
      camera.getWorldDirection(fwd)
      fwd.y = 0
      fwd.normalize()
      const side = (Math.random() - 0.5) * 50
      m.position.set(camera.position.x + fwd.x * 50 - fwd.z * side, -2, camera.position.z + fwd.z * 50 + fwd.x * side)
      m.rotation.y = Math.atan2(fwd.x, fwd.z) + (Math.random() > 0.5 ? Math.PI : 0)
      last.current = sim.t
    }
    const age = last.current < 0 ? 99 : sim.t - last.current
    m.visible = age < 0.32 && (age < 0.09 || age > 0.15)
    mat.opacity = Math.max(0, 1 - age * 2.5)
    if (age > 0.6) last.current = -1
  })
  return <mesh ref={ref} geometry={geo} material={mat} visible={false} frustumCulled={false} />
}

type Puff = { x: number; y: number; z: number; s: number; ry: number; c: number; cluster: number }

/** Instanced brick clouds over the whole sky. They darken in the storm and drift apart when God sends the wind. */
export function Clouds() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const puffs = useMemo(() => {
    const out: Puff[] = []
    let s = 11
    const rnd = () => {
      s = (s * 16807) % 2147483647
      return s / 2147483647
    }
    const clusters = 16
    for (let c = 0; c < clusters; c++) {
      const a = (c / clusters) * Math.PI * 2 + rnd() * 0.3
      const r = 10 + rnd() * 28
      const cx = Math.cos(a) * r - 8
      const cz = Math.sin(a) * r
      const cy = 14 + rnd() * 4
      const n = 6 + Math.floor(rnd() * 6)
      for (let i = 0; i < n; i++) {
        const k = i / n
        out.push({
          x: cx + (rnd() - 0.5) * 9,
          y: cy + Math.sin(k * Math.PI) * 1.4 + rnd() * 0.8,
          z: cz + (rnd() - 0.5) * 5,
          s: 1.6 + rnd() * 1.6,
          ry: Math.floor(rnd() * 4) * (Math.PI / 2),
          c: 0.85 + rnd() * 0.15,
          cluster: c,
        })
      }
    }
    return out
  }, [])
  const mat = useMemo(() => {
    const m = plastic('#ffffff', { rough: 0.6 }).clone()
    m.color = new THREE.Color('#ffffff')
    return m
  }, [])
  const obj = useMemo(() => new THREE.Object3D(), [])
  const tmpC = useMemo(() => new THREE.Color(), [])
  const stormCol = useMemo(() => new THREE.Color('#4d5566'), [])
  const dayCol = useMemo(() => new THREE.Color('#ffffff'), [])
  const lastPart = useRef(-1)

  useEffect(() => {
    const m = ref.current
    if (!m) return
    puffs.forEach((p, i) => m.setColorAt(i, tmpC.setScalar(p.c)))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [puffs, tmpC])

  useFrame((_, dt) => {
    const m = ref.current
    if (!m) return
    m.rotation.y += dt * 0.004
    mat.color.copy(stormCol).lerp(dayCol, 1 - sim.storm)
    mat.color.multiplyScalar(1 + sim.flash * 0.8)
    // only rewrite matrices while the clouds are moving apart
    if (Math.abs(sim.part - lastPart.current) < 0.001) return
    lastPart.current = sim.part
    const push = sim.part * 34
    for (let i = 0; i < puffs.length; i++) {
      const p = puffs[i]
      const dx = p.x - ARK_REST.x
      const dz = p.z - ARK_REST.z
      const d = Math.hypot(dx, dz) || 1
      obj.position.set(p.x + (dx / d) * push, p.y + sim.part * 3, p.z + (dz / d) * push)
      obj.rotation.set(0, p.ry, 0)
      obj.scale.setScalar(p.s * (1 - sim.part * 0.25))
      obj.updateMatrix()
      m.setMatrixAt(i, obj.matrix)
    }
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  })
  return <instancedMesh ref={ref} args={[brickGeometry(4, 4), mat, puffs.length]} frustumCulled={false} />
}

/** Sunbeams breaking through the clouds onto the ark ("God remembered Noah"). */
export function SunRays() {
  const group = useRef<THREE.Group>(null)
  const beams = useMemo(() => {
    const target = new THREE.Vector3(ARK_REST.x, PL + 1, ARK_REST.z)
    const out: { mat: THREE.ShaderMaterial; pos: THREE.Vector3; quat: THREE.Quaternion; r: number }[] = []
    const sources = [
      [-14, 34, -12, 3.2],
      [-8, 36, -16, 2.2],
      [-20, 32, -6, 2.6],
      [-4, 35, -6, 1.6],
    ]
    for (const [x, y, z, r] of sources) {
      const from = new THREE.Vector3(x, y, z).add(target)
      const dir = target.clone().sub(from)
      out.push({
        mat: beamMaterial('#fff1c9', 0),
        pos: from.clone().addScaledVector(dir, 0.5),
        quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize()),
        r,
      })
    }
    return out
  }, [])
  useFrame((_, dt) => {
    for (let i = 0; i < beams.length; i++) {
      const b = beams[i]
      b.mat.uniforms.uTime.value += dt
      b.mat.uniforms.uIntensity.value = sim.rays * (0.75 + 0.25 * Math.sin(sim.t * 0.7 + i * 1.7))
    }
    if (group.current) group.current.visible = sim.rays > 0.02
  })
  return (
    <group ref={group}>
      {beams.map((b, i) => (
        <mesh key={i} material={b.mat} position={b.pos} quaternion={b.quat}>
          <cylinderGeometry args={[b.r * 0.35, b.r, 40, 20, 1, true]} />
        </mesh>
      ))}
    </group>
  )
}
