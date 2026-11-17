// ui.js — every screen the judge sees: the HUD (health, night, score, coins,
// weapon, dash, boss bar), the title screen with difficulty select, the
// between-nights upgrade shop, pause, victory and defeat. All drawn on canvas so
// the screenshots show the complete game at a glance.

import { formatNumber } from './utils.js';
import { getWeapon, WEAPON_ORDER } from './weapons.js';
import { UPGRADES, upgradePrice, upgradeAvailable } from './upgrades.js';
import { TOTAL_NIGHTS } from './waves.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_SHOP = 'shop';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_VICTORY = 'victory';
export const SCREEN_DEFEAT = 'defeat';

/** Button rectangles, rebuilt each draw so clicks always match the picture. */
export class UiButtons {
  constructor() {
    this.rects = [];
  }

  clear() {
    this.rects.length = 0;
  }

  add(id, x, y, w, h) {
    this.rects.push({ id, x, y, w, h });
  }

  /** Id of the button under (x, y), or null. */
  hit(x, y) {
    for (let i = this.rects.length - 1; i >= 0; i -= 1) {
      const r = this.rects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.id;
    }
    return null;
  }
}

/** Shared text helpers. */
function panel(ctx, x, y, w, h, fill = 'rgba(8, 34, 40, 0.82)') {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 211, 77, 0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function titleText(ctx, text, x, y, size, color = '#ffe9a8', font = 'bold') {
  ctx.font = `${font} ${size}px "Trebuchet MS", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, size / 8);
  ctx.strokeStyle = 'rgba(8, 30, 36, 0.9)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function bodyText(ctx, text, x, y, size, color = '#eafcff', align = 'center') {
  ctx.font = `${size}px "Trebuchet MS", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawButton(ctx, buttons, id, x, y, w, h, label, sub = '', enabled = true, accent = false) {
  buttons.add(id, x, y, w, h);
  ctx.fillStyle = enabled ? (accent ? '#e8542f' : '#1e7d74') : 'rgba(60, 80, 84, 0.85)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = enabled ? '#ffd34d' : 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
  titleText(ctx, label, x + w / 2, y + (sub ? h / 2 - 9 : h / 2), sub ? 19 : 21, enabled ? '#ffffff' : '#b8c8c8');
  if (sub) bodyText(ctx, sub, x + w / 2, y + h / 2 + 13, 13, enabled ? '#ffe9a8' : '#9fb0b0');
}

/** Draw a horizontal bar with a border (health, boss, dash). */
function drawBar(ctx, x, y, w, h, fraction, fillColor, backColor = 'rgba(8, 30, 36, 0.75)') {
  ctx.fillStyle = backColor;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  if (fraction > 0) {
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(h, w * fraction), h, h / 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.stroke();
}

/**
 * The in-play HUD: HP bar, night + foes left, score, coins, combo, weapon slots,
 * dash cooldown, beam charge, and the boss bar when a boss is alive.
 */
export function drawHud(ctx, game) {
  const player = game.player;
  const w = 1280;
  ctx.textBaseline = 'middle';

  // Top-left: health + dash.
  panel(ctx, 16, 14, 300, 74, 'rgba(8, 34, 40, 0.72)');
  bodyText(ctx, 'WARDEN', 30, 32, 13, '#ffd34d', 'left');
  drawBar(ctx, 30, 42, 200, 16, player.hp / player.maxHp, player.hp / player.maxHp > 0.3 ? '#7fe3a8' : '#ff5c5c');
  bodyText(ctx, `${Math.ceil(player.hp)} / ${player.maxHp} HP`, 236, 50, 13, '#ffffff', 'left');
  bodyText(ctx, 'DASH [Shift]', 30, 76, 12, '#bfeef2', 'left');
  drawBar(ctx, 118, 68, 110, 10, player.dashFraction, player.dashReady ? '#7fe3d8' : '#5fa8a0');
  bodyText(ctx, player.dashReady ? 'READY' : '...', 234, 73, 12, player.dashReady ? '#7fe3d8' : '#bfeef2', 'left');

  // Top-centre: night, foes left, boss bar.
  panel(ctx, 460, 14, 360, 74, 'rgba(8, 34, 40, 0.72)');
  const nightLabel = game.endless ? `ENDLESS NIGHT ${game.night}` : `NIGHT ${game.night} / ${TOTAL_NIGHTS}`;
  titleText(ctx, nightLabel, 640, 34, 20, '#ffe9a8');
  const boss = game.boss;
  if (boss && !boss.dead) {
    drawBar(ctx, 480, 52, 320, 12, Math.max(0, boss.hp / boss.maxHp), boss.kind === 'leviathan' ? '#5c8aff' : '#ff5c7a');
    bodyText(ctx, `${boss.name}  ·  PHASE ${boss.phase} / 3`, 640, 73, 12, '#ffffff');
  } else {
    bodyText(ctx, `${game.waves.remaining()} foes remain  ·  ${game.enemiesAlive} in the water`, 640, 66, 14, '#eafcff');
  }

  // Top-right: score, coins, combo.
  panel(ctx, 964, 14, 300, 74, 'rgba(8, 34, 40, 0.72)');
  bodyText(ctx, 'SCORE', 980, 32, 13, '#ffd34d', 'left');
  bodyText(ctx, formatNumber(game.score), 1100, 32, 18, '#ffffff', 'left');
  bodyText(ctx, 'COINS', 980, 56, 13, '#ffd34d', 'left');
  bodyText(ctx, `◉ ${formatNumber(game.coins)}`, 1100, 56, 18, '#ffd34d', 'left');
  if (game.combo >= 2) {
    bodyText(ctx, `COMBO x${game.combo}`, 980, 76, 14, '#ff9a3d', 'left');
  }

  // Bottom-left: weapon slots (1 / 2 / 3) with the active one highlighted.
  const slotY = 640;
  WEAPON_ORDER.forEach((id, index) => {
    const weapon = getWeapon(id);
    const x = 16 + index * 118;
    const active = player.weapon === id;
    ctx.fillStyle = active ? 'rgba(255, 211, 77, 0.28)' : 'rgba(8, 34, 40, 0.72)';
    ctx.beginPath();
    ctx.roundRect(x, slotY, 108, 62, 10);
    ctx.fill();
    ctx.strokeStyle = active ? '#ffd34d' : 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = active ? 3 : 1.5;
    ctx.stroke();
    bodyText(ctx, `[${weapon.key}] ${weapon.short}`, x + 54, slotY + 16, 13, active ? '#ffd34d' : '#eafcff');
    bodyText(ctx, `DMG ${Math.round(weapon.damage * player.damageMultiplier)}`, x + 54, slotY + 36, 12, '#bfeef2');
    bodyText(ctx, weapon.pellets > 1 ? `${weapon.pellets} pellets` : weapon.pierce > 0 ? `pierces ${weapon.pierce}` : 'precise', x + 54, slotY + 52, 11, '#9fc8c8');
  });

  // Bottom-right: beam + controls reminder.
  panel(ctx, 964, 640, 300, 62, 'rgba(8, 34, 40, 0.72)');
  bodyText(ctx, `BEAM ${game.beamOn ? 'BURNING' : 'SWEEPING'}  ·  ${game.beamKills} kindled`, 979, 658, 13, game.beamOn ? '#ff9a3d' : '#bfeef2', 'left');
  bodyText(ctx, 'WASD move · mouse aim · click shoot', 979, 678, 12, '#9fc8c8', 'left');
  bodyText(ctx, 'Shift dash · 1/2/3 weapons · P pause · M mute', 979, 694, 12, '#9fc8c8', 'left');

  // Wave banner (big centre text that fades).
  if (game.bannerTimer > 0) {
    const alpha = Math.min(1, game.bannerTimer / 0.6);
    ctx.globalAlpha = alpha;
    titleText(ctx, game.bannerTitle, 640, 210, 46, '#ffe9a8');
    if (game.bannerSub) bodyText(ctx, game.bannerSub, 640, 252, 20, '#ffffff');
    ctx.globalAlpha = 1;
  }

  // Low-HP vignette: the screen edges burn red when the Warden is nearly down.
  if (player.hp > 0 && player.hp / player.maxHp < 0.3) {
    const pulse = 0.25 + Math.sin(game.time * 6) * 0.1;
    const vignette = ctx.createRadialGradient(640, 360, 260, 640, 360, 720);
    vignette.addColorStop(0, 'rgba(255, 40, 40, 0)');
    vignette.addColorStop(1, `rgba(255, 40, 40, ${pulse})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, 1280, 720);
  }

  // Hurt flash.
  if (player.hurtFlash > 0) {
    ctx.fillStyle = `rgba(255, 60, 60, ${player.hurtFlash * 0.5})`;
    ctx.fillRect(0, 0, 1280, 720);
  }
}

/** The title screen: name, numbers, difficulty select, how to play, best score. */
export function drawTitle(ctx, game, buttons) {
  buttons.clear();
  ctx.fillStyle = 'rgba(8, 30, 38, 0.45)';
  ctx.fillRect(0, 0, 1280, 720);

  titleText(ctx, 'TIDEWARDEN', 640, 108, 72, '#ffe9a8');
  titleText(ctx, 'SIEGE OF THE EMBER REEF', 640, 162, 26, '#ff9a3d');
  bodyText(ctx, 'Hold the lighthouse through ten nights — 3 weapons, 5 tides, 12 upgrades,', 640, 206, 19, '#ffffff');
  bodyText(ctx, 'and the Tide Leviathan waiting on Night 10. Snag the tide. Kindle the beam.', 640, 232, 19, '#ffffff');

  panel(ctx, 330, 256, 620, 154);
  bodyText(ctx, 'HOW TO PLAY', 640, 276, 15, '#ffd34d');
  bodyText(ctx, 'WASD move · mouse aim · hold click to shoot · Shift to dash', 640, 300, 17, '#ffffff');
  bodyText(ctx, '1 / 2 / 3 switch Harpoon, Scatter Net, Ember Lance', 640, 324, 17, '#ffffff');
  bodyText(ctx, 'Kill inklings, grab their coins, spend them between nights.', 640, 348, 17, '#ffffff');
  bodyText(ctx, 'The lighthouse beam sweeps the reef — foes caught in it burn.', 640, 372, 15, '#ff9a3d');
  bodyText(ctx, 'Survive Night 10 and slay the Tide Leviathan to win.', 640, 396, 15, '#ffffff');

  // Difficulty select: three real choices, each with its own tuning.
  bodyText(ctx, 'CHOOSE YOUR SEA', 640, 436, 15, '#ffd34d');
  const difficulties = [
    { id: 'calm', label: 'CALM', sub: 'foes −20% HP · gentle', x: 370 },
    { id: 'storm', label: 'STORM', sub: 'the intended siege', x: 560 },
    { id: 'tempest', label: 'TEMPEST', sub: 'foes +30% HP · +damage', x: 750 },
  ];
  for (const d of difficulties) {
    const selected = game.difficulty === d.id;
    ctx.fillStyle = selected ? 'rgba(255, 211, 77, 0.3)' : 'rgba(8, 34, 40, 0.8)';
    ctx.beginPath();
    ctx.roundRect(d.x, 454, 160, 64, 10);
    ctx.fill();
    ctx.strokeStyle = selected ? '#ffd34d' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.stroke();
    buttons.add(`difficulty-${d.id}`, d.x, 454, 160, 64);
    titleText(ctx, d.label, d.x + 80, 474, 20, selected ? '#ffd34d' : '#ffffff');
    bodyText(ctx, d.sub, d.x + 80, 500, 12, '#bfeef2');
  }

  drawButton(ctx, buttons, 'start', 490, 542, 300, 58, '⚓  BEGIN THE SIEGE', 'Night 1 of 10 — the tide is coming', true, true);
  if (game.bestScore > 0) {
    bodyText(ctx, `Best score: ${formatNumber(game.bestScore)}   ·   Best night: ${game.bestNight}`, 640, 622, 16, '#ffe9a8');
  }
  bodyText(ctx, 'An original game — every sprite, sound and name drawn and played by code.', 640, 652, 13, '#9fc8c8');
}

/** The between-nights shop: 12 upgrades, prices, levels, coins, and next night. */
export function drawShop(ctx, game, buttons) {
  buttons.clear();
  ctx.fillStyle = 'rgba(8, 30, 38, 0.55)';
  ctx.fillRect(0, 0, 1280, 720);

  titleText(ctx, `NIGHT ${game.night} CLEARED`, 640, 66, 40, '#ffe9a8');
  bodyText(ctx, `The reef holds — for now. Spend your coins, Warden, then face Night ${game.night + 1}.`, 640, 106, 18, '#ffffff');
  bodyText(ctx, `◉ ${formatNumber(game.coins)} coins   ·   Score ${formatNumber(game.score)}`, 640, 136, 18, '#ffd34d');

  const cols = 3;
  const cardW = 300;
  const cardH = 118;
  const gapX = 24;
  const gapY = 18;
  const startX = (1280 - (cols * cardW + (cols - 1) * gapX)) / 2;
  const startY = 168;
  UPGRADES.forEach((upgrade, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);
    const level = game.player.upgradeLevels[upgrade.id] || 0;
    const price = upgradePrice(upgrade, level);
    const affordable = price !== null && game.coins >= price;
    const maxed = !upgradeAvailable(upgrade, level);
    panel(ctx, x, y, cardW, cardH, affordable || maxed ? 'rgba(8, 34, 40, 0.88)' : 'rgba(8, 34, 40, 0.6)');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 17px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`[${upgrade.key}] ${upgrade.name}`, x + 14, y + 22);
    ctx.font = '13px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#bfeef2';
    const words = upgrade.description.split(' ');
    let line = '';
    let lineY = y + 48;
    for (const word of words) {
      if ((line + word).length > 34) {
        ctx.fillText(line, x + 14, lineY);
        line = '';
        lineY += 16;
      }
      line += `${word} `;
    }
    ctx.fillText(line, x + 14, lineY);
    // Level pips.
    for (let p = 0; p < upgrade.prices.length; p += 1) {
      ctx.fillStyle = p < level ? '#ffd34d' : 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.arc(x + 18 + p * 18, y + cardH - 18, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    const label = maxed ? 'MAXED' : `◉ ${price}`;
    ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = maxed ? '#9fc8c8' : affordable ? '#ffd34d' : '#ff8a8a';
    ctx.fillText(label, x + cardW - 14, y + cardH - 18);
    buttons.add(`buy-${upgrade.id}`, x, y, cardW, cardH);
  });

  drawButton(ctx, buttons, 'next-night', 490, 640, 300, 56, `BEGIN NIGHT ${game.night + 1}`, 'or press Enter', true, true);
  bodyText(ctx, 'Click a card or press its number key to buy.', 640, 712, 13, '#9fc8c8');
}

/** The pause overlay. */
export function drawPause(ctx, game, buttons) {
  buttons.clear();
  ctx.fillStyle = 'rgba(8, 30, 38, 0.6)';
  ctx.fillRect(0, 0, 1280, 720);
  titleText(ctx, 'PAUSED', 640, 240, 54, '#ffe9a8');
  bodyText(ctx, `Night ${game.night} · Score ${formatNumber(game.score)} · ${formatNumber(game.coins)} coins`, 640, 300, 19, '#ffffff');
  bodyText(ctx, 'The tide waits for no one — except now.', 640, 330, 16, '#bfeef2');
  drawButton(ctx, buttons, 'resume', 490, 380, 300, 56, 'RESUME', 'Esc / P', true, true);
  drawButton(ctx, buttons, 'restart', 490, 452, 300, 56, 'RESTART RUN', 'R', true, false);
  drawButton(ctx, buttons, 'quit-title', 490, 524, 300, 56, 'QUIT TO TITLE', '', true, false);
}

/** The victory screen: stats, the Endless offer, and restart. */
export function drawVictory(ctx, game, buttons) {
  buttons.clear();
  ctx.fillStyle = 'rgba(8, 30, 38, 0.5)';
  ctx.fillRect(0, 0, 1280, 720);
  titleText(ctx, 'THE REEF IS SAVED', 640, 130, 56, '#ffe9a8');
  titleText(ctx, 'THE TIDE LEVIATHAN IS SLAIN', 640, 186, 24, '#ff9a3d');
  bodyText(ctx, 'Dawn breaks over the Ember Reef. The lighthouse burns bright,', 640, 232, 19, '#ffffff');
  bodyText(ctx, 'and the Warden stands where the tide could not take them.', 640, 258, 19, '#ffffff');

  panel(ctx, 440, 292, 400, 168);
  bodyText(ctx, 'FINAL SCORE', 640, 316, 14, '#ffd34d');
  titleText(ctx, formatNumber(game.score), 640, 352, 40, '#ffffff');
  bodyText(ctx, `Nights survived: 10 / 10  ·  Foes slain: ${formatNumber(game.kills)}`, 640, 392, 16, '#eafcff');
  bodyText(ctx, `Coins gathered: ${formatNumber(game.coinsEarned)}  ·  Beam kindles: ${game.beamKills}`, 640, 418, 16, '#eafcff');
  bodyText(ctx, `Difficulty: ${game.difficultyLabel}  ·  Time: ${game.runTimeText}`, 640, 442, 16, '#eafcff');

  drawButton(ctx, buttons, 'endless', 430, 492, 420, 56, '🌊  CONTINUE — ENDLESS TIDE', 'nights keep coming, harder each time', true, true);
  drawButton(ctx, buttons, 'restart', 430, 564, 200, 52, 'PLAY AGAIN', 'R', true, false);
  drawButton(ctx, buttons, 'quit-title', 650, 564, 200, 52, 'TITLE', '', true, false);
  bodyText(ctx, 'New best score!', 640, 650, 16, '#ffd34d');
}

/** The defeat screen: what night, what score, and the way back in. */
export function drawDefeat(ctx, game, buttons) {
  buttons.clear();
  ctx.fillStyle = 'rgba(20, 8, 16, 0.55)';
  ctx.fillRect(0, 0, 1280, 720);
  titleText(ctx, 'THE LIGHT GOES OUT', 640, 140, 54, '#ff8a8a');
  bodyText(ctx, 'The Warden falls. The inklings swarm the darkened reef,', 640, 196, 19, '#ffffff');
  bodyText(ctx, 'and the ember of the lighthouse gutters — but embers can be rekindled.', 640, 222, 19, '#ffffff');

  panel(ctx, 440, 258, 400, 150);
  bodyText(ctx, 'THE SIEGE ENDED ON', 640, 282, 14, '#ffd34d');
  titleText(ctx, game.endless ? `ENDLESS NIGHT ${game.night}` : `NIGHT ${game.night} / ${TOTAL_NIGHTS}`, 640, 316, 30, '#ffffff');
  bodyText(ctx, `Score ${formatNumber(game.score)}  ·  Foes slain: ${formatNumber(game.kills)}`, 640, 352, 16, '#eafcff');
  bodyText(ctx, `Coins gathered: ${formatNumber(game.coinsEarned)}`, 640, 378, 16, '#eafcff');

  drawButton(ctx, buttons, 'restart', 490, 448, 300, 58, '↻  TRY AGAIN', 'press R or click', true, true);
  drawButton(ctx, buttons, 'quit-title', 490, 520, 300, 52, 'BACK TO TITLE', '', true, false);
  bodyText(ctx, 'Tip: spend coins between nights — a Lantern Turret watches your back.', 640, 606, 15, '#bfeef2');
}
