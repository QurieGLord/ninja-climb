import type { EnemyKind, PlatformKind } from '../data/config';
export type Motion = 'idle' | 'running' | 'jumping' | 'rising' | 'falling' | 'landing' | 'wall_cling' | 'wall_slide' | 'wall_jump' | 'dashing' | 'attacking' | 'hurt' | 'dead';
export interface Rect { x: number; y: number; width: number; height: number }
export interface Platform { id: number; x: number; y: number; width: number; kind: PlatformKind; baseX: number; broken: boolean; crumble: number; dx: number }
export interface Wall extends Rect { id: number; grip: boolean; hazard: boolean; gateFor?: number }
export interface Enemy {
  id: number; x: number; y: number; baseX: number; baseY: number; kind: EnemyKind;
  hp: number; facing: number; vx: number; vy: number; platformId: number;
  state: 'idle' | 'move' | 'windup' | 'attack' | 'recover' | 'hurt' | 'dying';
  stateTime: number; reactionLeft: number; cycle: number; targetX: number; targetY: number; rewarded: boolean;
}
export interface Coin { id: number; x: number; y: number }
export interface Player {
  x: number; y: number; vx: number; vy: number; facing: number; health: number; invincible: number;
  motion: Motion; motionTime: number; grounded: number | null; coyote: number; jumpBuffer: number;
  wallId: number | null; wallSide: number; clingLeft: number; lastWall: number | null; wallLock: number;
  dashLeft: number; dashReady: boolean; dashCooldown: number; dashBuffer: number; dashX: number; dashY: number;
  attackTime: number; cooldown: number; attackId: number; hitIds: number[]; attackBuffer: number;
  hurtLeft: number; deathLeft: number; landingLeft: number;
}
export interface Controls {
  direction: number; vertical: number; targetX: number | null; aim: { x: number; y: number } | null;
  dashDirection: { x: number; y: number } | null;
  jump: boolean; jumpHeld: boolean; dash: boolean; attack: boolean;
}
export const IDLE_INPUT: Controls = { direction: 0, vertical: 0, targetX: null, aim: null, dashDirection: null, jump: false, jumpHeld: false, dash: false, attack: false };
export interface RunSnapshot {
  modelVersion: 2; id: string; seed: number; nextId: number; elapsed: number;
  originY: number; heightOffset: number; player: Player; platforms: Platform[]; walls: Wall[]; enemies: Enemy[]; coins: Coin[];
  cameraY: number; cameraTarget: number; topY: number; generated: number;
  height: number; score: number; earned: number; kills: number; combo: number; bestCombo: number;
  comboLeft: number; hitStop: number; tutorial: number; tutorialFlags: number; ended: boolean; cause: string;
  inputLatch: { jump: boolean; dash: boolean; attack: boolean };
}
export type RunEvent = { type: 'jump' | 'land' | 'wall' | 'dash' | 'attack' | 'hit' | 'block' | 'hurt' | 'end' | 'warning'; x: number; y: number }
  | { type: 'coin' | 'kill' | 'boss'; x: number; y: number; amount: number; combo?: number };
