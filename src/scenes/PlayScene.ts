import Phaser from 'phaser';
import { RunModel, type RunSnapshot } from '../game/RunModel';
import type { Services } from '../game/Services';
import { WorldView } from '../rendering/WorldView';

export class PlayScene extends Phaser.Scene {
  model!: RunModel;
  private world!: WorldView;
  private services!: Services;
  private accumulator = 0;
  private lastCheckpoint = 0;
  private lastBestHeight = 0;
  private lastScore = 0;
  private pendingAttack = false;
  constructor() { super('Play'); }
  create(data: { snapshot?: RunSnapshot }) {
    this.services = this.registry.get('services') as Services;
    this.model = new RunModel(data.snapshot);
    this.accumulator = 0;
    this.pendingAttack = false;
    this.lastCheckpoint = 0;
    this.lastBestHeight = this.services.store.data.bestHeight;
    this.lastScore = this.model.state.score;
    this.world = new WorldView(this, this.services.store.data.selectedSkin);
    if (!data.snapshot) this.services.store.beginRun(this.model.snapshot());
    this.world.render(this.model.state);
    this.services.onRunUpdate(this.model.state);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.save());
  }
  save() { if (this.model) this.services.store.checkpoint(this.model.snapshot()); }
  update(_time: number, delta: number) {
    if (this.services.pause.paused || this.model.state.ended) { this.accumulator = 0; this.pendingAttack = false; this.tweens.timeScale = 0; return; }
    this.tweens.timeScale = 1;
    this.accumulator += Math.min(delta / 1000, 0.08);
    const controls = this.services.input.read();
    this.pendingAttack ||= controls.attack;
    controls.attack = this.pendingAttack;
    while (this.accumulator >= 1 / 120) {
      this.model.step(1 / 120, controls);
      controls.attack = false;
      this.pendingAttack = false;
      this.accumulator -= 1 / 120;
    }
    let earned = 0;
    for (const event of this.model.drainEvents()) {
      const y = event.y - this.model.state.cameraY;
      this.services.audio.play(event.type);
      if ('amount' in event) {
        earned += event.amount;
        this.world.burst(event.x, y, event.type === 'coin' ? 0xefca7f : 0xe78571);
        this.world.floating(event.x, y - 20, event.type === 'coin' ? '+1' : event.type === 'boss' ? `ОНИ ПОВЕРЖЕН! +${event.amount}` : `КОМБО ×${event.combo}  +${event.amount}`);
      } else if (event.type === 'jump') this.world.burst(event.x, y, 0xaac8b4);
      else if (event.type === 'hurt') { this.cameras.main.shake(140, 0.008); this.world.floating(event.x, y - 28, 'ОСТОРОЖНО!', '#f39b85'); }
    }
    const s = this.model.state;
    // Currency + corresponding checkpoint are one write, preventing replay on reload.
    if (earned > 0 || s.height > this.lastBestHeight || s.score !== this.lastScore || s.elapsed - this.lastCheckpoint > 0.75 || s.ended) {
      this.services.store.checkpoint(this.model.snapshot(), earned);
      this.lastCheckpoint = s.elapsed;
      this.lastBestHeight = Math.max(this.lastBestHeight, s.height);
      this.lastScore = s.score;
    }
    this.world.render(s);
    this.services.onRunUpdate(s);
    if (s.ended) this.services.onRunEnd(s);
  }
}
