// input.js — keyboard + mouse state for the whole game. One Input instance is owned
// by the Game; systems read it (held keys, aim position, clicks) and the Game clears
// the edge-triggered queues once per frame.

export const KEY_UP = 'KeyW';
export const KEY_DOWN = 'KeyS';
export const KEY_LEFT = 'KeyA';
export const KEY_RIGHT = 'KeyD';
export const KEY_DASH = 'ShiftLeft';
export const KEY_DASH_ALT = 'Space';
export const KEY_PAUSE = 'Escape';
export const KEY_PAUSE_ALT = 'KeyP';
export const KEY_RESTART = 'KeyR';
export const KEY_MUTE = 'KeyM';
export const KEY_WEAPON_1 = 'Digit1';
export const KEY_WEAPON_2 = 'Digit2';
export const KEY_WEAPON_3 = 'Digit3';

/** Tracks held keys, the mouse position in canvas pixels, and click/press edges. */
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.mouseX = 640;
    this.mouseY = 360;
    this.mouseDown = false;
    this.clicked = false;
    this.clickX = 0;
    this.clickY = 0;
    this._onKeyDown = (event) => {
      if (event.code === KEY_DASH_ALT) event.preventDefault();
      if (!event.repeat) this.pressedKeys.add(event.code);
      this.keys.add(event.code);
    };
    this._onKeyUp = (event) => {
      this.keys.delete(event.code);
    };
    this._onMouseMove = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = ((event.clientX - rect.left) / rect.width) * this.canvas.width;
      this.mouseY = ((event.clientY - rect.top) / rect.height) * this.canvas.height;
    };
    this._onMouseDown = (event) => {
      this._onMouseMove(event);
      if (event.button === 0) {
        this.mouseDown = true;
        this.clicked = true;
        this.clickX = this.mouseX;
        this.clickY = this.mouseY;
      }
    };
    this._onMouseUp = (event) => {
      if (event.button === 0) this.mouseDown = false;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouseDown = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  /** True while the key is held down. */
  isDown(code) {
    return this.keys.has(code);
  }

  /** True only on the frame the key was first pressed. */
  wasPressed(code) {
    return this.pressedKeys.has(code);
  }

  /** Movement vector from WASD / arrow keys, normalised. */
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.isDown(KEY_LEFT) || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown(KEY_RIGHT) || this.isDown('ArrowRight')) x += 1;
    if (this.isDown(KEY_UP) || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown(KEY_DOWN) || this.isDown('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.sqrt(2);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  /** Set the aim from a scripted source (autopilot / screenshot staging). */
  setAim(x, y) {
    this.mouseX = x;
    this.mouseY = y;
  }

  /** Pretend the mouse button is held (scripted fire). */
  setFiring(firing) {
    this.mouseDown = firing;
  }

  /** Pretend a movement key set is held (scripted movement). */
  setMove(x, y) {
    this._scriptMove = { x, y };
  }

  /** Movement vector, preferring a scripted one when the autopilot set it. */
  effectiveMoveVector() {
    if (this._scriptMove) return this._scriptMove;
    return this.moveVector();
  }

  /** Clear edge-triggered state at the end of each frame. */
  endFrame() {
    this.pressedKeys.clear();
    this.clicked = false;
    this._scriptMove = null;
  }

  /** Drop all listeners (used only by tests that rebuild the game). */
  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
  }
}
