import { Brick } from '../../three/common'
import { BH, COLORS } from '../../three/bricks'

// Little brick-built animals. Origin at the feet, facing +z.

export function Sheep() {
  return (
    <group>
      {[-0.2, 0.2].flatMap((x) => [-0.3, 0.3].map((z) => <Brick key={`${x}${z}`} w={1} d={1} color={COLORS.black} position={[x, 0, z]} studs={false} />))}
      <Brick w={2} d={3} color={COLORS.white} position={[0, BH, 0]} />
      <Brick w={2} d={2} h={1 / 3} color="#ffffff" position={[0, BH * 2, -0.1]} />
      <Brick w={1} d={1} color={COLORS.black} position={[0, BH * 1.6, 0.7]} />
      <Brick w={1} d={1} h={1 / 3} color={COLORS.white} position={[0, BH * 2.6, 0.7]} />
    </group>
  )
}

export function Lion() {
  return (
    <group>
      {[-0.2, 0.2].flatMap((x) => [-0.4, 0.4].map((z) => <Brick key={`${x}${z}`} w={1} d={1} color={COLORS.orange} position={[x, 0, z]} studs={false} />))}
      <Brick w={2} d={4} color={COLORS.orange} position={[0, BH, 0]} />
      {/* mane and face */}
      <Brick w={3} d={1} h={2} color={COLORS.reddishBrown} position={[0, BH * 1.2, 0.95]} />
      <Brick w={2} d={1} color={COLORS.yellow} position={[0, BH * 1.6, 1.25]} />
      <Brick w={1} d={1} h={1 / 3} color={COLORS.black} position={[0, BH * 2.2, 1.45]} studs={false} />
      {/* tail */}
      <Brick w={1} d={1} h={1 / 3} color={COLORS.reddishBrown} position={[0, BH * 2, -0.95]} />
    </group>
  )
}

export function Elephant() {
  return (
    <group>
      {[-0.4, 0.4].flatMap((x) => [-0.4, 0.4].map((z) => <Brick key={`${x}${z}`} w={1} d={1} h={2} color={COLORS.darkGrey} position={[x, 0, z]} studs={false} />))}
      <Brick w={3} d={4} h={2} color={COLORS.grey} position={[0, BH * 2, 0]} />
      <Brick w={2} d={2} h={2} color={COLORS.grey} position={[0, BH * 2.6, 0.95]} />
      {/* ears */}
      <Brick w={1} d={2} h={2} color={COLORS.darkGrey} position={[-0.6, BH * 2.6, 0.8]} studs={false} />
      <Brick w={1} d={2} h={2} color={COLORS.darkGrey} position={[0.6, BH * 2.6, 0.8]} studs={false} />
      {/* trunk */}
      <Brick w={1} d={1} h={2} color={COLORS.grey} position={[0, BH * 1.2, 1.3]} studs={false} />
      <Brick w={1} d={1} color={COLORS.white} position={[-0.3, BH * 2.4, 1.3]} studs={false} />
      <Brick w={1} d={1} color={COLORS.white} position={[0.3, BH * 2.4, 1.3]} studs={false} />
      <Brick w={1} d={1} h={1 / 3} color={COLORS.black} position={[-0.25, BH * 3.7, 1.35]} studs={false} />
      <Brick w={1} d={1} h={1 / 3} color={COLORS.black} position={[0.25, BH * 3.7, 1.35]} studs={false} />
    </group>
  )
}

export function Giraffe() {
  return (
    <group>
      {[-0.2, 0.2].flatMap((x) => [-0.4, 0.4].map((z) => <Brick key={`${x}${z}`} w={1} d={1} h={3} color={COLORS.yellow} position={[x, 0, z]} studs={false} />))}
      <Brick w={2} d={4} color={COLORS.yellow} position={[0, BH * 3, 0]} />
      <Brick w={1} d={1} h={1 / 3} color={COLORS.brown} position={[0.2, BH * 4, -0.4]} studs={false} />
      <Brick w={1} d={1} h={1 / 3} color={COLORS.brown} position={[-0.2, BH * 4, 0.2]} studs={false} />
      {/* neck */}
      {[0, 1, 2, 3].map((k) => (
        <Brick key={k} w={1} d={1} color={k % 2 ? COLORS.yellow : COLORS.orange} position={[0, BH * (4 + k), 0.6]} studs={false} />
      ))}
      <Brick w={1} d={2} color={COLORS.yellow} position={[0, BH * 8, 0.8]} studs={false} />
      <Brick w={1} d={1} h={1 / 3} color={COLORS.brown} position={[0, BH * 9, 0.6]} />
      <Brick w={1} d={1} h={1 / 3} color={COLORS.black} position={[0, BH * 8.5, 1.21]} studs={false} />
    </group>
  )
}
