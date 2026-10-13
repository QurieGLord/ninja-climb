export type PauseReason = 'manual' | 'blur' | 'hidden' | 'sdk' | 'ad';
export class PauseManager {
  private reasons = new Set<PauseReason>();
  private listeners = new Set<(paused: boolean) => void>();
  get paused() { return this.reasons.size > 0; }
  has(reason: PauseReason) { return this.reasons.has(reason); }
  set(reason: PauseReason, value: boolean) {
    if (this.reasons.has(reason) === value) return;
    if (value) this.reasons.add(reason); else this.reasons.delete(reason);
    this.listeners.forEach(listener => listener(this.paused));
  }
  subscribe(listener: (paused: boolean) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  bindWindow() {
    window.addEventListener('blur', () => this.set('blur', true));
    window.addEventListener('focus', () => this.set('blur', false));
    document.addEventListener('visibilitychange', () => {
      this.set('hidden', document.hidden);
      if (!document.hidden && document.hasFocus()) this.set('blur', false);
    });
    this.set('hidden', document.hidden);
  }
}
