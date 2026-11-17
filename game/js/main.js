// main.js — TIDEWARDEN's heart: the game loop, the state machine (title, play,
// shop, pause, victory, defeat), collisions, coins, combo, the lighthouse beam
// that burns foes, difficulty tuning and the Endless tide. Rendering lives in
// render.js, screens in ui.js, shot staging in shots.js.

import { Input, KEY_MUTE, KEY_PAUSE, KEY_PAUSE_ALT, KEY_RESTART } from './input.js';
import { Player } from './player.js';
import { SoundEngine } from './audio.js';
import { ParticleSystem } from './particles.js';
import { WaveDirector, TOTAL_NIGHTS, NIGHT_NAMES, nightHasMiniBoss } from './waves.js';
import { KIND_LEVIATHAN, KIND_MINIBOSS, Enemy } from './enemies.js';
import { getWeapon, WEAPON_ORDER, Bullet } from './weapons.js';
import { UPGRADES, buyUpgrade } from './upgrades.js';
import { createSeededRandom, clamp, distance, angleTo, angleDifference, formatTime } from './utils.js';
import { ARENA_WIDTH, ARENA_HEIGHT, LIGHTHOUSE, drawBackground, drawEnemy, drawPlayer, drawBullet, drawInkBlob, drawCoin, drawTurret } from './render.js';
import { UiButtons, SCREEN_TITLE, SCREEN_PLAY, SCREEN_SHOP, SCREEN_PAUSE, SCREEN_VICTORY, SCREEN_DEFEAT, drawHud, drawTitle, drawShop, drawPause, drawVictory, drawDefeat } from './ui.js';
import { stageShot, autopilotStep, driveGame } from './shots.js';

/** Difficulty tuning: enemy HP, enemy damage and enemy speed multipliers. */
export const DIFFICULTIES = {
  calm: { label: 'Calm', hp: 0.8, damage: 0.85, speed: 0.95 },
  storm: { label: 'Storm', hp: 1.0, damage: 1.0, speed: 1.0 },
  tempest: { label: 'Tempest', hp: 1.3, damage: 1.2, speed: 1.06 },
};

/** Beam damage per second to foes caught in the lighthouse beam. */
const BEAM_DPS = 34;
const BEAM_RANGE = 340;
const BEAM_HALF_ANGLE = 0.13;

/** Combo window: kills closer than this apart keep the multiplier alive. */
const COMBO_WINDOW = 3;

/** A coin pickup drifting in the water, waiting to be collected. */
class Coin {
  constructor(x, y, value, rand) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.phase = rand() * Math.PI * 2;
    this.vx = (rand() - 0.5) * 60;
    this.vy = (rand() - 0.5) * 60;
    this.life = 14;
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.92;
    this.vy *= 0.92;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
}

