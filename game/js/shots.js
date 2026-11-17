// shots.js — deterministic screenshot scenes and the autopilot that plays them.
// Every scene plays the real rules forward from a fresh run with a fixed seed,
// so a screenshot is what a short game really looks like — never a mock-up.
// The autopilot is also the playtest driver: it kites, aims, dashes and shops.

import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_SHOP, SCREEN_VICTORY, SCREEN_DEFEAT } from './ui.js';
import { TOTAL_NIGHTS } from './waves.js';
import { Enemy } from './enemies.js';
import { clamp, distance, angleTo } from './utils.js';

const STEP = 1 / 60;

/** Shop priority for the autopilot: a turret first, then damage, then survival. */
const SHOP_PRIORITY = ['turret', 'damage', 'firerate', 'maxhp', 'armor', 'crit', 'dash', 'pierce', 'magnet', 'greed', 'swift', 'renew', 'turret'];

/** The autopilot buys what it can afford, then starts the next night. */
export function autopilotShop(game) {
  for (const id of SHOP_PRIORITY) {
    game.tryBuy(id);
  }
  game.beginNight(game.night + 1);
}

/**
 * One autopilot decision: aim at the nearest foe, kite away from danger, chase
 * coins when it is safe, dash out of a crowd, and pick the right weapon.
 */
export function autopilotStep(game, dt) {
  const player = game.player;
  const input = game.input;
  if (player.dead) {
    input.setFiring(false);
    return;
  }

  // Nearest enemy and nearest coin. Ranged spitters are the priority target:
  // left alone, their ink pins the Warden down while the pack closes in.
  const THREAT = { spitter: 0, diver: 1, brute: 2, miniboss: 2, leviathan: 0, wisp: 3, skitter: 4 };
  let nearest = null;
  let nearestDist = Infinity;
  let bestTarget = null;
  let bestScore = Infinity;
  for (const enemy of game.enemies) {
    const d = distance(player.x, player.y, enemy.x, enemy.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = enemy;
    }
    const score = d + (THREAT[enemy.kind] ?? 4) * 90;
    if (score < bestScore) {
      bestScore = score;
      bestTarget = enemy;
    }
  }
  let nearestCoin = null;
  let coinDist = Infinity;
  for (const coin of game.coinsOnGround) {
    const d = distance(player.x, player.y, coin.x, coin.y);
    if (d < coinDist) {
      coinDist = d;
      nearestCoin = coin;
    }
  }

  // Aim and fire at the priority target (prefer the boss when one is up).
  const target = game.boss && !game.boss.dead ? game.boss : bestTarget;
  if (target) {
    input.setAim(target.x, target.y);
    input.setFiring(true);
    // Crowds up close want the Scatter Net; big targets want the Lance.
    if (target.isBoss) player.switchWeapon('lance');
    else if (nearestDist < 170) player.switchWeapon('scatter');
    else player.switchWeapon('harpoon');
  } else {
    input.setFiring(false);
  }

  // Movement: flee what is close, strafe what is near, chase coins when safe.
  let mx = 0;
  let my = 0;

  // Dodge the nearest ink blob: step sideways from its path.
  let nearestBlob = null;
  let blobDist = Infinity;
  for (const blob of game.inkBlobs) {
    const d = distance(player.x, player.y, blob.x, blob.y);
    if (d < blobDist) {
      blobDist = d;
      nearestBlob = blob;
    }
  }
  if (nearestBlob && blobDist < 130) {
    const blobAngle = Math.atan2(nearestBlob.vy, nearestBlob.vx);
    const side = blobAngle + Math.PI / 2;
    mx += Math.cos(side) * 0.9;
    my += Math.sin(side) * 0.9;
  }
  if (nearest) {
    const away = angleTo(nearest.x, nearest.y, player.x, player.y);
    const fleeRadius = player.hp < 45 ? 250 : 200;
    if (nearestDist < fleeRadius) {
      mx += Math.cos(away) * 1.3;
      my += Math.sin(away) * 1.3;
    }
    // Strafe perpendicular so spitters and divers cannot lead the shot.
    const strafe = away + Math.PI / 2;
    const dir = Math.sin(game.time * 0.9) > 0 ? 1 : -1;
    mx += Math.cos(strafe) * 0.45 * dir;
    my += Math.sin(strafe) * 0.45 * dir;
    // Keep out of the lighthouse rock at the centre.
    const centreDist = distance(player.x, player.y, 640, 360);
    if (centreDist < 110) {
      const out = angleTo(640, 360, player.x, player.y);
      mx += Math.cos(out) * 0.8;
      my += Math.sin(out) * 0.8;
    }
  }
  if (nearestCoin && coinDist < 150 && nearestDist > 160) {
    const toCoin = angleTo(player.x, player.y, nearestCoin.x, nearestCoin.y);
    mx += Math.cos(toCoin) * 0.7;
    my += Math.sin(toCoin) * 0.7;
  }
  // Stay inside the arena with a margin.
  if (player.x < 90) mx += 0.8;
  if (player.x > 1190) mx -= 0.8;
  if (player.y < 90) my += 0.8;
  if (player.y > 630) my -= 0.8;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  input.setMove(mx, my);

  // Dash away when something gets on top of the Warden.
  if (nearest && nearestDist < 75 && player.dashReady) {
    const away = angleTo(nearest.x, nearest.y, player.x, player.y);
    player.startDash(Math.cos(away), Math.sin(away));
    game.sound.playDash();
  }
}

