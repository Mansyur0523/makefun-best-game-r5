// utils.js — small shared helpers: a seeded random generator (so screenshot scenes
// are deterministic), angle and distance math, and value helpers used across systems.

/** Mulberry32: a tiny deterministic PRNG. Same seed, same sequence, every run. */
export function createSeededRandom(seed) {
  let state = (seed >>> 0) || 1;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [min, max) from a random function. */
export function randomRange(rand, min, max) {
  return min + rand() * (max - min);
}

/** Pick one element of an array with a random function. */
export function randomPick(rand, list) {
  return list[Math.floor(rand() * list.length)];
}

/** Clamp a value into [min, max]. */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Linear interpolation between a and b by t in [0, 1]. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Euclidean distance between two points. */
export function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Angle in radians from (x1, y1) toward (x2, y2). */
export function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

/** Shortest signed turn from angle `from` toward angle `to`, in radians. */
export function angleDifference(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/** Format an integer with thousands separators (12,340). */
export function formatNumber(value) {
  return Math.floor(value).toLocaleString('en-US');
}

/** Format seconds as M:SS for timers. */
export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}
