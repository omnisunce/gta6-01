// Keyboard and mouse input. Held keys give movement and steering; one-shot
// presses (enter a car, pause, shoot) are queued and taken once by the loop,
// so a press between two frames is never lost and never counted twice.

export const ACTION_ENTER = 1;
export const ACTION_PAUSE = 2;
export const ACTION_SHOOT = 4;
export const ACTION_CONFIRM = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const ENTER = new Set(['KeyE']);
const PAUSE = new Set(['KeyP', 'Escape']);
const CONFIRM = new Set(['Enter', 'Space']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mutePressed = false;

  function keyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    keys.add(event.code);
    if (event.repeat) return;
    if (ENTER.has(event.code)) actions |= ACTION_ENTER;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (MUTE.has(event.code)) mutePressed = true;
  }

  function keyUp(event) {
    keys.delete(event.code);
  }

  function pointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  }

  function pointerDown(event) {
    pointerMove(event);
    mouseDown = true;
    actions |= ACTION_SHOOT;
  }

  function pointerUp() {
    mouseDown = false;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerdown', pointerDown);
  window.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  const has = (set) => {
    for (const code of set) if (keys.has(code)) return true;
    return false;
  };

  return {
    /** Steering: -1 left, 1 right, 0 neither or both. */
    steer() {
      return (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
    },
    /** Throttle: 1 forward, -1 reverse, 0 none. */
    throttle() {
      return (has(UP) ? 1 : 0) - (has(DOWN) ? 1 : 0);
    },
    sprint() {
      return has(SPRINT);
    },
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeMute() {
      const taken = mutePressed;
      mutePressed = false;
      return taken;
    },
  };
}
