// upgrades.js — the between-nights shop. Coins earned by killing foes buy
// permanent upgrades for the run: damage, fire rate, health, dash, magnet and
// allied turrets. Each upgrade has tiers with rising prices and a hard cap.

/** Upgrade ids. */
export const UPGRADE_DAMAGE = 'damage';
export const UPGRADE_FIRERATE = 'firerate';
export const UPGRADE_MAXHP = 'maxhp';
export const UPGRADE_DASH = 'dash';
export const UPGRADE_MAGNET = 'magnet';
export const UPGRADE_TURRET = 'turret';
export const UPGRADE_SWIFT = 'swift';
export const UPGRADE_ARMOR = 'armor';
export const UPGRADE_GREED = 'greed';
export const UPGRADE_CRIT = 'crit';
export const UPGRADE_PIERCE = 'pierce';
export const UPGRADE_RENEW = 'renew';

/** The shop catalogue: name, description, tier prices, and what each tier does. */
export const UPGRADES = [
  {
    id: UPGRADE_DAMAGE,
    name: 'Ember Rounds',
    key: '1',
    description: '+20% weapon damage per tier. Every shot hits harder.',
    prices: [30, 55, 85],
    apply: (player) => { player.damageMultiplier *= 1.2; },
  },
  {
    id: UPGRADE_FIRERATE,
    name: 'Quick Hands',
    key: '2',
    description: '+15% fire rate per tier. More bolts in the water.',
    prices: [30, 55, 85],
    apply: (player) => { player.rateMultiplier *= 1.15; },
  },
  {
    id: UPGRADE_MAXHP,
    name: 'Reef Heart',
    key: '3',
    description: '+25 max HP and heal 25 now, per tier. Stay standing.',
    prices: [25, 45, 65],
    apply: (player) => {
      player.maxHp += 25;
      player.heal(25);
    },
  },
  {
    id: UPGRADE_DASH,
    name: 'Tide Step',
    key: '4',
    description: 'Dash recharges 25% faster per tier. Slip away sooner.',
    prices: [25, 45],
    apply: (player) => { player.dashCooldownMax *= 0.75; },
  },
  {
    id: UPGRADE_MAGNET,
    name: 'Coin Current',
    key: '5',
    description: '+60% coin pickup radius per tier. Coins swim to you.',
    prices: [20, 35],
    apply: (player) => { player.magnetRadius *= 1.6; },
  },
  {
    id: UPGRADE_TURRET,
    name: 'Lantern Turret',
    key: '6',
    description: 'A lighthouse turret fires beside you. Max 2 turrets.',
    prices: [60, 95],
    apply: (player) => { player.addTurret(); },
  },
  {
    id: UPGRADE_SWIFT,
    name: 'Swift Current',
    key: '7',
    description: '+12% movement speed per tier. Outrun the tide.',
    prices: [20, 35, 50],
    apply: (player) => { player.speed *= 1.12; },
  },
  {
    id: UPGRADE_ARMOR,
    name: 'Coral Plate',
    key: '8',
    description: 'Take 15% less damage per tier. The reef guards you.',
    prices: [30, 50],
    apply: (player) => { player.armor = Math.min(0.6, (player.armor || 0) + 0.15); },
  },
  {
    id: UPGRADE_GREED,
    name: 'Gilded Tide',
    key: '9',
    description: '+50% coins from every kill per tier. Richer nights.',
    prices: [25, 45],
    apply: (player) => { player.coinMultiplier = (player.coinMultiplier || 1) * 1.5; },
  },
  {
    id: UPGRADE_CRIT,
    name: 'Ember Sparks',
    key: '0',
    description: '+12% chance to crit for double damage, per tier.',
    prices: [30, 55],
    apply: (player) => { player.critChance = (player.critChance || 0) + 0.12; },
  },
  {
    id: UPGRADE_PIERCE,
    name: 'Keen Point',
    key: 'Q',
    description: 'Your shots pierce +1 extra foe per tier. Lines of ink fall.',
    prices: [40, 70],
    apply: (player) => { player.bonusPierce = (player.bonusPierce || 0) + 1; },
  },
  {
    id: UPGRADE_RENEW,
    name: 'Dawn Renewal',
    key: 'E',
    description: 'Heal 40 HP at the start of every night, per tier.',
    prices: [25, 45],
    apply: (player) => { player.nightHeal = (player.nightHeal || 0) + 40; },
  },
];

/** Look an upgrade up by id. */
export function getUpgrade(id) {
  return UPGRADES.find((entry) => entry.id === id) || null;
}

/** Price of the next tier of an upgrade, or null when it is maxed. */
export function upgradePrice(upgrade, level) {
  if (level >= upgrade.prices.length) return null;
  return upgrade.prices[level];
}

/** True when the upgrade still has a tier left to buy. */
export function upgradeAvailable(upgrade, level) {
  return level < upgrade.prices.length;
}

/**
 * Try to buy the next tier of `upgradeId` with `coins`. Returns an object with
 * { ok, price, reason } — 'maxed' or 'poor' when the purchase cannot happen —
 * and applies the effect on success.
 */
export function buyUpgrade(player, upgradeId, coins) {
  const upgrade = getUpgrade(upgradeId);
  if (!upgrade) return { ok: false, price: 0, reason: 'unknown' };
  const level = player.upgradeLevels[upgradeId] || 0;
  const price = upgradePrice(upgrade, level);
  if (price === null) return { ok: false, price: 0, reason: 'maxed' };
  if (coins < price) return { ok: false, price, reason: 'poor' };
  upgrade.apply(player);
  player.upgradeLevels[upgradeId] = level + 1;
  return { ok: true, price, reason: '' };
}
