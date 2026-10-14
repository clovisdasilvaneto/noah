import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { brickOceanMaterial, farSeaMaterial, type OceanUniforms } from './materials'
import { sim } from './sim'

const GRID = 64
const CELL = 0.8

/** Brick ocean (instanced columns, waves in the vertex shader) plus a flat sea out to the horizon. */
export function Ocean({ uniforms }: { uniforms: OceanUniforms }) {
  const cols = useRef<THREE.Mesh>(null)
  const far = useRef<THREE.Mesh>(null)
  const geo = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1)
    const g = new THREE.InstancedBufferGeometry()
    g.index = box.index
    g.setAttribute('position', box.getAttribute('position'))
    g.setAttribute('normal', box.getAttribute('normal'))
    const cells = new Float32Array(GRID * GRID * 2)
    let i = 0
    for (let x = 0; x < GRID; x++) {
      for (let z = 0; z < GRID; z++) {
        cells[i++] = x - (GRID - 1) / 2
        cells[i++] = z - (GRID - 1) / 2
      }
    }
    g.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2))
    g.instanceCount = GRID * GRID
    return g
  }, [])
  const colMat = useMemo(() => brickOceanMaterial(uniforms), [uniforms])
  const farMat = useMemo(() => farSeaMaterial(uniforms), [uniforms])
  const farGeo = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), [])
  const fwd = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ camera }) => {
    const u = uniforms
    u.uTime.value = sim.t
    u.uLevel.value = sim.level
    u.uAmp.value = sim.amp
    u.uCell.value = CELL
    u.uRadius.value = (GRID * CELL) / 2
    // centre the brick grid a little ahead of the camera, snapped to whole cells
    camera.getWorldDirection(fwd)
    fwd.y = 0
    fwd.normalize()
    const cx = camera.position.x + fwd.x * 14
    const cz = camera.position.z + fwd.z * 14
    u.uCenter.value.set(Math.round(cx / CELL) * CELL, Math.round(cz / CELL) * CELL)
    const visible = sim.level > -0.3
    if (cols.current) cols.current.visible = visible
    if (far.current) {
      far.current.visible = visible
      far.current.position.set(camera.position.x, 0, camera.position.z)
    }
  })

  return (
    <>
      <mesh ref={cols} geometry={geo} material={colMat} frustumCulled={false} />
      <mesh ref={far} geometry={farGeo} material={farMat} scale={[700, 1, 700]} frustumCulled={false} />
    </>
  )
}

