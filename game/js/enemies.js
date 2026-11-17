// enemies.js — every foe of the Ember Reef: five kinds with their own movement and
// attack, the odd-night mini-bosses, and the Tide Leviathan, a three-phase final
// boss with radial ink shots, summons and a charging rush.

import { angleDifference, angleTo, clamp, distance, randomRange } from './utils.js';

export const KIND_SKITTER = 'skitter';
export const KIND_SPITTER = 'spitter';
export const KIND_BRUTE = 'brute';
export const KIND_DIVER = 'diver';
export const KIND_WISP = 'wisp';
export const KIND_MINIBOSS = 'miniboss';
export const KIND_LEVIATHAN = 'leviathan';

/** Base stats per kind: hp, speed, radius, touch damage, coin value, score value. */
export const ENEMY_STATS = {
  [KIND_SKITTER]: { name: 'Skitter', hp: 18, speed: 128, radius: 13, damage: 8, coins: 2, score: 50, color: '#7fe3d8', dark: '#1e7d74' },
  [KIND_SPITTER]: { name: 'Spitter', hp: 26, speed: 82, radius: 15, damage: 10, coins: 3, score: 80, color: '#c9a7ff', dark: '#6a3fb5' },
  [KIND_BRUTE]: { name: 'Brute', hp: 95, speed: 56, radius: 24, damage: 18, coins: 6, score: 150, color: '#ff8a5c', dark: '#a83c14' },
  [KIND_DIVER]: { name: 'Diver', hp: 34, speed: 92, radius: 14, damage: 12, coins: 3, score: 100, color: '#8fd0ff', dark: '#1f5f9e' },
  [KIND_WISP]: { name: 'Wisp', hp: 14, speed: 172, radius: 11, damage: 6, coins: 2, score: 60, color: '#ffe9a8', dark: '#b98a1e' },
  [KIND_MINIBOSS]: { name: 'Reef Tyrant', hp: 340, speed: 62, radius: 34, damage: 22, coins: 25, score: 800, color: '#ff5c7a', dark: '#8e1230' },
  [KIND_LEVIATHAN]: { name: 'Tide Leviathan', hp: 1500, speed: 48, radius: 52, damage: 26, coins: 100, score: 5000, color: '#3d6bff', dark: '#122a7a' },
};

let nextEnemyId = 1;

/** An enemy ink blob: the Spitter's and the Leviathan's ranged attack. */
export class InkBlob {
  constructor(x, y, angle, speed, damage, radius = 6) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.radius = radius;
    this.life = 4;
    this.dead = false;
  }

  update(dt, bounds) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0 || this.x < -20 || this.x > bounds.width + 20 || this.y < -20 || this.y > bounds.height + 20) {
      this.dead = true;
    }
  }
}

/** One enemy, with per-kind steering, attack timers and boss-phase state. */
export class Enemy {
  constructor(kind, x, y, hpMultiplier = 1, speedMultiplier = 1, rand = Math.random) {
    const stats = ENEMY_STATS[kind];
    this.id = nextEnemyId;
    nextEnemyId += 1;
    this.kind = kind;
    this.name = stats.name;
    this.x = x;
    this.y = y;
    this.maxHp = Math.round(stats.hp * hpMultiplier);
    this.hp = this.maxHp;
    this.speed = stats.speed * speedMultiplier;
    this.radius = stats.radius;
    this.damage = stats.damage;
    this.coins = stats.coins;
    this.score = stats.score;
    this.color = stats.color;
    this.dark = stats.dark;
    this.dead = false;
    this.flash = 0;
    this.angle = rand() * Math.PI * 2;
    this.wobble = rand() * Math.PI * 2;
    this.attackTimer = randomRange(rand, 1, 2.5);
    this.stateTimer = 0;
    this.state = 'chase';
    this.chargeAngle = 0;
    this.phase = 1;
    this.summonTimer = 6;
    this.radialTimer = 3;
    this.isBoss = kind === KIND_LEVIATHAN || kind === KIND_MINIBOSS;
    this.spawned = false;
  }

