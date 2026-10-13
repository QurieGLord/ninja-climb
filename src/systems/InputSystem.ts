import { IDLE_INPUT, type Controls } from '../game/types';
export class InputSystem {
  private keys = new Set<string>();
  private held = new Map<number, string>();
  private captures = new Map<number, HTMLElement>();
  private target: { id: number; x: number; y: number } | null = null;
  private queued = { jump: false, dash: false, attack: false };
  private queuedAim: { x: number; y: number } | null = null;
  private queuedDashDirection: { x: number; y: number } | null = null;
  enabled = false;
  constructor(private stage: HTMLElement, private unlock: () => void, private togglePause: () => void) {
    const accepted = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyA','KeyD','KeyW','KeyS','Space','ShiftLeft','ShiftRight','KeyJ','Escape','KeyP'];
    window.addEventListener('keydown', e => {
      if (!this.enabled || !accepted.includes(e.code)) return;
      if ((e.target as HTMLElement).closest('button') && e.code === 'Space') return;
      e.preventDefault(); this.unlock(); this.keys.add(e.code);
      if (!e.repeat) {
        if (e.code === 'Space') this.queued.jump = true;
        if (e.code.startsWith('Shift')) { this.queued.dash = true; this.queuedDashDirection = this.directionNow(); }
        if (e.code === 'KeyJ') this.queued.attack = true;
        this.queuedAim = null;
        if (['Escape','KeyP'].includes(e.code)) this.togglePause();
      }
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.clear());
    window.addEventListener('pagehide', () => this.clear());
    stage.addEventListener('contextmenu', e => e.preventDefault());
    stage.addEventListener('pointerdown', e => {
      if (!this.enabled) return;
      const button = (e.target as HTMLElement).closest<HTMLElement>('[data-control]');
      if ((e.target as HTMLElement).closest('button') && !button) return;
      this.unlock(); e.preventDefault();
      const element = button ?? e.target as HTMLElement;
      element.setPointerCapture(e.pointerId); this.captures.set(e.pointerId, element);
      const action = button?.dataset.control;
      if (action) {
        this.held.set(e.pointerId, action);
        if (action === 'jump' || action === 'dash' || action === 'attack') this.queued[action] = true;
        if (action === 'dash') this.queuedDashDirection = this.directionNow();
        this.queuedAim = action === 'dash' && this.target ? { x: this.target.x, y: this.target.y } : null;
      } else {
        const point = this.toPoint(e.clientX, e.clientY);
        this.target = { id: e.pointerId, ...point }; this.queuedAim = point;
        if (e.pointerType === 'mouse') {
          if (e.button === 2) { this.queued.dash = true; this.queuedDashDirection = null; }
          else if (e.button === 1) this.queued.jump = true;
          else this.queued.attack = true;
        }
      }
    });
    stage.addEventListener('pointermove', e => {
      if (this.target?.id === e.pointerId) Object.assign(this.target, this.toPoint(e.clientX, e.clientY));
    });
    const release = (e: PointerEvent) => {
      this.held.delete(e.pointerId); this.captures.delete(e.pointerId);
      if (this.target?.id === e.pointerId) this.target = null;
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    stage.addEventListener('lostpointercapture', release);
  }
  private toPoint(clientX: number, clientY: number) {
    const r = this.stage.getBoundingClientRect();
    return { x: (clientX - r.left) / r.width * 480, y: (clientY - r.top) / r.height * 800 };
  }
  private directionNow() {
    const held=[...this.held.values()];
    return { x: Number(this.keys.has('ArrowRight') || this.keys.has('KeyD') || held.includes('right')) - Number(this.keys.has('ArrowLeft') || this.keys.has('KeyA') || held.includes('left')),
      y: Number(this.keys.has('ArrowDown') || this.keys.has('KeyS')) - Number(this.keys.has('ArrowUp') || this.keys.has('KeyW')) };
  }
  read(): Controls {
    if (!this.enabled) return { ...IDLE_INPUT };
    const keyboard = Number(this.keys.has('ArrowRight') || this.keys.has('KeyD')) - Number(this.keys.has('ArrowLeft') || this.keys.has('KeyA'));
    const vertical = Number(this.keys.has('ArrowDown') || this.keys.has('KeyS')) - Number(this.keys.has('ArrowUp') || this.keys.has('KeyW'));
    const actions = [...this.held.values()];
    const pointer = Number(actions.includes('right')) - Number(actions.includes('left'));
    const result: Controls = {
      direction: Math.max(-1, Math.min(1, keyboard + pointer)), vertical,
      targetX: this.target?.x ?? null,
      aim: keyboard || vertical ? null : this.target ?? this.queuedAim,
      dashDirection: this.queuedDashDirection,
      jump: this.queued.jump, jumpHeld: this.keys.has('Space') || actions.includes('jump'),
      dash: this.queued.dash, attack: this.queued.attack,
    };
    this.queued = { jump: false, dash: false, attack: false }; this.queuedAim = null;
    this.queuedDashDirection = null;
    return result;
  }
  clear() {
    this.keys.clear(); this.held.clear(); this.target = null; this.queuedAim = null;
    this.queuedDashDirection = null;
    this.queued = { jump: false, dash: false, attack: false };
    for (const [id, element] of [...this.captures]) if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
    this.captures.clear();
  }
}
