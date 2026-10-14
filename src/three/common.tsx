import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { blobMaterial, brickGeometry, planeGeo, plastic, plasticFade } from './bricks'
import { baseplateMaterial, beamMaterial, motesMaterial, skyMaterial } from './shaders'

type V3 = [number, number, number]

export function Brick({
  w = 2,
  d = 2,
  h = 1,
  color,
  position,
  rotation,
  studs = true,
  emissive,
  fade = false,
}: {
  w?: number
  d?: number
  h?: number
  color: string
  position?: V3
  rotation?: V3
  studs?: boolean
  emissive?: number
  /** dither away when blocking the view of Noah */
  fade?: boolean
}) {
  return (
    <mesh
      geometry={brickGeometry(w, d, h, studs)}
      material={fade ? plasticFade(color) : plastic(color, { emissive })}
      position={position}
      rotation={rotation}
    />
  )
}

/**
 * Many identical bricks in one draw call, coloured per instance. Use for
 * static scenery (hills, forests, walls).
 */
export function InstancedBricks({
  items,
  w,
  d,
  h = 1,
  studs = true,
  fade = false,
}: {
  items: { p: V3; c: string; ry?: number; s?: number }[]
  w: number
  d: number
  h?: number
  studs?: boolean
  fade?: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    items.forEach((it, i) => {
      o.position.set(...it.p)
      o.rotation.set(0, it.ry ?? 0, 0)
      o.scale.setScalar(it.s ?? 1)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, c.set(it.c))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [items])
  return (
    <instancedMesh
      ref={ref}
      args={[brickGeometry(w, d, h, studs), fade ? plasticFade('#ffffff') : plastic('#ffffff'), items.length]}
      key={items.length}
    />
  )
}

export type StaticBrick = { w: number; d: number; h?: number; studs?: boolean; c: string; p: V3; ry?: number }

/**
 * Bakes a list of bricks (in world space) into one InstancedMesh per brick
 * shape. Use for static buildings so a house costs a few draw calls, not a dozen.
 */
export function StaticBricks({ bricks, fade = false }: { bricks: StaticBrick[]; fade?: boolean }) {
  const groups = useMemo(() => {
    const map = new Map<string, { w: number; d: number; h: number; studs: boolean; items: { p: V3; c: string; ry?: number }[] }>()
    for (const b of bricks) {
      const h = b.h ?? 1
      const studs = b.studs ?? true
      const key = `${b.w}|${b.d}|${h}|${studs}`
      if (!map.has(key)) map.set(key, { w: b.w, d: b.d, h, studs, items: [] })
      map.get(key)!.items.push({ p: b.p, c: b.c, ry: b.ry })
    }
    return [...map.entries()]
  }, [bricks])
  return (
    <>
      {groups.map(([key, g]) => (
        <InstancedBricks key={key} items={g.items} w={g.w} d={g.d} h={g.h} studs={g.studs} fade={fade} />
      ))}
    </>
  )
}

/** Transform brick positions from a local frame (position + y rotation) into world space. */
export function placeBricks(bricks: StaticBrick[], at: V3, ry = 0): StaticBrick[] {
  const cos = Math.cos(ry)
  const sin = Math.sin(ry)
  return bricks.map((b) => ({
    ...b,
    p: [at[0] + b.p[0] * cos + b.p[2] * sin, at[1] + b.p[1], at[2] - b.p[0] * sin + b.p[2] * cos] as V3,
    ry: (b.ry ?? 0) + ry,
  }))
}

/**
 * Glossy plastic needs something to reflect. A procedural room environment
 * prefiltered once at startup is cheap and needs no HDR download.
 */
export function PlasticEnvironment({ intensity = 0.7 }: { intensity?: number }) {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = intensity
    pmrem.dispose()
    return () => {
      scene.environment = null
      env.dispose()
    }
  }, [gl, scene, intensity])
  return null
}

export function Sky({ top, horizon, sun, sunDir }: { top: string; horizon: string; sun: string; sunDir: V3 }) {
  const mat = useMemo(() => skyMaterial(top, horizon, sun, new THREE.Vector3(...sunDir)), [top, horizon, sun, sunDir])
  return (
    <mesh material={mat} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[180, 24, 12]} />
    </mesh>
  )
}

export function Baseplate({
  size,
  color,
  fog,
  fogNear,
  fogFar,
  position = [0, 0, 0],
}: {
  size: [number, number]
  color: string
  fog: string
  fogNear: number
  fogFar: number
  position?: V3
}) {
  const mat = useMemo(() => baseplateMaterial(color, fog, fogNear, fogFar), [color, fog, fogNear, fogFar])
  return <mesh geometry={planeGeo} material={mat} scale={[size[0], 1, size[1]]} position={position} />
}

export function BlobShadow({ size = 1, position = [0, 0.02, 0] as V3 }: { size?: number; position?: V3 }) {
  return <mesh geometry={planeGeo} material={blobMaterial()} position={position} scale={[size, 1, size]} renderOrder={1} />
}

export function Beam({
  color = '#fff2c4',
  radius = 1.2,
  height = 30,
  intensity = 1,
  position,
}: {
  color?: string
  radius?: number
  height?: number
  intensity?: number
  position?: V3
}) {
  const mat = useMemo(() => beamMaterial(color, intensity), [color, intensity])
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt
  })
  return (
    <mesh material={mat} position={position}>
      <cylinderGeometry args={[radius * 0.55, radius, height, 24, 1, true]} />
    </mesh>
  )
}

/** Shader-animated floating particles inside a box volume. */
export function Motes({
  count,
  area,
  height,
  color,
  size = 6,
  rise = 0.4,
  position,
}: {
  count: number
  area: [number, number]
  height: number
  color: string
  size?: number
  rise?: number
  position?: V3
}) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * area[0]
      pos[i * 3 + 1] = Math.random() * height
      pos[i * 3 + 2] = (Math.random() - 0.5) * area[1]
      seed[i] = Math.random()
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, height / 2, 0), Math.max(area[0], area[1], height))
    return g
  }, [count, area, height])
  const mat = useMemo(() => motesMaterial(color, size, rise, height), [color, size, rise, height])
  useFrame((state, dt) => {
    mat.uniforms.uTime.value += dt
    // size points by the canvas DPR (capped on phones), not the device's
    mat.uniforms.uPixelRatio.value = state.gl.getPixelRatio()
  })
  return <points geometry={geo} material={mat} position={position} />
}

/** Fixed stars for the night cutscene. */
export function Stars({ count = 400 }: { count?: number }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const th = Math.random() * Math.PI * 2
      const ph = Math.random() * Math.PI * 0.42
      const r = 150
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th)
      pos[i * 3 + 1] = r * Math.cos(ph)
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th)
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [count])
  const ref = useRef<THREE.Points>(null)
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.004
  })
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial color="#fff6dd" size={1.4} sizeAttenuation={false} transparent opacity={0.85} depthWrite={false} />
    </points>
  )
}