  /** Apply damage; returns true when this hit kills the enemy. */
  takeDamage(amount) {
    this.hp -= amount;
    this.flash = 0.12;
    if (this.hp <= 0) {
      this.dead = true;
      return true;
    }
    if (this.kind === KIND_LEVIATHAN) {
      const fraction = this.hp / this.maxHp;
      this.phase = fraction <= 0.33 ? 3 : fraction <= 0.66 ? 2 : 1;
    }
    return false;
  }

  /**
   * Steer toward the player. Returns ink blobs this enemy fired this frame
   * (Spitters, mini-bosses and the Leviathan shoot; the rest only touch).
   */
  update(dt, player, bounds, rand) {
    this.flash = Math.max(0, this.flash - dt);
    this.wobble += dt * 3;
    const dist = distance(this.x, this.y, player.x, player.y);
    const toPlayer = angleTo(this.x, this.y, player.x, player.y);
    const shots = [];
    const speedScale = this.kind === KIND_LEVIATHAN && this.phase === 3 ? 1.35 : 1;

    if (this.kind === KIND_SKITTER) {
      // Skitter: straight chase with a nervous side-to-side wiggle.
      const wiggle = Math.sin(this.wobble * 2.2) * 0.5;
      this.angle = toPlayer + wiggle;
      this.x += Math.cos(this.angle) * this.speed * speedScale * dt;
      this.y += Math.sin(this.angle) * this.speed * speedScale * dt;
    } else if (this.kind === KIND_WISP) {
      // Wisp: fast zig-zag, hard to lead.
      const zig = Math.sin(this.wobble * 4) * 0.9;
      this.angle = toPlayer + zig;
      this.x += Math.cos(this.angle) * this.speed * speedScale * dt;
      this.y += Math.sin(this.angle) * this.speed * speedScale * dt;
    } else if (this.kind === KIND_SPITTER) {
      // Spitter: keeps its distance, lobs ink when in range.
      if (dist > 300) {
        this.x += Math.cos(toPlayer) * this.speed * dt;
        this.y += Math.sin(toPlayer) * this.speed * dt;
      } else if (dist < 200) {
        this.x -= Math.cos(toPlayer) * this.speed * 0.7 * dt;
        this.y -= Math.sin(toPlayer) * this.speed * 0.7 * dt;
      }
      this.angle = toPlayer;
      this.attackTimer -= dt;
      if (this.attackTimer <= 0 && dist < 460) {
        this.attackTimer = randomRange(rand, 1.8, 2.6);
        shots.push(new InkBlob(this.x, this.y, toPlayer, 210, this.damage, 7));
      }
    } else if (this.kind === KIND_BRUTE) {
      // Brute: slow, unstoppable, straight at the player.
      this.angle = toPlayer;
      this.x += Math.cos(toPlayer) * this.speed * speedScale * dt;
      this.y += Math.sin(toPlayer) * this.speed * speedScale * dt;
    } else if (this.kind === KIND_DIVER) {
      // Diver: circles at range, then telegraphs and charges in a burst.
      this.stateTimer -= dt;
      if (this.state === 'chase') {
        const orbit = toPlayer + Math.PI / 2;
        this.x += Math.cos(orbit) * this.speed * 0.6 * dt;
        this.y += Math.sin(orbit) * this.speed * 0.6 * dt;
        this.x += Math.cos(toPlayer) * this.speed * 0.35 * dt;
        this.y += Math.sin(toPlayer) * this.speed * 0.35 * dt;
        if (this.stateTimer <= 0 && dist < 380) {
          this.state = 'telegraph';
          this.stateTimer = 0.45;
          this.chargeAngle = toPlayer;
        }
      } else if (this.state === 'telegraph') {
        this.chargeAngle = toPlayer;
        if (this.stateTimer <= 0) {
          this.state = 'charge';
          this.stateTimer = 0.55;
        }
      } else {
        this.x += Math.cos(this.chargeAngle) * this.speed * 2.9 * dt;
        this.y += Math.sin(this.chargeAngle) * this.speed * 2.9 * dt;
        if (this.stateTimer <= 0) {
          this.state = 'chase';
          this.stateTimer = randomRange(rand, 1.6, 2.6);
        }
      }
      this.angle = this.state === 'charge' ? this.chargeAngle : toPlayer;
    } else if (this.kind === KIND_MINIBOSS) {
      // Reef Tyrant: a brute that also spits a three-blob fan.
      this.angle = toPlayer;
      this.x += Math.cos(toPlayer) * this.speed * dt;
      this.y += Math.sin(toPlayer) * this.speed * dt;
      this.attackTimer -= dt;
      if (this.attackTimer <= 0 && dist < 520) {
        this.attackTimer = randomRange(rand, 2.2, 3.0);
        for (const offset of [-0.28, 0, 0.28]) {
          shots.push(new InkBlob(this.x, this.y, toPlayer + offset, 230, this.damage, 8));
        }
      }
    } else if (this.kind === KIND_LEVIATHAN) {
      // Tide Leviathan, three phases: radial ink (always), summons (phase 2+),
      // and a charging rush (phase 3). Each phase visibly changes its colour.
      this.angle = toPlayer;
      const approach = this.phase === 3 ? 1.5 : 1;
      if (dist > 240) {
        this.x += Math.cos(toPlayer) * this.speed * approach * dt;
        this.y += Math.sin(toPlayer) * this.speed * approach * dt;
      }
      this.radialTimer -= dt;
      if (this.radialTimer <= 0) {
        this.radialTimer = this.phase === 3 ? 1.6 : 2.4;
        const count = this.phase === 1 ? 8 : this.phase === 2 ? 12 : 16;
        const base = rand() * Math.PI * 2;
        for (let i = 0; i < count; i += 1) {
          shots.push(new InkBlob(
            this.x, this.y, base + (i / count) * Math.PI * 2, 170, this.damage * 0.8, 8,
          ));
        }
      }
      this.summonTimer -= dt;
      if (this.phase >= 2 && this.summonTimer <= 0) {
        this.summonTimer = 7;
        this._summonRequested = true;
      }
      this.attackTimer -= dt;
      if (this.attackTimer <= 0 && dist < 560) {
        this.attackTimer = this.phase === 3 ? 1.4 : 2.2;
        for (const offset of [-0.2, 0, 0.2]) {
          shots.push(new InkBlob(this.x, this.y, toPlayer + offset, 250, this.damage, 9));
        }
      }
    }

    this.x = clamp(this.x, 20, bounds.width - 20);
    this.y = clamp(this.y, 20, bounds.height - 20);
    return shots;
  }

