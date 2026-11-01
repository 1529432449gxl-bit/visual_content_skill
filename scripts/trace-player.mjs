// Framework-independent discrete-state playback. Call advance(dtMs) from your UI loop.
export function createTracePlayer(steps, { intervalMs = 600 } = {}) {
  if (!Array.isArray(steps) || !steps.length) throw new TypeError('steps must be non-empty');
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new RangeError('intervalMs must be positive');
  const freeze = (v, seen = new Set()) => {
    if (v && typeof v === 'object' && !seen.has(v)) {
      seen.add(v); Object.values(v).forEach(x => freeze(x, seen)); Object.freeze(v);
    }
    return v;
  };
  const history = freeze(structuredClone(steps));
  let index = 0, playing = false, elapsed = 0, speed = 1;
  const snapshot = () => ({ index, count: history.length, playing, speed, step: history[index] });
  const seek = n => {
    if (!Number.isInteger(n)) throw new TypeError('step index must be integer');
    index = Math.max(0, Math.min(history.length - 1, n));
    elapsed = 0; playing = false; return snapshot();
  };
  return {
    snapshot, seek,
    next: () => seek(index + 1), previous: () => seek(index - 1), reset: () => seek(0),
    play() { playing = index < history.length - 1; return snapshot(); },
    pause() { playing = false; return snapshot(); },
    setSpeed(value) {
      if (!Number.isFinite(value) || value <= 0) throw new RangeError('speed must be positive');
      speed = value; return snapshot();
    },
    advance(dtMs) {
      if (!Number.isFinite(dtMs) || dtMs < 0) throw new RangeError('dtMs must be non-negative');
      if (!playing) return snapshot();
      elapsed += dtMs * speed;
      const count = Math.floor(elapsed / intervalMs);
      if (count) { index = Math.min(history.length - 1, index + count); elapsed %= intervalMs; }
      if (index === history.length - 1) { playing = false; elapsed = 0; }
      return snapshot();
    }
  };
}
