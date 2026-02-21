export class TouchControls {
  constructor(input) {
    this.input = input;
    this.enabled = false;
    this.el = null;

    // Joystick state
    this.joystickActive = false;
    this.joystickTouchId = null;
    this.joystickOrigin = { x: 0, y: 0 };
    this.joystickPos = { x: 0, y: 0 };
    this.moveX = 0;
    this.moveY = 0;

    // Look state
    this.lookTouchId = null;
    this.lastLookPos = { x: 0, y: 0 };

    // Detect touch device
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (this.isTouchDevice) {
      this._createUI();
      this._bindEvents();
    }
  }

  _createUI() {
    this.el = document.createElement('div');
    this.el.id = 'touch-controls';
    this.el.innerHTML = `
      <div id="touch-joystick-area">
        <div id="touch-joystick-ring">
          <div id="touch-joystick-knob"></div>
        </div>
      </div>
      <div id="touch-fire-btn">FIRE</div>
      <div id="touch-reload-btn">R</div>
      <div id="touch-shop-btn" style="display:none;">SHOP</div>
    `;
    document.body.appendChild(this.el);

    this.joystickArea = document.getElementById('touch-joystick-area');
    this.joystickRing = document.getElementById('touch-joystick-ring');
    this.joystickKnob = document.getElementById('touch-joystick-knob');
    this.fireBtn = document.getElementById('touch-fire-btn');
    this.reloadBtn = document.getElementById('touch-reload-btn');
    this.shopBtn = document.getElementById('touch-shop-btn');
  }

  _bindEvents() {
    // Prevent default touch behavior
    document.addEventListener('touchstart', (e) => {
      if (this.enabled) e.preventDefault();
    }, { passive: false });

    // Joystick area
    this.joystickArea.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      const touch = e.changedTouches[0];
      this.joystickActive = true;
      this.joystickTouchId = touch.identifier;
      this.joystickOrigin.x = touch.clientX;
      this.joystickOrigin.y = touch.clientY;
      this.joystickRing.style.left = (touch.clientX - 50) + 'px';
      this.joystickRing.style.top = (touch.clientY - 50) + 'px';
      this.joystickRing.style.display = 'block';
    });

    // Fire button
    this.fireBtn.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.input.mouseDown = true;
    });
    this.fireBtn.addEventListener('touchend', (e) => {
      this.input.mouseDown = false;
    });

    // Reload button
    this.reloadBtn.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.input._reloadPressed = true;
    });

    // Shop button
    this.shopBtn.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.input._shopPressed = true;
    });

    // Look area - right side touch that's not on buttons
    document.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      for (const touch of e.changedTouches) {
        // Right half of screen, not on buttons
        if (touch.clientX > window.innerWidth * 0.4 &&
            !this.fireBtn.contains(touch.target) &&
            !this.reloadBtn.contains(touch.target) &&
            !this.shopBtn.contains(touch.target) &&
            !this.joystickArea.contains(touch.target)) {
          this.lookTouchId = touch.identifier;
          this.lastLookPos.x = touch.clientX;
          this.lastLookPos.y = touch.clientY;
        }
      }
    });

    // Touch move
    document.addEventListener('touchmove', (e) => {
      if (!this.enabled) return;
      for (const touch of e.changedTouches) {
        // Joystick
        if (touch.identifier === this.joystickTouchId) {
          const dx = touch.clientX - this.joystickOrigin.x;
          const dy = touch.clientY - this.joystickOrigin.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 40;
          const clampedDist = Math.min(dist, maxDist);
          const angle = Math.atan2(dy, dx);

          this.moveX = (clampedDist / maxDist) * Math.cos(angle);
          this.moveY = (clampedDist / maxDist) * Math.sin(angle);

          // Visual feedback
          this.joystickKnob.style.transform =
            `translate(${Math.cos(angle) * clampedDist}px, ${Math.sin(angle) * clampedDist}px)`;
        }

        // Look
        if (touch.identifier === this.lookTouchId) {
          const dx = touch.clientX - this.lastLookPos.x;
          const dy = touch.clientY - this.lastLookPos.y;
          this.input.mouseDX += dx * 1.5;
          this.input.mouseDY += dy * 1.5;
          this.lastLookPos.x = touch.clientX;
          this.lastLookPos.y = touch.clientY;
        }
      }
    }, { passive: true });

    // Touch end
    document.addEventListener('touchend', (e) => {
      if (!this.enabled) return;
      for (const touch of e.changedTouches) {
        if (touch.identifier === this.joystickTouchId) {
          this.joystickActive = false;
          this.joystickTouchId = null;
          this.moveX = 0;
          this.moveY = 0;
          this.joystickKnob.style.transform = 'translate(0, 0)';
          this.joystickRing.style.display = 'none';
        }
        if (touch.identifier === this.lookTouchId) {
          this.lookTouchId = null;
        }
      }
    });
  }

  enable() {
    if (!this.isTouchDevice) return;
    this.enabled = true;
    this.el.style.display = 'block';
    // On touch devices, skip pointer lock
    this.input.locked = true;
  }

  disable() {
    if (!this.isTouchDevice) return;
    this.enabled = false;
    if (this.el) this.el.style.display = 'none';
    this.moveX = 0;
    this.moveY = 0;
    this.input.mouseDown = false;
  }

  // Apply joystick input to the input system (call each frame)
  applyToInput() {
    if (!this.enabled || !this.joystickActive) return;
    // Map joystick to WASD-like input
    const threshold = 0.2;
    this.input.keys['KeyW'] = this.moveY < -threshold;
    this.input.keys['KeyS'] = this.moveY > threshold;
    this.input.keys['KeyA'] = this.moveX < -threshold;
    this.input.keys['KeyD'] = this.moveX > threshold;
  }

  clearInput() {
    if (!this.enabled) return;
    if (!this.joystickActive) {
      this.input.keys['KeyW'] = false;
      this.input.keys['KeyS'] = false;
      this.input.keys['KeyA'] = false;
      this.input.keys['KeyD'] = false;
    }
  }

  showShopButton() {
    if (this.shopBtn) this.shopBtn.style.display = 'flex';
  }

  hideShopButton() {
    if (this.shopBtn) this.shopBtn.style.display = 'none';
  }
}