  /** True when the Leviathan asked the wave director to summon skitters. */
  consumeSummonRequest() {
    const requested = Boolean(this._summonRequested);
    this._summonRequested = false;
    return requested;
  }
}

/**
 * Spawn an enemy at the arena edge, on the side farthest from the player when
 * possible, so foes arrive from every direction across the night.
 */
export function spawnEnemyAtEdge(kind, player, bounds, hpMultiplier, speedMultiplier, rand) {
  const side = Math.floor(rand() * 4);
  let x = 0;
  let y = 0;
  const margin = 30;
  if (side === 0) { x = randomRange(rand, margin, bounds.width - margin); y = margin; }
  if (side === 1) { x = randomRange(rand, margin, bounds.width - margin); y = bounds.height - margin; }
  if (side === 2) { x = margin; y = randomRange(rand, margin, bounds.height - margin); }
  if (side === 3) { x = bounds.width - margin; y = randomRange(rand, margin, bounds.height - margin); }
  const enemy = new Enemy(kind, x, y, hpMultiplier, speedMultiplier, rand);
  enemy.spawned = true;
  return enemy;
}

/** Spawn a mini-boss or the Leviathan in the open water, away from the player. */
export function spawnBoss(kind, player, bounds, hpMultiplier, rand) {
  const angle = rand() * Math.PI * 2;
  const x = clamp(player.x + Math.cos(angle) * 420, 90, bounds.width - 90);
  const y = clamp(player.y + Math.sin(angle) * 300, 90, bounds.height - 90);
  return new Enemy(kind, x, y, hpMultiplier, 1, rand);
}
