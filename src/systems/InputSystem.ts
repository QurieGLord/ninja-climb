import type { Controls } from '../game/RunModel';

export class InputSystem {
  private keys = new Set<string>();
  private directions = new Map<number, number>();
  private target: { id: number; x: number } | null = null;
  private attackQueued = false;
  enabled = false;
  constructor(private stage: HTMLElement, private unlock: () => void, private togglePause: () => void) {
    const gameplayKeys = ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space', 'KeyW', 'ArrowUp', 'Escape', 'KeyP'];
    window.addEventListener('keydown', e => {
      if (!this.enabled || !gameplayKeys.includes(e.code)) return;
      if ((e.target as HTMLElement).closest('button') && ['Space', 'Enter'].includes(e.code)) return;
      e.preventDefault();
      this.unlock();
      this.keys.add(e.code);
      if (!e.repeat && ['Space', 'KeyW', 'ArrowUp'].includes(e.code)) this.attackQueued = true;
      if (!e.repeat && ['Escape', 'KeyP'].includes(e.code)) this.togglePause();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.clear());
    stage.addEventListener('contextmenu', e => e.preventDefault());
    stage.addEventListener('pointerdown', e => {
      if (!this.enabled || e.button > 0) return;
      const element = (e.target as HTMLElement).closest<HTMLElement>('[data-control]');
      if ((e.target as HTMLElement).closest('button') && !element) return;
      this.unlock();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      if (element?.dataset.control === 'left') this.directions.set(e.pointerId, -1);
      else if (element?.dataset.control === 'right') this.directions.set(e.pointerId, 1);
      else if (element?.dataset.control === 'attack') this.attackQueued = true;
      else { this.target = { id: e.pointerId, x: this.toX(e.clientX) }; this.attackQueued = true; }
    });
    stage.addEventListener('pointermove', e => { if (this.target?.id === e.pointerId) this.target.x = this.toX(e.clientX); });
    const release = (e: PointerEvent) => { this.directions.delete(e.pointerId); if (this.target?.id === e.pointerId) this.target = null; };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    stage.addEventListener('lostpointercapture', release);
  }
  private toX(clientX: number) { const r = this.stage.getBoundingClientRect(); return (clientX - r.left) / r.width * 480; }
  read(): Controls {
    const keyboard = Number(this.keys.has('ArrowRight') || this.keys.has('KeyD')) - Number(this.keys.has('ArrowLeft') || this.keys.has('KeyA'));
    const pointer = [...this.directions.values()].reduce((sum, direction) => sum + direction, 0);
    const controls = { direction: Math.max(-1, Math.min(1, keyboard + pointer)), targetX: this.target?.x ?? null, attack: this.attackQueued };
    this.attackQueued = false;
    return controls;
  }
  clear() { this.keys.clear(); this.directions.clear(); this.target = null; this.attackQueued = false; }
}
