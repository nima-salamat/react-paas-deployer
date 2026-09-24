/**
 * Derived from mouse-animations 1.1.0
 * https://github.com/tgomilar/mouse-animations
 * MIT License — Copyright (c) 2026 Tanja Gomilar
 *
 * Adapted to keep the cursor renderer framework-free and transform-based.
 */

export class MouseFollower {
  constructor({ smoothness = 1, onFrame, onRawMove, onFirstMove } = {}) {
    this.smoothness = Math.max(0, Math.min(1, smoothness));
    this.onFrame = onFrame;
    this.onRawMove = onRawMove;
    this.onFirstMove = onFirstMove;
    this.rawX = 0;
    this.rawY = 0;
    this.smoothX = 0;
    this.smoothY = 0;
    this.rafId = null;
    this.active = false;
    this.hasReceivedFirstMove = false;
    this.onMouseMove = this.onMouseMove.bind(this);
    this.loop = this.loop.bind(this);
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.hasReceivedFirstMove = false;
    document.addEventListener("mousemove", this.onMouseMove, { passive: true });
    if (this.smoothness < 1) {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    document.removeEventListener("mousemove", this.onMouseMove);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy() {
    this.stop();
  }

  onMouseMove(event) {
    this.rawX = event.clientX;
    this.rawY = event.clientY;

    if (!this.hasReceivedFirstMove) {
      this.hasReceivedFirstMove = true;
      this.smoothX = this.rawX;
      this.smoothY = this.rawY;
      this.onFirstMove?.(this.rawX, this.rawY);
    }

    this.onRawMove?.(this.rawX, this.rawY);

    if (this.smoothness >= 1) {
      this.smoothX = this.rawX;
      this.smoothY = this.rawY;
      this.onFrame?.(this.rawX, this.rawY);
    }
  }

  loop() {
    if (!this.active) return;
    this.smoothX += (this.rawX - this.smoothX) * this.smoothness;
    this.smoothY += (this.rawY - this.smoothY) * this.smoothness;
    this.onFrame?.(this.smoothX, this.smoothY);
    this.rafId = requestAnimationFrame(this.loop);
  }
}
