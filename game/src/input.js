// Keyboard + mouse state. The world reads a plain snapshot each step; one-shot
// actions (confirm / pause / mute / restart) are consumed with takeActions().

import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyM: ACTION_MUTE,
  KeyR: ACTION_RESTART,
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  // Mouse in logical (1280x720) coordinates; null until the mouse first moves.
  let mouseX = null;
  let mouseY = null;
  let mouseDown = false;

  function toLogical(event) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    mouseX = ((event.clientX - rect.left) / rect.width) * FIELD.width;
    mouseY = ((event.clientY - rect.top) / rect.height) * FIELD.height;
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    const action = KEY_ACTIONS[event.code];
    if (action) actions |= action;
    // Space / arrows scroll the page in some browsers; the game owns them.
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onBlur() {
    keys.clear();
    mouseDown = false;
  }

  function onMouseMove(event) {
    toLogical(event);
  }

  function onMouseDown(event) {
    toLogical(event);
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  }

  function onMouseUp() {
    mouseDown = false;
  }

  // Touch drags fly the ship exactly like the mouse; a tap fires + confirms.
  function onTouchStart(event) {
    const touch = event.touches[0];
    if (touch) toLogical(touch);
    mouseDown = true;
    actions |= ACTION_CONFIRM;
    event.preventDefault();
  }

  function onTouchMove(event) {
    const touch = event.touches[0];
    if (touch) toLogical(touch);
    event.preventDefault();
  }

  function onTouchEnd() {
    mouseDown = false;
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', onContextMenu);

  function axis() {
    let x = 0;
    let y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    return { x, y };
  }

  return {
    /** -1/0/1 per axis from WASD / arrow keys. */
    axis,
    /** True while Space is held or the mouse button is held. */
    get firing() {
      return keys.has('Space') || mouseDown;
    },
    get mouseX() {
      return mouseX;
    },
    get mouseY() {
      return mouseY;
    },
    get hasMouse() {
      return mouseX !== null;
    },
    /** One-shot actions since the last call; consuming them clears the queue. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** For the screenshot autopilot: pretend the mouse is somewhere. */
    setMouse(x, y) {
      mouseX = x;
      mouseY = y;
    },
    setFiring(value) {
      mouseDown = !!value;
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
    },
  };
}
