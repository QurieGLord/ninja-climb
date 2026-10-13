export class AudioSystem {
  private context?: AudioContext;
  private master?: GainNode;
  private paused = false;
  enabled = true;
  unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.14;
      this.master.connect(this.context.destination);
    }
    if (!this.paused && this.enabled) void this.context.resume().catch(() => {});
  }
  setPaused(value: boolean) {
    this.paused = value;
    if (!this.context) return;
    if (value || !this.enabled) void this.context.suspend().catch(() => {});
    else void this.context.resume().catch(() => {});
  }
  play(kind: 'jump' | 'attack' | 'coin' | 'kill' | 'boss' | 'hurt' | 'end') {
    if (!this.context || !this.master || this.paused || !this.enabled) return;
    const frequencies = { jump: 390, attack: 190, coin: 950, kill: 570, boss: 720, hurt: 100, end: 140 };
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const t = this.context.currentTime;
    osc.type = kind === 'attack' || kind === 'hurt' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(frequencies[kind], t);
    osc.frequency.exponentialRampToValueAtTime(frequencies[kind] * (kind === 'hurt' || kind === 'end' ? 0.35 : 1.55), t + 0.13);
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain); gain.connect(this.master);
    osc.start(t); osc.stop(t + 0.2);
  }
}