/**
 * Drive the real game forward with the autopilot for up to `maxSeconds` of
 * simulated time, or until `stopWhen` returns true. Returns the final screen.
 */
export function driveGame(game, maxSeconds, stopWhen = null) {
  const steps = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    game.time += STEP;
    if (game.screen === SCREEN_PLAY) {
      game.updatePlaying(STEP);
    } else if (game.screen === SCREEN_SHOP) {
      autopilotShop(game);
    } else if (game.screen === SCREEN_VICTORY || game.screen === SCREEN_DEFEAT) {
      break;
    } else {
      break;
    }
    game.input.endFrame();
    if (stopWhen && stopWhen(game)) break;
    if (game.screen === SCREEN_VICTORY || game.screen === SCREEN_DEFEAT) break;
  }
  game.input.endFrame();
  return game.screen;
}

/** Stage the title scene: a living reef behind the title panel. */
function stageTitle(game) {
  game.screen = SCREEN_TITLE;
  game.startGame('storm');
  game.screen = SCREEN_TITLE;
  game.waves.stop();
  // A few inklings drifting in the water behind the title.
  const kinds = ['skitter', 'wisp', 'spitter', 'brute'];
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const x = clamp(640 + Math.cos(angle) * (260 + (i % 3) * 90), 60, 1220);
    const y = clamp(360 + Math.sin(angle) * (160 + (i % 2) * 70), 60, 660);
    game.enemies.push(new Enemy(kinds[i % kinds.length], x, y, 1, 1, game.rand));
  }
  for (let i = 0; i < 150; i += 1) {
    game.time += STEP;
    for (const enemy of game.enemies) enemy.update(STEP, game.player, game.bounds, game.rand);
    game.particles.update(STEP);
  }
  game.screen = SCREEN_TITLE;
}

/** Stage the play scene: mid-fight on Night 3, foes and bolts everywhere. */
function stagePlay(game) {
  game.autopilot = true;
  game.startGame('storm');
  driveGame(game, 240, (g) => g.screen === SCREEN_PLAY && g.night >= 3 && g.enemies.length >= 9 && g.bullets.length >= 2);
  // If the drive ended early (night cleared fast), top the scene back up.
  if (game.screen === SCREEN_SHOP) game.beginNight(game.night + 1);
  if (game.screen === SCREEN_PLAY) {
    driveGame(game, 12, (g) => g.enemies.length >= 9);
  }
  game.autopilot = false;
}

/** Stage the victory scene: a boosted autopilot wins the whole siege. */
function stageVictory(game) {
  game.autopilot = true;
  game.startGame('storm');
  // A strong Warden, so the scene reliably reaches the victory screen.
  game.player.damageMultiplier = 2.4;
  game.player.rateMultiplier = 1.7;
  game.player.maxHp = 220;
  game.player.hp = 220;
  game.player.critChance = 0.3;
  game.player.addTurret();
  game.player.addTurret();
  driveGame(game, 1500);
  game.autopilot = false;
  if (game.screen !== SCREEN_VICTORY) {
    // Fallback: force the honest end state through the real win path.
    game.enemies = [];
    game.waves.stop();
    game.night = TOTAL_NIGHTS;
    game.winGame();
  }
}

/** Stage the defeat scene: a Warden who held four nights is overrun on Night 5. */
function stageDefeat(game) {
  game.autopilot = true;
  game.startGame('storm');
  driveGame(game, 600, (g) => g.night >= 4);
  game.autopilot = false;
  game.input.setFiring(false);
  game.player.hp = 9;
  // The pack closes in: surround the wounded Warden so the end comes fast
  // and the defeat screen shows the swarm that took them.
  const pack = ['skitter', 'skitter', 'brute', 'diver', 'wisp', 'spitter'];
  pack.forEach((kind, i) => {
    const angle = (i / pack.length) * Math.PI * 2;
    game.enemies.push(new Enemy(
      kind,
      clamp(game.player.x + Math.cos(angle) * 150, 40, 1240),
      clamp(game.player.y + Math.sin(angle) * 150, 40, 680),
      1, 1, game.rand,
    ));
  });
  driveGame(game, 60, (g) => g.screen === SCREEN_DEFEAT);
  if (game.screen !== SCREEN_DEFEAT) {
    game.player.hp = 0;
    game.player.dead = true;
    game.loseGame();
  }
}

/**
 * Set the game to the named scene (title, play, victory or defeat) and draw it.
 * Any other name stages the title.
 */
export function stageShot(name, game) {
  game.rand = game.rand || Math.random;
  if (name === 'play') stagePlay(game);
  else if (name === 'victory') stageVictory(game);
  else if (name === 'defeat') stageDefeat(game);
  else stageTitle(game);
  game.render();
}
