// waves.js — the ten nights of the siege. Each night is a build list of enemy
// kinds with counts; the WaveDirector drips them into the arena on a timer, adds
// the odd-night mini-boss and the Night 10 Leviathan, and reports when the night
// is truly clear (queue empty and arena empty).

import { KIND_BRUTE, KIND_DIVER, KIND_LEVIATHAN, KIND_MINIBOSS, KIND_SKITTER, KIND_SPITTER, KIND_WISP, spawnBoss, spawnEnemyAtEdge } from './enemies.js';
import { randomPick } from './utils.js';

/** How many nights the siege lasts. Survive all ten and the reef is saved. */
export const TOTAL_NIGHTS = 10;

/** Night names, shown on the wave banner — the tide rises as the nights pass. */
export const NIGHT_NAMES = [
  'First Ripple',
  'Rising Tide',
  'Ink on the Water',
  'The Deep Stirs',
  'Teeth in the Dark',
  'The Longest Night',
  'Salt and Smoke',
  'The Hollow Moon',
  'Storm Surge',
  'The Leviathan Wakes',
];

/** Kinds that may appear from each night onward. */
const KIND_POOL_BY_NIGHT = [
  [KIND_SKITTER],
  [KIND_SKITTER, KIND_WISP],
  [KIND_SKITTER, KIND_WISP, KIND_SPITTER],
  [KIND_SKITTER, KIND_WISP, KIND_SPITTER, KIND_DIVER],
  [KIND_SKITTER, KIND_WISP, KIND_SPITTER, KIND_DIVER, KIND_BRUTE],
  [KIND_SKITTER, KIND_WISP, KIND_SPITTER, KIND_DIVER, KIND_BRUTE],
  [KIND_SKITTER, KIND_WISP, KIND_SPITTER, KIND_DIVER, KIND_BRUTE],
  [KIND_SKITTER, KIND_WISP, KIND_SPITTER, KIND_DIVER, KIND_BRUTE],
  [KIND_SKITTER, KIND_WISP, KIND_SPITTER, KIND_DIVER, KIND_BRUTE],
  [KIND_SKITTER, KIND_WISP, KIND_SPITTER, KIND_DIVER, KIND_BRUTE],
];

/** Build the spawn queue for a night: weighted kinds, more foes each night. */
export function buildNightQueue(night, rand) {
  const pool = KIND_POOL_BY_NIGHT[Math.min(night, TOTAL_NIGHTS) - 1];
  const count = 6 + night * 3;
  const queue = [];
  let brutes = 0;
  for (let i = 0; i < count; i += 1) {
    let kind = randomPick(rand, pool);
    // Brutes are the wall of the siege: never let the queue hold more than
    // two of them by luck, or the arena becomes an unkillable crowd.
    if (kind === KIND_BRUTE) {
      if (brutes >= 2) kind = KIND_SKITTER;
      else brutes += 1;
    }
    queue.push(kind);
  }
  // Brutes are rare early and common late: force a few in from night 5 on.
  if (night >= 5) {
    const forced = Math.min(night - 3, 3);
    for (let i = 0; i < forced; i += 1) queue.push(KIND_BRUTE);
  }
  // Shuffle the queue so the mix is unpredictable.
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = queue[i];
    queue[i] = queue[j];
    queue[j] = tmp;
  }
  return queue;
}

/** Enemy HP multiplier for a night: the tide gets heavier every night. */
export function nightHpMultiplier(night) {
  return 1 + (night - 1) * 0.13;
}

/** Enemy speed multiplier for a night: gentle, so later nights stay fair. */
export function nightSpeedMultiplier(night) {
  return 1 + (night - 1) * 0.03;
}

/** Seconds between spawns: faster as the nights go on. */
export function nightSpawnInterval(night) {
  return Math.max(0.55, 1.5 - night * 0.09);
}

/** True on odd nights 3, 5, 7, 9: a Reef Tyrant mini-boss joins the night. */
export function nightHasMiniBoss(night) {
  return night % 2 === 1 && night >= 3 && night < TOTAL_NIGHTS;
}

/** The WaveDirector owns one night at a time: queue, timer, boss, completion. */
export class WaveDirector {
  constructor(game) {
    this.game = game;
    this.night = 0;
    this.queue = [];
    this.spawnTimer = 0;
    this.spawnInterval = 1.2;
    this.hpMultiplier = 1;
    this.speedMultiplier = 1;
    this.bossSpawned = false;
    this.miniBossSpawned = false;
    this.active = false;
  }

  /** Begin a night: build its queue and reset the director. */
  startNight(night) {
    this.night = night;
    this.queue = buildNightQueue(night, this.game.rand);
    this.spawnInterval = nightSpawnInterval(night);
    this.hpMultiplier = nightHpMultiplier(night);
    this.speedMultiplier = nightSpeedMultiplier(night);
    this.spawnTimer = 0.5;
    this.bossSpawned = false;
    this.miniBossSpawned = false;
    this.active = true;
  }

  /** How many foes are still to arrive or alive (for the HUD and the clear check). */
  remaining() {
    return this.queue.length + this.game.enemies.length;
  }

  /** Drip the queue into the arena; spawn the night's boss at the right moment. */
  update(dt) {
    if (!this.active) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.queue.length > 0) {
      this.spawnTimer = this.spawnInterval;
      const kind = this.queue.shift();
      const enemy = spawnEnemyAtEdge(
        kind, this.game.player, this.game.bounds,
        this.hpMultiplier, this.speedMultiplier, this.game.rand,
      );
      this.game.enemies.push(enemy);
      this.game.particles.spawnSplash(enemy.x, enemy.y);
    }
    if (nightHasMiniBoss(this.night) && !this.miniBossSpawned && this.queue.length <= 2) {
      this.miniBossSpawned = true;
      const boss = spawnBoss(KIND_MINIBOSS, this.game.player, this.game.bounds, this.hpMultiplier, this.game.rand);
      this.game.enemies.push(boss);
      this.game.onMiniBossSpawned(boss);
    }
    if (this.night === TOTAL_NIGHTS && !this.bossSpawned && this.queue.length === 0) {
      this.bossSpawned = true;
      const boss = spawnBoss(KIND_LEVIATHAN, this.game.player, this.game.bounds, 1, this.game.rand);
      this.game.enemies.push(boss);
      this.game.onBossSpawned(boss);
    }
  }

  /** True when the night is over: nothing queued and nothing alive. */
  isNightClear() {
    return this.active && this.queue.length === 0 && this.game.enemies.length === 0;
  }

  /** Stop spawning (night over, game over, victory). */
  stop() {
    this.active = false;
  }
}
