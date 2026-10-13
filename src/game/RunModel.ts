import { RULES } from '../data/config';
import { movePlayer, setMotion } from './movement';
import { updateCombat, checkHazards } from './combat';
import { updateEnemies } from './enemies';
import { generateLevel } from './level';
import type { Controls, Player, RunEvent, RunSnapshot } from './types';
export type { Controls, RunSnapshot, RunEvent, Platform, Enemy, Coin } from './types';
export { IDLE_INPUT } from './types';
export function freshPlayer(y = 686): Player {
  return { x: 240, y, vx: 0, vy: 0, facing: 1, health: 3, invincible: 0,
    motion: 'idle', motionTime: 0, grounded: 0, coyote: RULES.coyoteTime, jumpBuffer: 0,
    wallId: null, wallSide: 0, clingLeft: 0, lastWall: null, wallLock: 0,
    dashLeft: 0, dashReady: true, dashCooldown: 0, dashBuffer: 0, dashX: 1, dashY: 0,
    attackTime: 0, cooldown: 0, attackId: 0, hitIds: [], attackBuffer: 0,
    hurtLeft: 0, deathLeft: 0, landingLeft: 0 };
}
export class RunModel {
  state: RunSnapshot;
  events: RunEvent[] = [];
  private paused = false;
  constructor(snapshot?: RunSnapshot, seed = Date.now() >>> 0, options: { height?: number; tutorialComplete?: boolean } = {}) {
    const offset = options.height ?? 0, originY = 686;
    this.state = snapshot ? structuredClone(snapshot) : {
      modelVersion: 2, id: `${Date.now().toString(36)}-${seed.toString(36)}`, seed, nextId: 1, elapsed: 0,
      originY, heightOffset: offset, player: freshPlayer(originY),
      platforms: [{ id: 0, x: 240, y: originY + 24, width: 360, baseX: 240, kind: 'stone', broken: false, crumble: 0, dx: 0 }],
      walls: [], enemies: [], coins: [], cameraY: 0, cameraTarget: 0, topY: originY + 24, generated: 0,
      height: offset, score: 0, earned: 0, kills: 0, combo: 0, bestCombo: 0,
      comboLeft: 0, hitStop: 0, tutorial: options.tutorialComplete ? 5 : 0, tutorialFlags: options.tutorialComplete ? 31 : 0, ended: false, cause: '',
      inputLatch: { jump: false, dash: false, attack: false },
    };
    generateLevel(this.state);
  }
  setPaused(value: boolean) { this.paused = value; }
  step(dt: number, input: Controls) {
    if (this.paused || this.state.ended || dt <= 0 || !Number.isFinite(dt)) return;
    let remaining = Math.min(dt, 0.1);
    while (remaining > 0.000001) { const part = Math.min(RULES.step, remaining); this.advance(part, input); remaining -= part; }
  }
  private advance(dt: number, input: Controls) {
    const s = this.state, p = s.player;
    if (s.ended) return;
    if (input.jump && !s.inputLatch.jump) p.jumpBuffer = RULES.jumpBuffer;
    if (input.attack && !s.inputLatch.attack) p.attackBuffer = 0.18;
    if (input.dash && !s.inputLatch.dash && p.dashReady && p.dashLeft === 0) {
      let dx = input.dashDirection?.x ?? input.direction, dy = input.dashDirection?.y ?? input.vertical;
      if (Math.hypot(dx, dy) < 0.05 && input.aim) { dx = input.aim.x - p.x; dy = input.aim.y - (p.y - s.cameraY); }
      if (Math.hypot(dx, dy) < 0.05) { dx = p.facing * 0.65; dy = -0.76; }
      const length = Math.hypot(dx, dy);
      p.dashX = dx / length; p.dashY = dy / length; p.dashBuffer = 0.16;
    }
    s.inputLatch = { jump: input.jump, dash: input.dash, attack: input.attack };
    // Input edges are recorded even during the brief impact accent.
    if (s.hitStop > 0) { s.hitStop = Math.max(0, s.hitStop - dt); return; }
    s.elapsed += dt;
    if (p.motion === 'dead') {
      p.motionTime += dt; p.deathLeft = Math.max(0, p.deathLeft - dt);
      if (p.deathLeft === 0) { s.ended = true; this.events.push({ type: 'end', x: p.x, y: p.y }); }
      return;
    }
    p.invincible = Math.max(0, p.invincible - dt);
    s.comboLeft = Math.max(0, s.comboLeft - dt);
    if (s.comboLeft === 0) s.combo = 0;
    for (const platform of s.platforms) {
      const oldX = platform.x;
      if (platform.kind === 'cloud') platform.x = platform.baseX + Math.sin(s.elapsed * 1.2 + platform.id) * 22;
      platform.dx = platform.x - oldX;
      if (platform.crumble > 0) { platform.crumble = Math.max(0, platform.crumble - dt); if (platform.crumble === 0) platform.broken = true; }
    }
    movePlayer(s, input, dt, this.events);
    updateCombat(s, input, dt, this.events);
    updateEnemies(s, dt, this.events);
    checkHazards(s, this.events);
    s.tutorial = 0;
    while (s.tutorial < 5 && (s.tutorialFlags & (1 << s.tutorial))) s.tutorial++;
    s.coins = s.coins.filter(coin => {
      if (Math.abs(p.x - coin.x) < 27 && Math.abs(p.y - coin.y) < 38) {
        s.earned++; s.score += RULES.coinScore;
        this.events.push({ type: 'coin', x: coin.x, y: coin.y, amount: 1 }); return false;
      }
      return true;
    });
    s.height = Math.max(s.height, s.heightOffset + Math.max(0, Math.floor((s.originY - p.y) * RULES.heightScale)));
    s.cameraTarget = Math.min(s.cameraTarget, p.y - 430);
    s.cameraY += (s.cameraTarget - s.cameraY) * (1 - Math.exp(-8 * dt));
    generateLevel(s);
    if (p.y > s.cameraY + 870 || p.x < -80 || p.x > 560) {
      setMotion(s, 'dead'); p.health = 0; p.deathLeft = 0.6;
      s.cause = 'Облака поймали тебя. Новый путь начинается с одного прыжка.';
    }
  }
  snapshot(): RunSnapshot { return structuredClone(this.state); }
  drainEvents(): RunEvent[] { return this.events.splice(0); }
}

