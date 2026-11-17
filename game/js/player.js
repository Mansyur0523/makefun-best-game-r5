// player.js — the Tidewarden: movement, dash with invulnerability frames, weapon
// switching, firing, damage, healing, coin magnet and the allied lantern turrets
// that orbit the lighthouse and shoot on their own.

import { angleTo, clamp, distance } from './utils.js';
import { fireWeapon, getWeapon, weaponCooldown, WEAPON_HARPOON, WEAPON_ORDER } from './weapons.js';

/** A lantern turret: an allied gun that aims at the nearest foe and fires. */
export class Turret {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.cooldown = 0;
    this.range = 340;
  }

  /** Aim at the nearest enemy in range and fire a harpoon bolt at it. */
  update(dt, enemies, fireCallback) {
    this.cooldown -= dt;
    let best = null;
    let bestDist = this.range;
    for (const enemy of enemies) {
      const d = distance(this.x, this.y, enemy.x, enemy.y);
      if (d < bestDist) {
        bestDist = d;
        best = enemy;
      }
    }
    if (!best) return;
    this.angle = angleTo(this.x, this.y, best.x, best.y);
    if (this.cooldown <= 0) {
      this.cooldown = 0.55;
      fireCallback(this.x, this.y, this.angle, 10);
    }
  }
}

/** The player: the last Warden of the Ember Reef. */
export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 16;
    this.speed = 235;
    this.maxHp = 120;
    this.hp = 120;
    this.weapon = WEAPON_HARPOON;
    this.fireTimer = 0;
    this.damageMultiplier = 1;
    this.rateMultiplier = 1;
    this.dashCooldownMax = 2.2;
    this.dashCooldown = 0;
    this.dashTime = 0;
    this.dashAngle = 0;
    this.invulnerable = 0;
    this.hurtFlash = 0;
    this.magnetRadius = 90;
    this.turrets = [];
    this.upgradeLevels = {};
    this.armor = 0;
    this.coinMultiplier = 1;
    this.critChance = 0;
    this.bonusPierce = 0;
    this.nightHeal = 0;
    this.aimAngle = 0;
    this.moving = false;
    this.walkCycle = 0;
    this.dead = false;
  }

  /** Restore the player to a fresh run. */
  reset(x, y) {
    this.x = x;
    this.y = y;
    this.maxHp = 120;
    this.hp = 120;
    this.weapon = WEAPON_HARPOON;
    this.fireTimer = 0;
    this.damageMultiplier = 1;
    this.rateMultiplier = 1;
    this.dashCooldownMax = 2.2;
    this.dashCooldown = 0;
    this.dashTime = 0;
    this.invulnerable = 0;
    this.hurtFlash = 0;
    this.magnetRadius = 90;
    this.turrets = [];
    this.upgradeLevels = {};
    this.armor = 0;
    this.coinMultiplier = 1;
    this.critChance = 0;
    this.bonusPierce = 0;
    this.nightHeal = 0;
    this.dead = false;
  }

  /** Switch to a weapon by id; returns true when the switch happened. */
  switchWeapon(weaponId) {
    if (!WEAPON_ORDER.includes(weaponId)) return false;
    if (this.weapon === weaponId) return false;
    this.weapon = weaponId;
    this.fireTimer = Math.min(this.fireTimer, 0.1);
    return true;
  }

  /** Add one allied turret beside the lighthouse (max two). */
  addTurret() {
    if (this.turrets.length >= 2) return false;
    const index = this.turrets.length;
    const angle = index === 0 ? Math.PI * 0.75 : Math.PI * 0.25;
    this.turrets.push(new Turret(640 + Math.cos(angle) * 130, 360 + Math.sin(angle) * 130));
    return true;
  }

  /** Heal, never above max HP; returns the amount actually healed. */
  heal(amount) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - before;
  }

  /** True when the dash is ready to fire. */
  get dashReady() {
    return this.dashCooldown <= 0;
  }

  /** Fraction of the dash cooldown that has recharged (0..1). */
  get dashFraction() {
    return clamp(1 - this.dashCooldown / this.dashCooldownMax, 0, 1);
  }

  /** Start a dash in the current movement direction (or the aim direction). */
  startDash(moveX, moveY) {
    if (!this.dashReady || this.dashTime > 0) return false;
    this.dashTime = 0.18;
    this.dashCooldown = this.dashCooldownMax;
    this.invulnerable = Math.max(this.invulnerable, 0.28);
    if (moveX !== 0 || moveY !== 0) {
      this.dashAngle = Math.atan2(moveY, moveX);
    } else {
      this.dashAngle = this.aimAngle;
    }
    return true;
  }

  /** Take a hit; armour softens it, invulnerability frames and the dash ignore it. */
  takeDamage(amount) {
    if (this.invulnerable > 0 || this.dead) return 0;
    const reduced = amount * (1 - (this.armor || 0));
    this.hp -= reduced;
    this.hurtFlash = 0.25;
    this.invulnerable = 0.7;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
    return reduced;
  }

  /**
   * Step the player: move, dash, aim, fire. `fireCallback` receives the bullets
   * this frame produced; `onDash` fires when a dash starts.
   */
  update(dt, input, bounds, fireCallback, onDash) {
    this.fireTimer -= dt;
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.dead) return;

    const move = input.effectiveMoveVector();
    this.moving = move.x !== 0 || move.y !== 0;
    if (this.moving) this.walkCycle += dt * 10;

    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.x += Math.cos(this.dashAngle) * 640 * dt;
      this.y += Math.sin(this.dashAngle) * 640 * dt;
    } else {
      this.x += move.x * this.speed * dt;
      this.y += move.y * this.speed * dt;
      if (input.wasPressed('ShiftLeft') || input.wasPressed('ShiftRight') || input.wasPressed('Space')) {
        if (this.startDash(move.x, move.y) && onDash) onDash();
      }
    }
    this.x = clamp(this.x, this.radius + 8, bounds.width - this.radius - 8);
    this.y = clamp(this.y, this.radius + 8, bounds.height - this.radius - 8);

    this.aimAngle = angleTo(this.x, this.y, input.mouseX, input.mouseY);

    if (input.mouseDown && this.fireTimer <= 0) {
      const weapon = getWeapon(this.weapon);
      this.fireTimer = weaponCooldown(this.weapon, this.rateMultiplier);
      const bullets = fireWeapon(this.weapon, this.x, this.y, this.aimAngle, this.damageMultiplier);
      fireCallback(bullets, weapon);
    }
  }
}
