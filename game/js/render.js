// render.js — everything the eye sees in the arena: the dusk sky, the teal sea,
// the reef rocks, the lighthouse at the centre, and every creature, bullet and
// turret drawn as clean vector shapes — no image assets anywhere.

import { clamp } from './utils.js';
import { KIND_BRUTE, KIND_DIVER, KIND_LEVIATHAN, KIND_MINIBOSS, KIND_SPITTER, KIND_WISP } from './enemies.js';

/** Arena size in logical pixels (the canvas is 1280x720). */
export const ARENA_WIDTH = 1280;
export const ARENA_HEIGHT = 720;

/** The lighthouse stands at the arena centre; it is the landmark of the game. */
export const LIGHTHOUSE = { x: 640, y: 360 };

/** Reef rocks scattered around the arena (fixed, deterministic positions). */
export const REEF_ROCKS = [
  { x: 120, y: 110, r: 42 }, { x: 260, y: 620, r: 36 }, { x: 1140, y: 130, r: 46 },
  { x: 1090, y: 600, r: 38 }, { x: 420, y: 90, r: 26 }, { x: 880, y: 640, r: 30 },
  { x: 90, y: 400, r: 28 }, { x: 1190, y: 380, r: 30 }, { x: 560, y: 640, r: 22 },
  { x: 760, y: 80, r: 24 },
];

