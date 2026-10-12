// Fixed-timestep game loop: simulation always runs at exactly 60 updates per
// second (deterministic), rendering happens once per animation frame.
import { FPS } from '../config.js';

export function startLoop({ update, render }) {
  const STEP = 1000 / FPS;
  let acc = 0;
  let last = performance.now();
  let running = true;

  function frame(now) {
    if (!running) return;
    // Clamp huge gaps (tab in background) so we don't spiral.
    let dt = Math.min(now - last, 200);
    last = now;
    // A frame time within a millisecond of a whole number of steps is that many steps: the browser's timestamps
    // jitter around 16.7 ms on a 60 Hz screen, and without this a frame now and then runs two updates and the
    // next one none, which reads as a stutter.
    const n = Math.round(dt / STEP);
    if (n >= 1 && Math.abs(dt - n * STEP) < 1) dt = n * STEP;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 8) {
      update();
      acc -= STEP;
      steps++;
    }
    if (steps >= 8) acc = 0;
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { stop: () => (running = false) };
}
