export const VIEW = { width: 480, height: 800 } as const;
export const RULES = {
  step: 1 / 120, gravity: 1700, jumpSpeed: 680, jumpCutSpeed: 500,
  moveSpeed: 270, groundAcceleration: 3600, airAcceleration: 3000, braking: 3400,
  playerRadius: 14, playerHalfHeight: 24, coyoteTime: 0.10, jumpBuffer: 0.14,
  clingDuration: 0.38, wallSlideSpeed: 100, wallJumpSpeed: 340, wallJumpLock: 0.13,
  dashSpeed: 980, dashDuration: 0.15, dashCooldown: 0.45,
  attackDuration: 0.30, attackCooldown: 0.34, attackStart: 0.07, attackEnd: 0.19,
  attackReach: 78, attackHeight: 58, comboWindow: 2, airHitLift: 210,
  hitStop: 0.045, invulnerability: 1.15, maxHealth: 3,
  enemyScore: 100, bossScore: 1000, coinScore: 25, heightScale: 0.2,
} as const;
export const PLATFORM_TYPES = {
  stone: { width: 160, moves: false, fragile: false, texture: 'stone' },
  cloud: { width: 160, moves: true, fragile: false, texture: 'moving' },
  fragile: { width: 156, moves: false, fragile: true, texture: 'fragile' },
  arena: { width: 400, moves: false, fragile: false, texture: 'arena' },
} as const;
export type PlatformKind = keyof typeof PLATFORM_TYPES;
export const ZONES = [
  { id: 'sky', name: 'Облачные врата', from: 0, background: 'sky', atmosphere: 0xd5e0d2 },
  { id: 'night', name: 'Синяя ночь', from: 360, background: 'night', atmosphere: 0x87bce3 },
  { id: 'inferno', name: 'Пепельный предел', from: 720, background: 'inferno', atmosphere: 0xe89964 },
] as const;
export const ENEMY_TYPES = {
  wisp: { name: 'Теневой страж', health: 2, radius: 20, coins: 3, texture: 'sentinel', windup: 0.60, recover: 0.9 },
  moth: { name: 'Бумажный дух', health: 2, radius: 19, coins: 4, texture: 'moth', windup: 0.75, recover: 1.1 },
  oni: { name: 'Страж грозы', health: 6, radius: 33, coins: 30, texture: 'oni', windup: 0.85, recover: 1.15 },
} as const;
export type EnemyKind = keyof typeof ENEMY_TYPES;
export const SKINS = [
  { id: 'ember', name: 'Алый ветер', price: 0, texture: 'hero-ember', appearance: { scarf: 0xec675b, suit: 0x203d47 } },
  { id: 'jade', name: 'Нефрит', price: 80, texture: 'hero-jade', appearance: { scarf: 0x80d9b0, suit: 0x264e4a } },
  { id: 'moon', name: 'Лунная тень', price: 160, texture: 'hero-moon', appearance: { scarf: 0xe7c887, suit: 0x445271 } },
] as const;
export type SkinId = (typeof SKINS)[number]['id'];
export const zoneAt = (height: number) => [...ZONES].reverse().find(z => height >= z.from) ?? ZONES[0];
