export const VIEW = { width: 480, height: 800 } as const;
export const RULES = {
  gravity: 1480, jumpSpeed: 735, moveSpeed: 285,
  playerRadius: 15, playerHalfHeight: 23,
  attackRadius: 118, attackDuration: 0.24, attackCooldown: 0.38,
  comboWindow: 2.4, comboBoost: 780, enemyScore: 100,
  chainGap: 300,
  coinScore: 25, bossScore: 800, heightScale: 0.2,
} as const;

export const PLATFORM_TYPES = {
  stone: { width: 116, color: 0x6c9c97, moves: false, fragile: false },
  cloud: { width: 102, color: 0x95bfbb, moves: true, fragile: false },
  fragile: { width: 106, color: 0xc18b6c, moves: false, fragile: true },
} as const;
export type PlatformKind = keyof typeof PLATFORM_TYPES;

export const ZONES = [
  { id: 'grove', name: 'Тихая роща', from: 0, gap: 106, enemyEvery: 4, tint: 0x4e8a87 },
  { id: 'mist', name: 'Море тумана', from: 300, gap: 116, enemyEvery: 3, tint: 0x7096a9 },
  { id: 'temple', name: 'Небесный храм', from: 600, gap: 124, enemyEvery: 3, tint: 0xbcb68e },
] as const;
export const ENEMY_TYPES = {
  wisp: { health: 1, radius: 21, coins: 3, speed: 28, color: 0xd37c69 },
  oni: { health: 3, radius: 38, coins: 25, speed: 38, color: 0xe8996d },
} as const;
export type EnemyKind = keyof typeof ENEMY_TYPES;

// Economics refer to stable catalog IDs. Rendering only reads the appearance.
export const SKINS = [
  { id: 'ember', name: 'Алый ветер', price: 0, appearance: { scarf: 0xec675b, suit: 0x203d47 } },
  { id: 'jade', name: 'Нефрит', price: 80, appearance: { scarf: 0x80d9b0, suit: 0x264e4a } },
  { id: 'moon', name: 'Лунная тень', price: 160, appearance: { scarf: 0xe7c887, suit: 0x445271 } },
] as const;
export type SkinId = (typeof SKINS)[number]['id'];
export const zoneAt = (height: number) => [...ZONES].reverse().find(z => height >= z.from) ?? ZONES[0];
