# TIDEWARDEN: Siege of the Ember Reef

[![best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/Mansyur0523/makefun-best-game-r5/rank.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Mansyur0523/makefun-best-game-r5/reward.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**TIDEWARDEN: hold the Ember Reef lighthouse through ten nights — 3 weapons, 5 tides, 12 upgrades, the Tide Leviathan.**

You are the last Warden of a coral lighthouse guarding an eternal ember. When the tide rises, the inklings of the deep swarm the reef from every direction. Snag the tide. Kindle the beam. Survive ten nights and slay the Tide Leviathan — or the light goes out.

## How to play

| Control | Action |
|---|---|
| WASD / arrows | Move |
| Mouse | Aim |
| Hold click | Shoot |
| Shift / Space | Dash (brief invulnerability, 2.2 s cooldown) |
| 1 / 2 / 3 | Harpoon / Scatter Net / Ember Lance |
| Esc / P | Pause |
| R | Restart (on end screens) |
| M | Mute |
| Enter | Next night (in the shop) |

## What's in the game

- **Ten nights, one siege** — each night spawns more, tougher foes; odd nights bring a Reef Tyrant mini-boss; Night 10 wakes the **Tide Leviathan**, a three-phase boss (radial ink, skitter summons, charging rush).
- **5 tides of foe** — Skitter, Spitter, Brute, Diver and Wisp, each with its own movement and attack.
- **3 weapons** — Harpoon (fast, precise), Scatter Net (five-pellet fan), Ember Lance (slow, piercing, burning).
- **The lighthouse beam** — a real mechanic, not decoration: the rotating beam sweeps the reef and burns every foe caught in it. Foes kindled by the beam count toward your tally.
- **12 upgrades** — between nights, spend coins on damage, fire rate, max HP, dash, magnet, lantern turrets, move speed, armour, coin greed, crits, piercing and dawn healing.
- **3 difficulties + Endless** — Calm, Storm and Tempest on the title screen; after victory, the Endless tide keeps coming, harder every night.
- **Full loop** — title screen, HUD (HP, night, score, coins, combo, weapon, dash, boss bar), wave banners, pause, upgrade shop, victory and defeat screens with stats and restart.
- **Feel** — particles on every hit, floating damage numbers, screen shake, hurt flash, combo multiplier, and fully synthesised WebAudio effects plus an ambient pad-and-pluck score. No audio or image files anywhere.

## Play it

No build step, no network. Serve `game/` with any static server and open `index.html`:

```sh
node serve.ts   # then open http://localhost:8080
```

Screenshots are deterministic renders of the game's own code: `?shot=title|play|victory|defeat&seed=7` stages each scene (see `shots.json`).

## Structure

```
game/
  index.html          page + canvas
  css/style.css       page chrome
  js/main.js          game loop, state machine, collisions, beam, economy
  js/player.js        the Warden: move, dash, weapons, turrets
  js/enemies.js       5 foe kinds, mini-boss, 3-phase Leviathan
  js/waves.js         the ten nights + Endless scaling
  js/weapons.js       Harpoon / Scatter Net / Ember Lance
  js/upgrades.js      the 12-upgrade between-nights shop
  js/audio.js         synthesised WebAudio SFX + ambient music
  js/particles.js     sparks, explosions, damage numbers
  js/render.js        dusk sea, reef, lighthouse, creatures (canvas vector art)
  js/ui.js            HUD, title, shop, pause, victory, defeat
  js/input.js         keyboard + mouse
  js/shots.js         deterministic screenshot scenes + autopilot
  js/utils.js         seeded RNG, angles, formatting
```

An original game: every name, sprite, sound and line of code was made for this entry. MIT licensed.
