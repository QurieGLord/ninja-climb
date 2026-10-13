import { RULES } from '../data/config';
import { moveAndCollide } from './collision';
import type { Controls, Motion, RunEvent, RunSnapshot } from './types';
const approach = (n: number, target: number, delta: number) => n < target ? Math.min(target, n + delta) : Math.max(target, n - delta);
export function setMotion(s: RunSnapshot, motion: Motion) {
  if (s.player.motion !== motion) { s.player.motion = motion; s.player.motionTime = 0; }
}
export function movePlayer(s: RunSnapshot, input: Controls, dt: number, events: RunEvent[]) {
  const p = s.player;
  p.motionTime += dt;
  for (const key of ['coyote', 'jumpBuffer', 'wallLock', 'dashCooldown', 'dashBuffer', 'hurtLeft', 'landingLeft'] as const) p[key] = Math.max(0, p[key] - dt);
  let direction = Math.max(-1, Math.min(1, input.direction));
  if (!direction && input.targetX !== null) direction = Math.max(-1, Math.min(1, (input.targetX - p.x) / 26));
  const oldGround = p.grounded, oldWall = s.walls.find(w => w.id === p.wallId);
  if (oldGround !== null) { p.coyote = RULES.coyoteTime; p.dashReady = true; p.lastWall = null; }
  if (direction !== 0 && p.hurtLeft === 0 && p.wallLock === 0) p.facing = Math.sign(direction);
  if (p.jumpBuffer > 0 && p.dashLeft === 0 && p.hurtLeft === 0) {
    if (oldWall?.grip && !oldWall.hazard && oldGround === null) {
      p.vy = -RULES.jumpSpeed; p.vx = -p.wallSide * RULES.wallJumpSpeed;
      p.facing = -p.wallSide; p.wallLock = RULES.wallJumpLock;
      p.jumpBuffer = 0; p.coyote = 0; p.wallId = null; p.clingLeft = 0;
      setMotion(s, 'wall_jump'); s.tutorialFlags |= 4;
      events.push({ type: 'wall', x: p.x, y: p.y });
    } else if (p.coyote > 0) {
      p.vy = -RULES.jumpSpeed; p.jumpBuffer = 0; p.coyote = 0; p.grounded = null;
      setMotion(s, 'jumping'); s.tutorialFlags |= 2;
      events.push({ type: 'jump', x: p.x, y: p.y });
    }
  }
  if (p.dashBuffer > 0 && p.dashReady && p.dashCooldown === 0 && p.hurtLeft === 0) {
    p.dashLeft = RULES.dashDuration; p.dashCooldown = RULES.dashCooldown;
    p.dashReady = false; p.attackTime = 0; p.grounded = null;
    p.dashBuffer = 0;
    if (Math.abs(p.dashX) > 0.1) p.facing = Math.sign(p.dashX);
    setMotion(s, 'dashing'); s.tutorialFlags |= 8;
    events.push({ type: 'dash', x: p.x, y: p.y });
  }
  const dashing = p.dashLeft > 0;
  if (dashing) { p.vx = p.dashX * RULES.dashSpeed; p.vy = p.dashY * RULES.dashSpeed; }
  else {
    if (p.hurtLeft === 0 && p.wallLock === 0) p.vx = approach(p.vx, direction * RULES.moveSpeed, (direction ? (oldGround !== null ? RULES.groundAcceleration : RULES.airAcceleration) : RULES.braking) * dt);
    if (!input.jumpHeld && p.vy < -RULES.jumpCutSpeed && p.motion !== 'wall_jump') p.vy = -RULES.jumpCutSpeed;
    p.vy = Math.min(850, p.vy + RULES.gravity * dt);
    if (oldWall?.grip && !oldWall.hazard && oldGround === null && p.wallLock === 0 && direction * p.wallSide > 0) {
      if (p.lastWall !== oldWall.id) { p.clingLeft = RULES.clingDuration; p.lastWall = oldWall.id; }
      if (p.vy >= -80) {
        if (p.clingLeft > 0) { p.vy = 0; p.clingLeft = Math.max(0, p.clingLeft - dt); setMotion(s, 'wall_cling'); }
        else { p.vy = Math.min(p.vy, RULES.wallSlideSpeed); setMotion(s, 'wall_slide'); }
        s.tutorialFlags |= 4;
      }
    }
  }
  const carry = s.platforms.find(platform => platform.id === oldGround);
  if (carry && p.grounded !== null) p.x += carry.dx;
  const result = moveAndCollide(p, dt, s.platforms, s.walls);
  if (result.landed) {
    p.dashReady = true; p.coyote = RULES.coyoteTime; p.landingLeft = 0.09;
    s.combo = 0; s.comboLeft = 0;
    events.push({ type: 'land', x: p.x, y: p.y + RULES.playerHalfHeight });
    const platform = s.platforms.find(platform => platform.id === p.grounded);
    if (platform?.kind === 'fragile' && platform.crumble === 0) platform.crumble = 0.9;
  }
  if (dashing) {
    p.dashLeft = Math.max(0, p.dashLeft - dt);
    if (result.hitWall || result.ceiling || result.landed) p.dashLeft = 0;
    if (p.dashLeft === 0) { p.vx *= 0.28; p.vy = Math.max(-180, Math.min(180, p.vy * 0.2)); }
  }
  if (p.hurtLeft > 0) setMotion(s, 'hurt');
  else if (p.dashLeft > 0) setMotion(s, 'dashing');
  else if (p.attackTime > 0) setMotion(s, 'attacking');
  else if (p.grounded !== null) setMotion(s, p.landingLeft > 0 ? 'landing' : Math.abs(p.vx) > 8 ? 'running' : 'idle');
  else if (result.hitWall?.grip && !result.hitWall.hazard && direction * p.wallSide > 0 && p.vy >= 0 && p.wallLock === 0) setMotion(s, p.clingLeft > 0 ? 'wall_cling' : 'wall_slide');
  else if ((p.motion === 'jumping' || p.motion === 'wall_jump') && p.motionTime < 0.1) { /* retain articulated takeoff */ }
  else setMotion(s, p.vy < 0 ? 'rising' : 'falling');
  if (Math.abs(p.x - 240) > 35) s.tutorialFlags |= 1;
  return result;
}