/** The whole game: state, entities, economy, beam, loop and screens. */
export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bounds = { width: ARENA_WIDTH, height: ARENA_HEIGHT };
    this.input = new Input(canvas);
    this.sound = new SoundEngine();
    this.particles = new ParticleSystem();
    this.buttons = new UiButtons();
    this.rand = Math.random;
    this.player = new Player(640, 500);
    this.waves = new WaveDirector(this);
    this.enemies = [];
    this.bullets = [];
    this.inkBlobs = [];
    this.coinsOnGround = [];
    this.screen = SCREEN_TITLE;
    this.difficulty = 'storm';
    this.endless = false;
    this.night = 0;
    this.score = 0;
    this.coins = 0;
    this.coinsEarned = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.beamKills = 0;
    this.beamOn = true;
    this.beamAngle = 0;
    this.boss = null;
    this.time = 0;
    this.runTime = 0;
    this.bannerTitle = '';
    this.bannerSub = '';
    this.bannerTimer = 0;
    this.shake = 0;
    this.autopilot = false;
    this.bestScore = 0;
    this.bestNight = 0;
    this._loadBest();
    this._lastTimestamp = 0;
    this._raf = 0;
  }

  /** Difficulty label for screens ("Storm"). */
  get difficultyLabel() {
    return DIFFICULTIES[this.difficulty].label;
  }

  /** Enemies currently alive (for the HUD). */
  get enemiesAlive() {
    return this.enemies.length;
  }

  /** Run time as M:SS for the victory screen. */
  get runTimeText() {
    return formatTime(this.runTime);
  }

  /** Read the saved best score from localStorage (best-effort). */
  _loadBest() {
    try {
      this.bestScore = Number(window.localStorage.getItem('tidewarden-best-score') || 0) || 0;
      this.bestNight = Number(window.localStorage.getItem('tidewarden-best-night') || 0) || 0;
    } catch (error) {
      this.bestScore = 0;
      this.bestNight = 0;
    }
  }

  /** Save a new best score (best-effort). */
  _saveBest() {
    try {
      if (this.score > this.bestScore) {
        window.localStorage.setItem('tidewarden-best-score', String(Math.floor(this.score)));
        this.bestScore = Math.floor(this.score);
      }
      if (this.night > this.bestNight) {
        window.localStorage.setItem('tidewarden-best-night', String(this.night));
        this.bestNight = this.night;
      }
    } catch (error) {
      /* storage unavailable — the run still counts */
    }
  }

  /** Start a fresh run on the chosen difficulty. */
  startGame(difficulty = 'storm') {
    this.difficulty = difficulty;
    this.endless = false;
    this.player.reset(640, 500);
    this.enemies = [];
    this.bullets = [];
    this.inkBlobs = [];
    this.coinsOnGround = [];
    this.particles.clear();
    this.night = 0;
    this.score = 0;
    this.coins = 0;
    this.coinsEarned = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.beamKills = 0;
    this.runTime = 0;
    this.boss = null;
    this.shake = 0;
    this.sound.unlock();
    this.sound.startMusic();
    this.beginNight(1);
  }

  /** Restart from the title or an end screen: a fresh run, same difficulty. */
  restartGame() {
    this.startGame(this.difficulty);
  }

  /** Begin a night: heal the Dawn Renewal, spawn the wave, show the banner. */
  beginNight(night) {
    this.night = night;
    if (this.player.nightHeal > 0) this.player.heal(this.player.nightHeal);
    this.waves.startNight(night);
    this.screen = SCREEN_PLAY;
    const name = NIGHT_NAMES[Math.min(night - 1, TOTAL_NIGHTS - 1)];
    const label = this.endless ? `ENDLESS NIGHT ${night}` : `NIGHT ${night} — ${name.toUpperCase()}`;
    const sub = night === TOTAL_NIGHTS
      ? 'The Tide Leviathan wakes. Slay it and the reef is saved.'
      : nightHasMiniBoss(night)
        ? 'Something huge stirs in the deep… a Reef Tyrant approaches.'
        : `${this.waves.queue.length} foes ride the tide. Hold the light.`;
    this.showBanner(label, sub);
    this.sound.playHorn();
  }

  /** Show the big centre banner for a few seconds. */
  showBanner(title, sub = '') {
    this.bannerTitle = title;
    this.bannerSub = sub;
    this.bannerTimer = 3.2;
  }

  /** The WaveDirector reports a mini-boss: roar, banner, shake. */
  onMiniBossSpawned(boss) {
    this.boss = boss;
    this.showBanner('REEF TYRANT', 'A mini-boss joins the night — burn it down!');
    this.sound.playRoar();
    this.shake = Math.max(this.shake, 6);
  }

  /** The WaveDirector reports the Leviathan: roar, banner, big shake. */
  onBossSpawned(boss) {
    this.boss = boss;
    this.showBanner('THE TIDE LEVIATHAN', 'Three phases. No mercy. Slay it and win.');
    this.sound.playRoar();
    this.shake = Math.max(this.shake, 10);
  }

  /** Add a screen shake of the given strength. */
  addShake(amount) {
    this.shake = Math.min(14, this.shake + amount);
  }

  /** Difficulty multipliers for enemy HP / damage / speed. */
  difficultyMultipliers() {
    return DIFFICULTIES[this.difficulty] || DIFFICULTIES.storm;
  }

  /**
   * Kill an enemy: score with the combo multiplier, coins on the water,
   * particles, sound, and the boss / night-clear consequences.
   */
  killEnemy(enemy, source = 'shot') {
    enemy.dead = true;
    this.kills += 1;
    this.combo += 1;
    this.comboTimer = COMBO_WINDOW;
    const multiplier = Math.min(2, 1 + this.combo * 0.05);
    const gained = Math.round(enemy.score * multiplier);
    this.score += gained;
    if (source === 'beam') this.beamKills += 1;
    const coinValue = Math.max(1, Math.round(enemy.coins * (this.player.coinMultiplier || 1)));
    this._dropCoins(enemy.x, enemy.y, coinValue);
    this.particles.spawnExplosion(enemy.x, enemy.y, enemy.color, enemy.isBoss);
    this.particles.spawnDamageNumber(enemy.x, enemy.y - enemy.radius, gained, enemy.isBoss);
    if (this.combo >= 5) this.particles.spawnLabel(enemy.x, enemy.y - 34, `COMBO x${this.combo}`, '#ff9a3d', 16);
    this.sound.playPop();
    if (enemy.isBoss) {
      this.addShake(12);
      this.showBanner(`${enemy.name} SLAIN`, `+${gained} points — the reef breathes again.`);
      if (enemy.kind === KIND_LEVIATHAN) this.boss = null;
      else this.boss = null;
    } else {
      this.addShake(1.5);
    }
  }

  /** Scatter coin pickups worth `total` around a kill. */
  _dropCoins(x, y, total) {
    const pieces = total >= 6 ? 3 : total >= 3 ? 2 : 1;
    const per = Math.max(1, Math.floor(total / pieces));
    for (let i = 0; i < pieces; i += 1) {
      this.coinsOnGround.push(new Coin(
        clamp(x + (this.rand() - 0.5) * 40, 20, this.bounds.width - 20),
        clamp(y + (this.rand() - 0.5) * 40, 20, this.bounds.height - 20),
        per, this.rand,
      ));
    }
  }

  /** Collect a coin: coins, score tick, chime and sparkle. */
  collectCoin(coin) {
    coin.dead = true;
    this.coins += coin.value;
    this.coinsEarned += coin.value;
    this.score += coin.value * 2;
    this.particles.spawnCoinPickup(coin.x, coin.y);
    this.sound.playCoin(this.combo);
  }

  /** The lighthouse beam: foes inside the sweeping cone burn and slow. */
  updateBeam(dt) {
    this.beamAngle = this.time * 0.45;
    const lampX = LIGHTHOUSE.x;
    const lampY = LIGHTHOUSE.y - 63;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const dist = distance(lampX, lampY, enemy.x, enemy.y);
      if (dist > BEAM_RANGE || dist < 40) continue;
      const angle = angleTo(lampX, lampY, enemy.x, enemy.y);
      const diff = Math.abs(angleDifference(this.beamAngle, angle));
      if (diff > BEAM_HALF_ANGLE) continue;
      const burned = enemy.takeDamage(BEAM_DPS * dt);
      if (Math.random() < dt * 8) this.particles.spawnEmberTrail(enemy.x, enemy.y);
      if (burned && enemy.dead) this.killEnemy(enemy, 'beam');
    }
  }

  /** Move bullets, resolve bullet hits, and step ink blobs. */
  updateProjectiles(dt) {
    const diff = this.difficultyMultipliers();
    for (const bullet of this.bullets) {
      if (bullet.dead) continue;
      bullet.update(dt, this.bounds);
      if (bullet.isLance && Math.random() < 0.5) {
        this.particles.spawnEmberTrail(bullet.x, bullet.y);
      }
      for (const enemy of this.enemies) {
        if (enemy.dead || bullet.hitIds.has(enemy.id)) continue;
        const rr = enemy.radius + bullet.size;
        const dx = enemy.x - bullet.x;
        const dy = enemy.y - bullet.y;
        if (dx * dx + dy * dy > rr * rr) continue;
        bullet.hitIds.add(enemy.id);
        const critical = this.rand() < (this.player.critChance || 0);
        const damage = bullet.damage * (critical ? 2 : 1);
        const died = enemy.takeDamage(damage);
        this.particles.spawnHitSparks(bullet.x, bullet.y, bullet.color);
        this.particles.spawnDamageNumber(enemy.x, enemy.y - enemy.radius, damage, critical);
        this.sound.playHit(enemy.isBoss || critical);
        if (died) {
          this.killEnemy(enemy, 'shot');
        } else if (bullet.pierce > 0) {
          bullet.pierce -= 1;
        } else {
          bullet.dead = true;
        }
        if (bullet.dead) break;
      }
    }
    this.bullets = this.bullets.filter((bullet) => !bullet.dead);

    for (const blob of this.inkBlobs) {
      if (blob.dead) continue;
      blob.update(dt, this.bounds);
      const rr = blob.radius + this.player.radius;
      const dx = this.player.x - blob.x;
      const dy = this.player.y - blob.y;
      if (!this.player.dead && dx * dx + dy * dy < rr * rr) {
        blob.dead = true;
        const dealt = this.player.takeDamage(blob.damage * diff.damage);
        if (dealt > 0) {
          this.sound.playHurt();
          this.addShake(5);
          this.particles.spawnSplash(this.player.x, this.player.y, '#ff8a8a');
          if (this.player.dead) this.loseGame();
        }
      }
    }
    this.inkBlobs = this.inkBlobs.filter((blob) => !blob.dead);
  }

  /** Step every enemy, its touch damage, and the Leviathan's summons. */
  updateEnemies(dt) {
    const diff = this.difficultyMultipliers();
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const shots = enemy.update(dt, this.player, this.bounds, this.rand);
      for (const shot of shots) this.inkBlobs.push(shot);
      if (enemy.consumeSummonRequest()) {
        for (let i = 0; i < 3; i += 1) {
          const angle = this.rand() * Math.PI * 2;
          const skitter = new Enemy(
            'skitter',
            clamp(enemy.x + Math.cos(angle) * 70, 30, this.bounds.width - 30),
            clamp(enemy.y + Math.sin(angle) * 70, 30, this.bounds.height - 30),
            1, 1, this.rand,
          );
          this.enemies.push(skitter);
          this.particles.spawnSplash(skitter.x, skitter.y);
        }
        this.showBanner('THE LEVIATHAN CALLS', 'Skitters swarm from the deep!');
      }
      const rr = enemy.radius + this.player.radius - 4;
      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      if (!this.player.dead && dx * dx + dy * dy < rr * rr) {
        const dealt = this.player.takeDamage(enemy.damage * diff.damage);
        if (dealt > 0) {
          this.sound.playHurt();
          this.addShake(6);
          this.particles.spawnSplash(this.player.x, this.player.y, '#ff8a8a');
          if (this.player.dead) this.loseGame();
        }
      }
    }
    this.enemies = this.enemies.filter((enemy) => !enemy.dead);
    if (this.boss && this.boss.dead) this.boss = null;
  }

  /** Step coins: drift, magnet toward the player, collect on touch. */
  updateCoins(dt) {
    for (const coin of this.coinsOnGround) {
      if (coin.dead) continue;
      coin.update(dt);
      const dist = distance(coin.x, coin.y, this.player.x, this.player.y);
      if (dist < this.player.magnetRadius) {
        const angle = angleTo(coin.x, coin.y, this.player.x, this.player.y);
        const pull = 420 * (1 - dist / this.player.magnetRadius) + 120;
        coin.x += Math.cos(angle) * pull * dt;
        coin.y += Math.sin(angle) * pull * dt;
      }
      if (dist < 26) this.collectCoin(coin);
    }
    this.coinsOnGround = this.coinsOnGround.filter((coin) => !coin.dead);
  }

  /** One step of live play. */
  updatePlaying(dt) {
    this.runTime += dt;
    this.bannerTimer = Math.max(0, this.bannerTimer - dt);
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = 0;
    if (this.autopilot) autopilotStep(this, dt);

    // Weapon switching (1 / 2 / 3).
    for (const id of WEAPON_ORDER) {
      const weapon = getWeapon(id);
      if (this.input.wasPressed(`Digit${weapon.key}`)) {
        if (this.player.switchWeapon(id)) this.sound.playShoot();
      }
    }
    if (this.input.wasPressed(KEY_MUTE)) this.sound.toggleMute();

    this.player.update(dt, this.input, this.bounds, (bullets, weapon) => {
      for (const bullet of bullets) {
        bullet.pierce += this.player.bonusPierce || 0;
        this.bullets.push(bullet);
      }
      if (weapon.id === 'scatter') this.sound.playScatter();
      else if (weapon.id === 'lance') this.sound.playLance();
      else this.sound.playShoot();
    }, () => {
      this.sound.playDash();
      this.particles.spawnDashGhost(this.player.x, this.player.y);
    });

    for (const turret of this.player.turrets) {
      turret.update(dt, this.enemies, (x, y, angle, damage) => {
        const weapon = getWeapon('harpoon');
        const bolt = new Bullet(x, y, angle, weapon, damage);
        this.bullets.push(bolt);
      });
    }

    this.waves.update(dt);
    this.updateBeam(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateCoins(dt);
    this.particles.update(dt);
    this.shake = Math.max(0, this.shake - dt * 26);

    if (this.player.dead) return;
    if (this.waves.isNightClear()) {
      this.waves.stop();
      if (this.night >= TOTAL_NIGHTS && !this.endless) {
        this.winGame();
      } else if (this.endless) {
        this.sound.playWaveClear();
        this.beginNight(this.night + 1);
      } else {
        this.sound.playWaveClear();
        // The reef mends the Warden between nights: a small heal, every night.
        this.player.heal(30);
        this.screen = SCREEN_SHOP;
      }
    }
  }

  /** The siege is won: victory screen, fanfare, best score. */
  winGame() {
    this.screen = SCREEN_VICTORY;
    this._saveBest();
    this.sound.playVictory();
    this.particles.clear();
    this.particles.spawnExplosion(640, 360, '#ffd34d', true);
  }

  /** The Warden falls: defeat screen, low fanfare, best score. */
  loseGame() {
    this.screen = SCREEN_DEFEAT;
    this.waves.stop();
    this._saveBest();
    this.sound.playDefeat();
    this.particles.clear();
    this.particles.spawnExplosion(this.player.x, this.player.y, '#ff5c5c', true);
  }

  /** Continue after victory: the tide never ends, and neither does the score. */
  startEndless() {
    this.endless = true;
    this.beginNight(TOTAL_NIGHTS + 1);
  }

  /** Try to buy an upgrade in the shop; returns the result for feedback. */
  tryBuy(upgradeId) {
    const result = buyUpgrade(this.player, upgradeId, this.coins);
    if (result.ok) {
      this.coins -= result.price;
      this.sound.playBuy();
      this.particles.spawnCoinBurst(640, 360, 6);
    } else {
      this.sound.playDenied();
    }
    return result;
  }

  /** Handle a click on the current screen's buttons. */
  handleClick(x, y) {
    const id = this.buttons.hit(x, y);
    if (!id) return false;
    if (id === 'start') {
      this.startGame(this.difficulty);
      return true;
    }
    if (id.startsWith('difficulty-')) {
      this.difficulty = id.slice('difficulty-'.length);
      this.sound.unlock();
      return true;
    }
    if (id.startsWith('buy-')) {
      this.tryBuy(id.slice(4));
      return true;
    }
    if (id === 'next-night') {
      this.beginNight(this.night + 1);
      return true;
    }
    if (id === 'resume') {
      this.screen = SCREEN_PLAY;
      return true;
    }
    if (id === 'restart') {
      this.restartGame();
      return true;
    }
    if (id === 'quit-title') {
      this.screen = SCREEN_TITLE;
      this.waves.stop();
      return true;
    }
    if (id === 'endless') {
      this.startEndless();
      return true;
    }
    return false;
  }

  /** Handle a key press that is not movement or firing. */
  handleKey(code) {
    if (code === KEY_MUTE) {
      this.sound.toggleMute();
      return;
    }
    if (this.screen === SCREEN_TITLE) {
      if (code === 'Enter' || code === 'Space') this.startGame(this.difficulty);
      return;
    }
    if (this.screen === SCREEN_PLAY) {
      if (code === KEY_PAUSE || code === KEY_PAUSE_ALT) this.screen = SCREEN_PAUSE;
      return;
    }
    if (this.screen === SCREEN_PAUSE) {
      if (code === KEY_PAUSE || code === KEY_PAUSE_ALT) this.screen = SCREEN_PLAY;
      else if (code === KEY_RESTART) this.restartGame();
      return;
    }
    if (this.screen === SCREEN_SHOP) {
      if (code === 'Enter') {
        this.beginNight(this.night + 1);
        return;
      }
      for (const upgrade of UPGRADES) {
        const keyCode = upgrade.key === '0' ? 'Digit0' : upgrade.key === 'Q' ? 'KeyQ' : upgrade.key === 'E' ? 'KeyE' : `Digit${upgrade.key}`;
        if (code === keyCode) this.tryBuy(upgrade.id);
      }
      return;
    }
    if (this.screen === SCREEN_VICTORY) {
      if (code === KEY_RESTART) this.restartGame();
      else if (code === 'Enter') this.startEndless();
      return;
    }
    if (this.screen === SCREEN_DEFEAT) {
      if (code === KEY_RESTART || code === 'Enter' || code === 'Space') this.restartGame();
    }
  }

  /** One frame: advance the active state, then draw it. */
  frame(timestamp) {
    const dt = Math.min(0.05, this._lastTimestamp ? (timestamp - this._lastTimestamp) / 1000 : 1 / 60);
    this._lastTimestamp = timestamp;
    this.time += dt;

    if (this.input.clicked) {
      this.sound.unlock();
      this.handleClick(this.input.clickX, this.input.clickY);
    }
    for (const code of this.input.pressedKeys) this.handleKey(code);

    if (this.screen === SCREEN_PLAY) this.updatePlaying(dt);
    else if (this.screen === SCREEN_TITLE) {
      this.particles.update(dt);
      if (Math.random() < dt * 0.5) this.particles.spawnEmberTrail(640 + (Math.random() - 0.5) * 200, 300 + Math.random() * 60);
    } else if (this.screen === SCREEN_SHOP || this.screen === SCREEN_PAUSE || this.screen === SCREEN_VICTORY || this.screen === SCREEN_DEFEAT) {
      this.particles.update(dt);
    }
    this.bannerTimer = Math.max(0, this.bannerTimer - (this.screen === SCREEN_PLAY ? 0 : dt));

    this.render();
    this.input.endFrame();
  }

  /** Draw the whole scene for the current screen. */
  render() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    drawBackground(ctx, this.time, this.bounds.width, this.bounds.height);

    // The beam's visible cone on the water (drawn under the entities).
    if (this.screen === SCREEN_PLAY || this.screen === SCREEN_SHOP) {
      const lampX = LIGHTHOUSE.x;
      const lampY = LIGHTHOUSE.y - 63;
      ctx.save();
      ctx.translate(lampX, lampY);
      ctx.rotate(this.beamAngle);
      const beam = ctx.createLinearGradient(0, 0, BEAM_RANGE, 0);
      beam.addColorStop(0, 'rgba(255, 230, 150, 0.34)');
      beam.addColorStop(1, 'rgba(255, 230, 150, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(BEAM_RANGE, -BEAM_RANGE * Math.tan(BEAM_HALF_ANGLE) - 14);
      ctx.lineTo(BEAM_RANGE, BEAM_RANGE * Math.tan(BEAM_HALF_ANGLE) + 14);
      ctx.lineTo(0, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    for (const coin of this.coinsOnGround) drawCoin(ctx, coin, this.time);
    for (const turret of this.player.turrets) drawTurret(ctx, turret, this.time);
    for (const enemy of this.enemies) drawEnemy(ctx, enemy, this.time);
    for (const blob of this.inkBlobs) drawInkBlob(ctx, blob);
    for (const bullet of this.bullets) drawBullet(ctx, bullet);
    if (this.screen !== SCREEN_TITLE) {
      drawPlayer(ctx, { ...this.player, aimX: this.input.mouseX, aimY: this.input.mouseY }, this.time);
    }
    this.particles.draw(ctx);
    ctx.restore();

    if (this.screen === SCREEN_PLAY) drawHud(ctx, this);
    else if (this.screen === SCREEN_TITLE) drawTitle(ctx, this, this.buttons);
    else if (this.screen === SCREEN_SHOP) drawShop(ctx, this, this.buttons);
    else if (this.screen === SCREEN_PAUSE) {
      drawHud(ctx, this);
      drawPause(ctx, this, this.buttons);
    } else if (this.screen === SCREEN_VICTORY) drawVictory(ctx, this, this.buttons);
    else if (this.screen === SCREEN_DEFEAT) drawDefeat(ctx, this, this.buttons);
  }

  /** Start the requestAnimationFrame loop. */
  run() {
    const loop = (timestamp) => {
      this.frame(timestamp);
      this._raf = window.requestAnimationFrame(loop);
    };
    this._raf = window.requestAnimationFrame(loop);
  }
}

/** Boot the game: normal play, or a deterministic screenshot scene. */
export function bootGame() {
  const canvas = document.getElementById('game');
  const params = new URLSearchParams(window.location.search);
  const game = new Game(canvas);
  const shot = params.get('shot');
  const seed = Number(params.get('seed') || 7);
  const test = params.get('test');

  if (shot) {
    game.rand = createSeededRandom(seed);
    stageShot(shot, game);
    game.render();
    window.__shotReady = true;
    window.TIDEWARDEN = game;
    return game;
  }

  if (test === 'win' || test === 'lose') {
    game.rand = createSeededRandom(seed);
    game.autopilot = test === 'win';
    game.startGame('storm');
    if (test === 'lose') game.player.hp = 12;
    window.TIDEWARDEN = game;
    window.__testMode = test;
    // The harness drives the real rules forward in big simulated chunks.
    window.__driveGame = (maxSeconds) => driveGame(game, maxSeconds);
    window.__gameState = () => ({
      screen: game.screen,
      night: game.night,
      score: Math.floor(game.score),
      kills: game.kills,
      hp: Math.ceil(game.player.hp),
      coins: game.coins,
      enemies: game.enemies.length,
    });
    game.render();
    return game;
  }

  window.TIDEWARDEN = game;
  game.run();
  return game;
}

bootGame();
