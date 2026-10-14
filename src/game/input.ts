// Shared, non-reactive input state. Read every frame by the player controller;
// written by keyboard listeners and the on-screen touch controls.
export const input = {
  stickX: 0,
  stickY: 0,
  keyX: 0,
  keyY: 0,
  jumpPressed: false,
  /** held: releasing early cuts the jump short (variable jump height) */
  jumpDown: false,
  actionDown: false,
  actionPressed: false,
}

const keys = new Set<string>()

function refreshKeys() {
  const l = keys.has('KeyA') || keys.has('ArrowLeft')
  const r = keys.has('KeyD') || keys.has('ArrowRight')
  const u = keys.has('KeyW') || keys.has('ArrowUp')
  const d = keys.has('KeyS') || keys.has('ArrowDown')
  input.keyX = (r ? 1 : 0) - (l ? 1 : 0)
  input.keyY = (d ? 1 : 0) - (u ? 1 : 0)
}

const ACTION_KEYS = new Set(['KeyE', 'KeyJ', 'Enter'])

export function initKeyboard() {
  const down = (e: KeyboardEvent) => {
    if (e.repeat) return
    keys.add(e.code)
    if (e.code === 'Space') {
      input.jumpPressed = true
      input.jumpDown = true
      e.preventDefault()
    }
    if (ACTION_KEYS.has(e.code)) {
      input.actionDown = true
      input.actionPressed = true
    }
    refreshKeys()
  }
  const up = (e: KeyboardEvent) => {
    keys.delete(e.code)
    if (e.code === 'Space') input.jumpDown = false
    if (ACTION_KEYS.has(e.code)) input.actionDown = false
    refreshKeys()
  }
  const blur = () => {
    keys.clear()
    input.actionDown = false
    input.jumpDown = false
    refreshKeys()
  }
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', blur)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', blur)
  }
}

export function moveVector(): [number, number] {
  let x = input.stickX + input.keyX
  let y = input.stickY + input.keyY
  const len = Math.hypot(x, y)
  if (len > 1) {
    x /= len
    y /= len
  }
  return [x, y]
}

export function consumePresses() {
  input.jumpPressed = false
  input.actionPressed = false
}

export function resetInput() {
  input.stickX = input.stickY = 0
  input.jumpPressed = input.jumpDown = input.actionDown = input.actionPressed = false
}

export const isTouchDevice =
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