/** Draw the sky, sun, sea, sand rim, reef rocks and the lighthouse. */
export function drawBackground(ctx, time, width, height) {
  // Dusk sky: warm orange at the horizon, teal above.
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#2a7d8c');
  sky.addColorStop(0.45, '#4fa8a0');
  sky.addColorStop(0.72, '#f2a65a');
  sky.addColorStop(1, '#f27d42');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Low sun, half-sunk, with a glow.
  const sunX = 1050;
  const sunY = 118;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 180);
  glow.addColorStop(0, 'rgba(255, 214, 130, 0.9)');
  glow.addColorStop(0.5, 'rgba(255, 170, 90, 0.35)');
  glow.addColorStop(1, 'rgba(255, 170, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 180, sunY - 180, 360, 360);
  ctx.fillStyle = '#ffd98a';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 44, 0, Math.PI * 2);
  ctx.fill();

  // The sea: a bright teal sheet with animated swell lines.
  const sea = ctx.createLinearGradient(0, 150, 0, height);
  sea.addColorStop(0, '#3fa8a8');
  sea.addColorStop(0.5, '#2b8a96');
  sea.addColorStop(1, '#1e6f80');
  ctx.fillStyle = sea;
  ctx.fillRect(0, 150, width, height - 150);

  // Sun glitter on the water.
  ctx.strokeStyle = 'rgba(255, 220, 140, 0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i += 1) {
    const y = 210 + i * 62;
    const w = 60 + i * 26 + Math.sin(time * 1.4 + i * 1.7) * 18;
    ctx.beginPath();
    ctx.moveTo(sunX - w / 2, y);
    ctx.lineTo(sunX + w / 2, y);
    ctx.stroke();
  }

  // Rolling wave lines, drifting slowly across the sea.
  ctx.strokeStyle = 'rgba(220, 250, 250, 0.28)';
  ctx.lineWidth = 3;
  for (let row = 0; row < 5; row += 1) {
    const y = 250 + row * 96;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 32) {
      const waveY = y + Math.sin(x * 0.012 + time * 1.1 + row * 2.1) * 9;
      if (x === 0) ctx.moveTo(x, waveY);
      else ctx.lineTo(x, waveY);
    }
    ctx.stroke();
  }

  // Sandy rim at the bottom of the frame.
  ctx.fillStyle = '#e8c98a';
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, height - 26);
  for (let x = 0; x <= width; x += 80) {
    ctx.lineTo(x, height - 26 + Math.sin(x * 0.02 + 1.3) * 7);
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  // Reef rocks with coral tips.
  for (const rock of REEF_ROCKS) {
    ctx.fillStyle = '#5d4a6b';
    ctx.beginPath();
    ctx.arc(rock.x, rock.y, rock.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5f8a';
    ctx.beginPath();
    ctx.arc(rock.x - rock.r * 0.25, rock.y - rock.r * 0.3, rock.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff8a7a';
    ctx.beginPath();
    ctx.arc(rock.x + rock.r * 0.4, rock.y - rock.r * 0.55, 6, 0, Math.PI * 2);
    ctx.arc(rock.x - rock.r * 0.5, rock.y - rock.r * 0.2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.arc(rock.x + rock.r * 0.1, rock.y - rock.r * 0.6, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawLighthouse(ctx, time);
}

/** The Ember Reef lighthouse: striped tower, glowing lamp, rotating beam. */
export function drawLighthouse(ctx, time) {
  const { x, y } = LIGHTHOUSE;
  // Soft light pool on the water around the reef.
  const pool = ctx.createRadialGradient(x, y, 10, x, y, 150);
  pool.addColorStop(0, 'rgba(255, 214, 130, 0.28)');
  pool.addColorStop(1, 'rgba(255, 214, 130, 0)');
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.arc(x, y, 150, 0, Math.PI * 2);
  ctx.fill();

  // Rotating beam, sweeping the sea.
  const beamAngle = time * 0.45;
  ctx.save();
  ctx.translate(x, y - 52);
  ctx.rotate(beamAngle);
  const beam = ctx.createLinearGradient(0, 0, 320, 0);
  beam.addColorStop(0, 'rgba(255, 230, 150, 0.5)');
  beam.addColorStop(1, 'rgba(255, 230, 150, 0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(320, -44);
  ctx.lineTo(320, 44);
  ctx.lineTo(0, 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Rock base.
  ctx.fillStyle = '#4a3a58';
  ctx.beginPath();
  ctx.ellipse(x, y + 34, 62, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  // Striped tower.
  ctx.fillStyle = '#f5efe0';
  ctx.fillRect(x - 20, y - 52, 40, 84);
  ctx.fillStyle = '#e8542f';
  ctx.fillRect(x - 20, y - 30, 40, 18);
  ctx.fillRect(x - 20, y + 6, 40, 18);
  ctx.strokeStyle = '#7a3a22';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 20, y - 52, 40, 84);
  // Lamp room and cap.
  ctx.fillStyle = '#2b2b3a';
  ctx.fillRect(x - 16, y - 74, 32, 22);
  const lampGlow = ctx.createRadialGradient(x, y - 63, 2, x, y - 63, 34);
  lampGlow.addColorStop(0, 'rgba(255, 240, 170, 0.95)');
  lampGlow.addColorStop(1, 'rgba(255, 240, 170, 0)');
  ctx.fillStyle = lampGlow;
  ctx.beginPath();
  ctx.arc(x, y - 63, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.arc(x, y - 63, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8542f';
  ctx.beginPath();
  ctx.moveTo(x - 20, y - 74);
  ctx.lineTo(x, y - 92);
  ctx.lineTo(x + 20, y - 74);
  ctx.closePath();
  ctx.fill();
}

/** Draw one enemy as a readable vector creature, flashing white when hit. */
export function drawEnemy(ctx, enemy, time) {
  const { x, y, radius } = enemy;
  const flash = enemy.flash > 0;
  const body = flash ? '#ffffff' : enemy.color;
  const dark = flash ? '#e8e8e8' : enemy.dark;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(enemy.angle);

  if (enemy.kind === KIND_LEVIATHAN) {
    // The Leviathan: a huge ink serpent head with horns and a glowing eye.
    const phaseColor = enemy.phase === 3 ? '#ff5c5c' : enemy.phase === 2 ? '#c9a7ff' : '#3d6bff';
    ctx.fillStyle = flash ? '#ffffff' : phaseColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius + 14, radius * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.5, -radius * 0.6);
    ctx.lineTo(-radius * 0.9, -radius * 1.25);
    ctx.lineTo(-radius * 0.15, -radius * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-radius * 0.5, radius * 0.6);
    ctx.lineTo(-radius * 0.9, radius * 1.25);
    ctx.lineTo(-radius * 0.15, radius * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.arc(radius * 0.45, -radius * 0.22, 9, 0, Math.PI * 2);
    ctx.arc(radius * 0.45, radius * 0.22, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10203a';
    ctx.beginPath();
    ctx.arc(radius * 0.45, -radius * 0.22, 4, 0, Math.PI * 2);
    ctx.arc(radius * 0.45, radius * 0.22, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(radius * 0.8, -10);
    ctx.lineTo(radius * 1.05, 0);
    ctx.lineTo(radius * 0.8, 10);
    ctx.stroke();
  } else if (enemy.kind === KIND_MINIBOSS) {
    // Reef Tyrant: a spiked crab with heavy claws.
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dark;
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + time * 0.2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * radius * 0.8, Math.sin(a) * radius * 0.8);
      ctx.lineTo(Math.cos(a) * radius * 1.35, Math.sin(a) * radius * 1.35);
      ctx.lineTo(Math.cos(a + 0.25) * radius * 0.8, Math.sin(a + 0.25) * radius * 0.8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(radius * 0.4, -radius * 0.3, 7, 0, Math.PI * 2);
    ctx.arc(radius * 0.4, radius * 0.3, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10203a';
    ctx.beginPath();
    ctx.arc(radius * 0.42, -radius * 0.3, 3.5, 0, Math.PI * 2);
    ctx.arc(radius * 0.42, radius * 0.3, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === KIND_BRUTE) {
    // Brute: a big armoured blob with a shell.
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(-4, -4, radius * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(radius * 0.42, -radius * 0.28, 5, 0, Math.PI * 2);
    ctx.arc(radius * 0.42, radius * 0.28, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === KIND_DIVER) {
    // Diver: a dart-shaped fish; it flashes before it charges.
    const telegraph = enemy.state === 'telegraph';
    ctx.fillStyle = telegraph && Math.floor(time * 12) % 2 === 0 ? '#ffffff' : body;
    ctx.beginPath();
    ctx.moveTo(radius * 1.3, 0);
    ctx.lineTo(-radius * 0.8, -radius * 0.75);
    ctx.lineTo(-radius * 0.4, 0);
    ctx.lineTo(-radius * 0.8, radius * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#10203a';
    ctx.beginPath();
    ctx.arc(radius * 0.5, -radius * 0.2, 3.5, 0, Math.PI * 2);
    ctx.arc(radius * 0.5, radius * 0.2, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === KIND_SPITTER) {
    // Spitter: a round sac with a wide ink mouth.
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(radius * 0.55, 0, radius * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10203a';
    ctx.beginPath();
    ctx.arc(radius * 0.55, 0, radius * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-radius * 0.2, -radius * 0.35, 4, 0, Math.PI * 2);
    ctx.arc(-radius * 0.2, radius * 0.35, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === KIND_WISP) {
    // Wisp: a glowing ember mote with a flickering tail.
    const flicker = 0.75 + Math.sin(time * 9 + enemy.wobble) * 0.25;
    ctx.globalAlpha = flicker;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    // Skitter: a small crab with scuttling legs.
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2.5;
    const legSwing = Math.sin(time * 14 + enemy.wobble) * 5;
    for (const side of [-1, 1]) {
      for (let leg = -1; leg <= 1; leg += 1) {
        ctx.beginPath();
        ctx.moveTo(leg * 6, side * radius * 0.7);
        ctx.lineTo(leg * 8 + legSwing, side * (radius + 7));
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#10203a';
    ctx.beginPath();
    ctx.arc(radius * 0.45, -radius * 0.3, 3, 0, Math.PI * 2);
    ctx.arc(radius * 0.45, radius * 0.3, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Health bar for anything hurt (bosses always show one).
  if (enemy.hp < enemy.maxHp) {
    const w = Math.max(28, radius * 1.8);
    const frac = clamp(enemy.hp / enemy.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(8, 30, 36, 0.7)';
    ctx.fillRect(x - w / 2, y - radius - 14, w, 5);
    ctx.fillStyle = frac > 0.5 ? '#7fe3a8' : frac > 0.25 ? '#ffd34d' : '#ff5c5c';
    ctx.fillRect(x - w / 2, y - radius - 14, w * frac, 5);
  }
}

/** Draw the Warden: a hooded keeper with a lantern and the aimed weapon. */
export function drawPlayer(ctx, player, time) {
  const { x, y } = player;
  const bob = player.moving ? Math.sin(player.walkCycle) * 2 : Math.sin(time * 2) * 1.2;

  // A golden ring on the water marks the Warden, so the eye finds them instantly.
  ctx.strokeStyle = 'rgba(255, 211, 77, 0.85)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(x, y + player.radius * 0.9, player.radius + 6, (player.radius + 6) * 0.45, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.translate(x, y + bob * 0.4);

  // Dash afterimage ring while dashing.
  if (player.dashTime > 0) {
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#7fe3d8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Invulnerability shimmer.
  if (player.invulnerable > 0 && Math.floor(time * 16) % 2 === 0) ctx.globalAlpha = 0.55;

  // Cloak.
  ctx.fillStyle = player.hurtFlash > 0 ? '#ff8a8a' : '#2e6f8e';
  ctx.beginPath();
  ctx.moveTo(0, -player.radius - 4);
  ctx.quadraticCurveTo(player.radius + 6, 0, 0, player.radius + 4);
  ctx.quadraticCurveTo(-player.radius - 6, 0, 0, -player.radius - 4);
  ctx.fill();
  // Hood and face.
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath();
  ctx.arc(0, -4, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#10203a';
  ctx.beginPath();
  ctx.arc(2, -4, 4.5, 0, Math.PI * 2);
  ctx.fill();
  // Lantern glow in hand.
  const lamp = ctx.createRadialGradient(-14, 8, 1, -14, 8, 18);
  lamp.addColorStop(0, 'rgba(255, 220, 120, 0.9)');
  lamp.addColorStop(1, 'rgba(255, 220, 120, 0)');
  ctx.fillStyle = lamp;
  ctx.beginPath();
  ctx.arc(-14, 8, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.arc(-14, 8, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Weapon barrel pointing at the aim.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(player.aimAngle);
  const weaponColor = player.weapon === 'lance' ? '#ff9a3d' : player.weapon === 'scatter' ? '#a8ecff' : '#ffe9a8';
  ctx.fillStyle = '#3a2f28';
  ctx.fillRect(8, -3.5, 22, 7);
  ctx.fillStyle = weaponColor;
  ctx.fillRect(26, -2.5, 10, 5);
  ctx.restore();

  // Aim reticle at the mouse.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(player.aimX || x + Math.cos(player.aimAngle) * 60, player.aimY || y + Math.sin(player.aimAngle) * 60, 7, 0, Math.PI * 2);
  ctx.stroke();
}

/** Draw one bullet (lance bolts are long and fiery). */
export function drawBullet(ctx, bullet) {
  ctx.save();
  ctx.translate(bullet.x, bullet.y);
  ctx.rotate(bullet.angle);
  if (bullet.isLance) {
    ctx.fillStyle = bullet.trail;
    ctx.beginPath();
    ctx.ellipse(-8, 0, 16, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.ellipse(4, 0, 12, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = bullet.trail;
    ctx.beginPath();
    ctx.arc(-3, 0, bullet.size * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(2, 0, bullet.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Draw an enemy ink blob. */
export function drawInkBlob(ctx, blob) {
  ctx.fillStyle = '#2b1b4d';
  ctx.beginPath();
  ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6a3fb5';
  ctx.beginPath();
  ctx.arc(blob.x - 1.5, blob.y - 1.5, blob.radius * 0.55, 0, Math.PI * 2);
  ctx.fill();
}

/** Draw a coin pickup: a spinning gold coin. */
export function drawCoin(ctx, coin, time) {
  const spin = Math.abs(Math.sin(time * 5 + coin.phase));
  ctx.save();
  ctx.translate(coin.x, coin.y);
  ctx.scale(0.45 + spin * 0.55, 1);
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b98a1e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#b98a1e';
  ctx.font = 'bold 9px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('C', 0, 0.5);
  ctx.restore();
}

/** Draw an allied lantern turret. */
export function drawTurret(ctx, turret, time) {
  ctx.save();
  ctx.translate(turret.x, turret.y);
  ctx.fillStyle = '#3a2f28';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f5efe0';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(turret.angle);
  ctx.fillStyle = '#e8542f';
  ctx.fillRect(4, -3, 16, 6);
  ctx.restore();
  const glow = ctx.createRadialGradient(turret.x, turret.y, 2, turret.x, turret.y, 26);
  glow.addColorStop(0, 'rgba(255, 220, 120, 0.35)');
  glow.addColorStop(1, 'rgba(255, 220, 120, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(turret.x, turret.y, 26, 0, Math.PI * 2);
  ctx.fill();
}
