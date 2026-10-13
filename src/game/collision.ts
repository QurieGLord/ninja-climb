import { RULES } from '../data/config';
import type { Rect, Player, Platform, Wall } from './types';
export const intersects = (a: Rect, b: Rect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
export const playerBox = (p: Player): Rect => ({ x: p.x - RULES.playerRadius, y: p.y - RULES.playerHalfHeight, width: RULES.playerRadius * 2, height: RULES.playerHalfHeight * 2 });
export const platformBox = (p: Platform): Rect => ({ x: p.x - p.width / 2, y: p.y, width: p.width, height: 18 });
export function moveAndCollide(p: Player, dt: number, platforms: Platform[], walls: Wall[]) {
  const oldX = p.x, oldY = p.y, oldVX = p.vx;
  const oldBottom = oldY + RULES.playerHalfHeight, oldGround = p.grounded;
  p.grounded = null; p.wallId = null; p.wallSide = 0;
  let x = oldX + p.vx * dt, y = oldY + p.vy * dt;
  const half = RULES.playerRadius, tall = RULES.playerHalfHeight;
  let hitWall: Wall | undefined;
  // Crossed planes are swept, including high-speed dash steps.
  for (const w of walls) {
    if (oldY + tall <= w.y || oldY - tall >= w.y + w.height) continue;
    if (p.vx > 0 && oldX + half <= w.x + 0.01 && x + half >= w.x) {
      x = Math.min(x, w.x - half); hitWall = w; p.wallSide = 1;
    } else if (p.vx < 0 && oldX - half >= w.x + w.width - 0.01 && x - half <= w.x + w.width) {
      x = Math.max(x, w.x + w.width + half); hitWall = w; p.wallSide = -1;
    }
  }
  p.x = x;
  let ceiling = false;
  if (p.vy >= 0) {
    let floorY = Infinity, floorId: number | null = null;
    for (const surface of platforms) {
      if (surface.broken || Math.abs(x - surface.x) >= surface.width / 2 + half - 2) continue;
      if (oldBottom <= surface.y + 0.1 && y + tall >= surface.y && surface.y < floorY) { floorY = surface.y; floorId = surface.id; }
      if (oldGround === surface.id && Math.abs(oldBottom - surface.y) < 1) { floorY = Math.min(floorY, surface.y); floorId = surface.id; }
    }
    for (const w of walls) {
      if (x + half <= w.x || x - half >= w.x + w.width) continue;
      if (oldBottom <= w.y + 0.01 && y + tall >= w.y && w.y < floorY) { floorY = w.y; floorId = -w.id - 1; }
    }
    if (floorId !== null) { y = floorY - tall; p.vy = 0; p.grounded = floorId; }
  } else {
    for (const w of walls) {
      if (x + half <= w.x || x - half >= w.x + w.width) continue;
      if (oldY - tall >= w.y + w.height - 0.01 && y - tall <= w.y + w.height) { y = Math.max(y, w.y + w.height + tall); ceiling = true; }
    }
    if (ceiling) p.vy = 0;
  }
  p.y = y;
  for (const w of walls) {
    if (y + tall <= w.y || y - tall >= w.y + w.height) continue;
    if (Math.abs(x + half - w.x) < 0.2) { hitWall = w; p.wallSide = 1; }
    else if (Math.abs(x - half - w.x - w.width) < 0.2) { hitWall = w; p.wallSide = -1; }
  }
  if (hitWall) { p.wallId = hitWall.id; p.vx = 0; }
  return { hitWall, landed: p.grounded !== null && oldGround === null, ceiling, collidedX: x !== oldX + oldVX * dt };
}
