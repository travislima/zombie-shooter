export class Input {
  constructor() {
    this.keys = {};
    this.mouseDown = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.locked = false;

    this._onKeyDown = (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Escape') this._escPressed = true;
      if (e.code === 'KeyR') this._reloadPressed = true;
      if (e.code === 'KeyB') this._shopPressed = true;
    };
    this._onKeyUp = (e) => {
      this.keys[e.code] = false;
    };
    this._onMouseDown = (e) => {
      if (e.button === 0) this.mouseDown = true;
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) this.mouseDown = false;
    };
    this._onMouseMove = (e) => {
      if (this.locked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    };
    this._onPointerLockChange = () => {
      this.locked = document.pointerLockElement != null;
    };

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);

    this._escPressed = false;
    this._reloadPressed = false;
    this._shopPressed = false;
  }

  consumeEsc() {
    const v = this._escPressed;
    this._escPressed = false;
    return v;
  }

  consumeReload() {
    const v = this._reloadPressed;
    this._reloadPressed = false;
    return v;
  }

  consumeShop() {
    const v = this._shopPressed;
    this._shopPressed = false;
    return v;
  }

  consumeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  requestLock(element) {
    element.requestPointerLock();
  }

  exitLock() {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  isDown(code) {
    return !!this.keys[code];
  }

  get forward() { return this.isDown('KeyW') || this.isDown('ArrowUp'); }
  get backward() { return this.isDown('KeyS') || this.isDown('ArrowDown'); }
  get left() { return this.isDown('KeyA') || this.isDown('ArrowLeft'); }
  get right() { return this.isDown('KeyD') || this.isDown('ArrowRight'); }
  get shift() { return this.isDown('ShiftLeft') || this.isDown('ShiftRight'); }
}
