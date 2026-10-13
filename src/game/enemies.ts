import { ENEMY_TYPES } from '../data/config';
import { intersects, playerBox } from './collision';
import { enemyBox, hurtPlayer } from './combat';
import type { Enemy, RunEvent, RunSnapshot } from './types';
function change(e: Enemy, state: Enemy['state']) { e.state = state; e.stateTime = 0; }
export function updateEnemies(s: RunSnapshot, dt: number, events: RunEvent[]) {
  const p = s.player;
  for (const e of s.enemies) {
    e.stateTime += dt; e.reactionLeft = Math.max(0, e.reactionLeft - dt);
    if (e.state === 'dying') continue;
    if (e.state === 'hurt') { e.x += e.vx * dt; e.vx *= 0.9; if (e.stateTime > 0.16) change(e, 'recover'); continue; }
    const distance = Math.hypot(p.x - e.x, p.y - e.y);
    // Off-screen entities do not silently consume their attack cycles.
    if (e.y < s.cameraY - 100 || e.y > s.cameraY + 900) continue;
    const phase2 = e.kind === 'oni' && e.hp <= 3;
    if (e.state === 'idle' || e.state === 'move') {
      if (e.kind === 'moth') {
        e.x = e.baseX + Math.sin(s.elapsed * 1.7 + e.id) * 42;
        e.y = e.baseY + Math.sin(s.elapsed * 2 + e.id) * 15;
        e.facing = p.x < e.x ? -1 : 1;
      } else {
        const platform = s.platforms.find(platform => platform.id === e.platformId);
        const range = e.kind === 'oni' ? 90 : Math.max(20, (platform?.width ?? 130) / 2 - 27);
        const speed = e.kind === 'oni' ? 32 : 42;
        e.x += e.facing * speed * dt;
        const center = platform?.x ?? e.baseX;
        if (e.x < center - range) e.facing = 1;
        if (e.x > center + range) e.facing = -1;
        e.y = (platform?.y ?? e.baseY + (e.kind === 'oni' ? 38 : 26)) - (e.kind === 'oni' ? 38 : 26);
        e.state = 'move';
      }
      if (distance < (e.kind === 'oni' ? 260 : e.kind === 'moth' ? 230 : 130) && Math.abs(p.y - e.y) < (e.kind === 'moth' ? 220 : 110)) {
        e.facing = p.x < e.x ? -1 : 1; e.targetX = p.x; e.targetY = p.y;
        change(e, 'windup'); events.push({ type: 'warning', x: e.x, y: e.y });
      }
    } else if (e.state === 'windup') {
      const windup = ENEMY_TYPES[e.kind].windup * (phase2 ? 0.75 : 1);
      if (e.stateTime >= windup) {
        change(e, 'attack'); e.cycle++;
        if (e.kind === 'moth') {
          const length = Math.hypot(e.targetX - e.x, e.targetY - e.y) || 1;
          e.vx = (e.targetX - e.x) / length * 300; e.vy = (e.targetY - e.y) / length * 300;
        }
      }
    } else if (e.state === 'attack') {
      if (e.kind === 'moth') { e.x += e.vx * dt; e.y += e.vy * dt; }
      else if (phase2 && e.cycle % 2 === 0) e.x = Math.max(86, Math.min(394, e.x + e.facing * 220 * dt));
      const reach = e.kind === 'oni' ? 145 : 57;
      const strike = e.kind === 'moth' ? enemyBox(e) : { x: e.facing > 0 ? e.x + 8 : e.x - reach, y: e.y - 34, width: reach, height: e.kind === 'oni' ? 75 : 60 };
      if (e.stateTime > 0.06 && e.stateTime < 0.24 && intersects(playerBox(p), strike)) hurtPlayer(s, e.x, events, 'Страж оказался быстрее. Найди окно после его удара.');
      if (e.stateTime > (e.kind === 'moth' ? 0.4 : 0.3)) change(e, 'recover');
    } else if (e.state === 'recover') {
      if (e.kind === 'moth') { e.x += (e.baseX - e.x) * Math.min(1, dt * 3); e.y += (e.baseY - e.y) * Math.min(1, dt * 3); }
      if (e.stateTime > ENEMY_TYPES[e.kind].recover * (phase2 ? 0.85 : 1)) change(e, 'idle');
    }
    if (e.kind !== 'oni' && e.state !== 'recover' && e.state !== 'windup' && intersects(playerBox(p), enemyBox(e))) hurtPlayer(s, e.x, events, 'Противник прервал восхождение.');
  }
}
