import { ENEMY_TYPES, RULES } from '../data/config';
import { intersects, playerBox } from './collision';
import { setMotion } from './movement';
import type { Controls, Enemy, Rect, RunEvent, RunSnapshot } from './types';
export function bladeBox(s: RunSnapshot): Rect {
  const p = s.player;
  return { x: p.facing > 0 ? p.x + 8 : p.x - 8 - RULES.attackReach, y: p.y - 30, width: RULES.attackReach, height: RULES.attackHeight };
}
export function enemyBox(e: Enemy): Rect {
  const r = ENEMY_TYPES[e.kind].radius;
  return { x: e.x - r, y: e.y - (e.kind === 'oni' ? 38 : 24), width: r * 2, height: e.kind === 'oni' ? 76 : 48 };
}
export function hurtPlayer(s: RunSnapshot, fromX: number, events: RunEvent[], cause: string) {
  const p = s.player;
  if (p.invincible > 0 || p.motion === 'dead' || p.dashLeft > 0) return;
  p.health--; p.invincible = RULES.invulnerability; p.hurtLeft = 0.25;
  p.vx = (p.x < fromX ? -1 : 1) * 230; p.vy = -180;
  p.attackTime = 0; p.dashLeft = 0; p.grounded = null;
  s.combo = 0; s.comboLeft = 0;
  setMotion(s, p.health > 0 ? 'hurt' : 'dead');
  if (p.health <= 0) { p.deathLeft = 0.6; s.cause = cause; }
  events.push({ type: 'hurt', x: p.x, y: p.y });
}
export function updateCombat(s: RunSnapshot, input: Controls, dt: number, events: RunEvent[]) {
  const p = s.player;
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.attackBuffer = Math.max(0, p.attackBuffer - dt);
  if (p.attackTime > 0) p.attackTime = Math.max(0, p.attackTime - dt);
  if (p.attackBuffer > 0 && p.cooldown === 0 && p.dashLeft === 0 && p.hurtLeft === 0) {
    if (input.aim && Math.abs(input.aim.x - p.x) > 8) p.facing = Math.sign(input.aim.x - p.x);
    p.attackTime = RULES.attackDuration; p.cooldown = RULES.attackCooldown;
    p.attackBuffer = 0; p.attackId++; p.hitIds = [];
    setMotion(s, 'attacking');
    events.push({ type: 'attack', x: p.x, y: p.y });
  }
  const time = RULES.attackDuration - p.attackTime;
  if (p.attackTime <= 0 || time < RULES.attackStart || time > RULES.attackEnd) return;
  const blade = bladeBox(s);
  for (const e of s.enemies) {
    if (e.hp <= 0 || p.hitIds.includes(e.id) || !intersects(blade, enemyBox(e))) continue;
    p.hitIds.push(e.id);
    if (e.kind === 'oni' && e.state !== 'recover' && e.state !== 'hurt') {
      events.push({ type: 'block', x: e.x, y: e.y }); continue;
    }
    e.hp--; e.reactionLeft = 0.16;
    if (e.hp <= 0) { e.stateTime = 0; e.state = 'dying'; }
    else if (e.kind !== 'oni') { e.stateTime = 0; e.state = 'hurt'; }
    e.vx = p.facing * 70;
    s.hitStop = RULES.hitStop;
    s.tutorialFlags |= 16;
    if (p.grounded === null) {
      s.combo++; s.comboLeft = RULES.comboWindow; s.bestCombo = Math.max(s.bestCombo, s.combo);
      p.dashReady = true; p.dashCooldown = 0; p.vy = Math.min(p.vy, -RULES.airHitLift);
    }
    events.push({ type: 'hit', x: e.x, y: e.y });
    if (e.hp <= 0 && !e.rewarded) {
      e.rewarded = true; s.kills++;
      const amount = ENEMY_TYPES[e.kind].coins;
      s.earned += amount;
      s.score += (e.kind === 'oni' ? RULES.bossScore : RULES.enemyScore) * Math.max(1, Math.min(s.combo, 5));
      events.push({ type: e.kind === 'oni' ? 'boss' : 'kill', x: e.x, y: e.y, amount, combo: s.combo });
    }
  }
}
export function checkHazards(s: RunSnapshot, events: RunEvent[]) {
  const box = playerBox(s.player);
  for (const wall of s.walls) {
    if (wall.hazard && intersects({ ...box, x: box.x - 2, width: box.width + 4 }, wall)) hurtPlayer(s, wall.x + wall.width / 2, events, 'Электрическая стена прервала путь.');
  }
}
