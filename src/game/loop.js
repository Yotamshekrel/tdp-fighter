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
    acc += Math.min(now - last, 200);
    last = now;
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
