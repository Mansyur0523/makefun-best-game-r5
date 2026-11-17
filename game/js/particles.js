// particles.js — the juice: sparks, splashes, smoke rings, ember trails and the
// floating damage numbers that make every hit readable at a glance.

import { clamp, randomRange } from './utils.js';

/** A single particle: position, velocity, life, size, colour and drag. */
class Particle {
  constructor(x, y, vx, vy, life, size, color, drag = 0.92, gravity = 0) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.color = color;
    this.drag = drag;
    this.gravity = gravity;
    this.ring = false;
  }
}

/** A floating combat number or pickup label that rises and fades. */
class FloatingText {
  constructor(x, y, text, color, size = 15) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.size = size;
    this.life = 0.9;
    this.maxLife = 0.9;
  }
}

/** Owns every particle and floating text; update + draw each frame. */
export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.texts = [];
  }

  /** Remove everything (fresh wave, restart). */
  clear() {
    this.particles.length = 0;
    this.texts.length = 0;
  }

  /** Generic burst of coloured sparks. */
  burst(x, y, color, count = 10, speed = 180, size = 3) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const power = randomRange(Math.random, speed * 0.3, speed);
      this.particles.push(new Particle(
        x, y,
        Math.cos(angle) * power, Math.sin(angle) * power,
        randomRange(Math.random, 0.25, 0.6),
        randomRange(Math.random, size * 0.6, size * 1.4),
        color,
      ));
    }
  }

  /** Hit sparks: small, fast, in the weapon's colour. */
  spawnHitSparks(x, y, color) {
    this.burst(x, y, color, 8, 220, 2.6);
  }

  /** An enemy pops: ink + ember spray plus an expanding ring. */
  spawnExplosion(x, y, color, big = false) {
    this.burst(x, y, color, big ? 26 : 14, big ? 300 : 210, big ? 4 : 3);
    this.burst(x, y, '#ffd27a', big ? 10 : 5, 160, 2.4);
    const ring = new Particle(x, y, 0, 0, 0.35, big ? 46 : 26, color, 1, 0);
    ring.ring = true;
    this.particles.push(ring);
  }

  /** Coins scatter when an enemy dies. */
  spawnCoinBurst(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const power = randomRange(Math.random, 40, 130);
      this.particles.push(new Particle(
        x, y,
        Math.cos(angle) * power, Math.sin(angle) * power,
        randomRange(Math.random, 0.4, 0.8),
        randomRange(Math.random, 3, 5),
        '#ffd34d', 0.9, 0,
      ));
    }
  }

  /** A coin is collected: a tiny golden flash. */
  spawnCoinPickup(x, y) {
    this.burst(x, y, '#ffe08a', 5, 90, 2.2);
  }

  /** Splash where something enters the water. */
  spawnSplash(x, y, color = '#bfeef2') {
    this.burst(x, y, color, 9, 150, 2.8);
  }

  /** Ember trail behind the lance and the lighthouse beam's sparks. */
  spawnEmberTrail(x, y) {
    this.particles.push(new Particle(
      x + randomRange(Math.random, -4, 4), y + randomRange(Math.random, -4, 4),
      randomRange(Math.random, -20, 20), randomRange(Math.random, -30, -5),
      randomRange(Math.random, 0.3, 0.55), randomRange(Math.random, 2, 3.6),
      Math.random() < 0.5 ? '#ff9a3d' : '#ffd27a', 0.96, -40,
    ));
  }

  /** Dash afterimages: fading teal ghosts of the player. */
  spawnDashGhost(x, y) {
    this.particles.push(new Particle(x, y, 0, 0, 0.3, 15, '#7fe3d8', 1, 0));
  }

  /** A floating damage number. */
  spawnDamageNumber(x, y, amount, critical = false) {
    this.texts.push(new FloatingText(
      x + randomRange(Math.random, -8, 8), y - 8,
      String(Math.round(amount)), critical ? '#ffd34d' : '#ffffff', critical ? 20 : 15,
    ));
  }

  /** A floating label such as "+3 coins" or "COMBO x5". */
  spawnLabel(x, y, text, color = '#ffd34d', size = 15) {
    this.texts.push(new FloatingText(x, y, text, color, size));
  }

  /** Step every particle and text forward by dt seconds. */
  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.ring) p.size += dt * 260;
    }
    for (let i = this.texts.length - 1; i >= 0; i -= 1) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 42 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }

  /** Draw every particle and floating text. */
  draw(ctx) {
    for (const p of this.particles) {
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      if (p.ring) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const alpha = clamp(t.life / t.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${t.size}px "Trebuchet MS", sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(10, 40, 46, 0.85)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