const finite = (values: unknown[]) => values.every(n => typeof n === 'number' && Number.isFinite(n));
export function restoreCheckpoint(value: unknown): RunSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const s = value as RunSnapshot;
  if (!s.player || typeof s.id !== 'string' || typeof s.ended !== 'boolean' || s.ended || !finite([s.seed, s.elapsed, s.height, s.score, s.earned, s.player.x, s.player.y, s.player.vx, s.player.vy])) return null;
  if (s.modelVersion !== 2) {
    if (s.modelVersion !== undefined) return null;
    // Migrate the old auto-jump run to a safe new ledge; wallet/earned values are not awarded again.
    if (!Array.isArray(s.platforms) || !Array.isArray(s.enemies) || !Array.isArray(s.coins)) return null;
    const migrated = new RunModel(undefined, s.seed, { height: s.height }).snapshot();
    Object.assign(migrated, { id: s.id, elapsed: s.elapsed, score: s.score, earned: s.earned, kills: Number.isFinite(s.kills) ? s.kills : 0, bestCombo: Number.isFinite(s.bestCombo) ? s.bestCombo : 0 });
    return migrated;
  }
  if (!finite([s.nextId, s.originY, s.heightOffset, s.cameraY, s.cameraTarget, s.topY, s.generated, s.combo, s.bestCombo, s.comboLeft, s.hitStop, s.tutorial, s.tutorialFlags])) return null;
  const p = s.player;
  if (!finite([p.health,p.invincible,p.motionTime,p.coyote,p.jumpBuffer,p.wallSide,p.clingLeft,p.wallLock,p.dashLeft,p.dashCooldown,p.dashBuffer,p.dashX,p.dashY,p.attackTime,p.cooldown,p.attackId,p.attackBuffer,p.hurtLeft,p.deathLeft,p.landingLeft,p.facing])) return null;
  if (p.health < 0 || p.health > RULES.maxHealth || typeof p.dashReady !== 'boolean') return null;
  if (![p.grounded,p.wallId,p.lastWall].every(id=>id===null || (typeof id==='number'&&Number.isFinite(id)))) return null;
  if (!['idle','running','jumping','rising','falling','landing','wall_cling','wall_slide','wall_jump','dashing','attacking','hurt','dead'].includes(s.player.motion)) return null;
  if (!Array.isArray(s.platforms) || s.platforms.length > 150 || !s.platforms.every(p => p && ['stone','cloud','fragile','arena'].includes(p.kind) && finite([p.id,p.x,p.y,p.width,p.baseX,p.crumble,p.dx]))) return null;
  if (!Array.isArray(s.walls) || s.walls.length > 150 || !s.walls.every(w => w && finite([w.id,w.x,w.y,w.width,w.height]))) return null;
  if (!Array.isArray(s.enemies) || s.enemies.length > 150 || !s.enemies.every(e => e && ['wisp','moth','oni'].includes(e.kind) && ['idle','move','windup','attack','recover','hurt','dying'].includes(e.state) && typeof e.rewarded==='boolean' && finite([e.id,e.x,e.y,e.baseX,e.baseY,e.hp,e.stateTime,e.reactionLeft,e.cycle,e.vx,e.vy,e.targetX,e.targetY,e.platformId,e.facing]))) return null;
  if (!Array.isArray(s.coins) || s.coins.length > 150 || !s.coins.every(c => c && finite([c.id,c.x,c.y]))) return null;
  if (!s.inputLatch || !['jump','dash','attack'].every(key=>typeof s.inputLatch[key as keyof typeof s.inputLatch]==='boolean') || !Array.isArray(p.hitIds) || p.hitIds.length>150 || !finite(p.hitIds)) return null;
  return structuredClone(s);
}
