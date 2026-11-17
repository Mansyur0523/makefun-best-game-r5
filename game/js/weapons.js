// weapons.js — the three weapons of the Ember Reef: Harpoon, Scatter Net and Ember
// Lance. Each entry is the weapon's whole identity: damage, rate, spread, bullet
// speed, pierce and colour. Fire functions build real bullet objects the Game moves.

import { clamp } from './utils.js';

/** Weapon ids, in the order the 1 / 2 / 3 keys select them. */
export const WEAPON_HARPOON = 'harpoon';
export const WEAPON_SCATTER = 'scatter';
export const WEAPON_LANCE = 'lance';

/** The weapon table: what every shot costs and does. */
export const WEAPONS = {
  [WEAPON_HARPOON]: {
    id: WEAPON_HARPOON,
    name: 'Harpoon',
    short: 'HARPOON',
    key: '1',
    description: 'Fast, precise, one sharp bolt. The reliable workhorse.',
    damage: 15,
    fireRate: 0.26,
    bulletSpeed: 740,
    spread: 0,
    pellets: 1,
    pierce: 0,
    bulletSize: 4,
    color: '#ffe9a8',
    trail: '#ffd34d',
  },
  [WEAPON_SCATTER]: {
    id: WEAPON_SCATTER,
    name: 'Scatter Net',
    short: 'SCATTER',
    key: '2',
    description: 'Five weighted pellets in a fan. Clears crowds up close.',
    damage: 7,
    fireRate: 0.72,
    bulletSpeed: 580,
    spread: 0.55,
    pellets: 5,
    pierce: 0,
    bulletSize: 3.5,
    color: '#a8ecff',
    trail: '#5fc9e8',
  },
  [WEAPON_LANCE]: {
    id: WEAPON_LANCE,
    name: 'Ember Lance',
    short: 'LANCE',
    key: '3',
    description: 'A slow, burning spear that pierces through three foes.',
    damage: 34,
    fireRate: 0.85,
    bulletSpeed: 920,
    spread: 0,
    pellets: 1,
    pierce: 3,
    bulletSize: 6,
    color: '#ff9a3d',
    trail: '#ff6a2a',
  },
};

/** The three weapons in selection order. */
export const WEAPON_ORDER = [WEAPON_HARPOON, WEAPON_SCATTER, WEAPON_LANCE];

/** Look a weapon up by id; falls back to the Harpoon. */
export function getWeapon(id) {
  return WEAPONS[id] || WEAPONS[WEAPON_HARPOON];
}

/** A bullet in flight: position, velocity, damage, pierce left, and what it hit. */
export class Bullet {
  constructor(x, y, angle, weapon, damage, friendly = true) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * weapon.bulletSpeed;
    this.vy = Math.sin(angle) * weapon.bulletSpeed;
    this.angle = angle;
    this.damage = damage;
    this.pierce = weapon.pierce;
    this.size = weapon.bulletSize;
    this.color = weapon.color;
    this.trail = weapon.trail;
    this.friendly = friendly;
    this.life = 1.4;
    this.dead = false;
    this.hitIds = new Set();
    this.isLance = weapon.id === WEAPON_LANCE;
  }

  /** Move the bullet; mark it dead past its life or off the arena. */
  update(dt, bounds) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    if (this.x < -40 || this.x > bounds.width + 40 || this.y < -40 || this.y > bounds.height + 40) {
      this.dead = true;
    }
  }
}

/**
 * Fire one shot of `weaponId` from (x, y) toward `angle`, with the player's damage
 * and rate multipliers applied. Returns the new bullets (one, or a fan of five).
 */
export function fireWeapon(weaponId, x, y, angle, damageMultiplier = 1) {
  const weapon = getWeapon(weaponId);
  const bullets = [];
  const count = weapon.pellets;
  for (let i = 0; i < count; i += 1) {
    let shotAngle = angle;
    if (count > 1) {
      const t = count === 1 ? 0 : (i / (count - 1)) - 0.5;
      shotAngle = angle + t * weapon.spread;
    }
    const startX = x + Math.cos(shotAngle) * 22;
    const startY = y + Math.sin(shotAngle) * 22;
    bullets.push(new Bullet(startX, startY, shotAngle, weapon, weapon.damage * damageMultiplier));
  }
  return bullets;
}

/** Cooldown (seconds) between shots of a weapon, after the fire-rate multiplier. */
export function weaponCooldown(weaponId, rateMultiplier = 1) {
  const weapon = getWeapon(weaponId);
  return clamp(weapon.fireRate / rateMultiplier, 0.08, 2);
}
