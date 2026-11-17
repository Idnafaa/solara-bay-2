// Keyboard + mouse input. WASD/arrows, Shift, Space, E, P, M, Esc and the
// pointer lock for mouse look. Arrow keys also steer the camera when the
// pointer is not locked (headless / trackpad fallback).
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.yawDelta = 0;
    this.pitchDelta = 0;
    this.locked = false;
    this.clicked = false;
    this.pressed = new Set(); // edge-triggered keys, consumed by the game
    this.onPause = null;
    this.onAnyKey = null;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (e.code === 'Escape' && this.onPause) this.onPause();
      if (this.onAnyKey) this.onAnyKey(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    canvas.addEventListener('click', () => {
      this.clicked = true;
      if (!this.locked && document.pointerLockElement !== canvas) {
        try { canvas.requestPointerLock(); } catch { /* headless may refuse */ }
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yawDelta -= e.movementX * 0.0026;
      this.pitchDelta -= e.movementY * 0.0022;
    });
  }

  down(code) { return this.keys.has(code); }

  // True once for the frame the key went down; the game clears it each tick.
  wasPressed(code) { return this.pressed.has(code); }

  endFrame() {
    this.pressed.clear();
    this.clicked = false;
    this.yawDelta = 0;
    this.pitchDelta = 0;
  }

  get moveX() {
    return (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0)
      - (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
  }

  get moveY() {
    return (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0)
      - (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0);
  }
}
