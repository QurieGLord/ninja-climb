import Phaser from 'phaser';
import './style.css';
import { VIEW } from './data/config';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { PlayScene } from './scenes/PlayScene';
import { YandexAdapter } from './sdk/YandexAdapter';
import { AudioSystem } from './systems/AudioSystem';
import { InputSystem } from './systems/InputSystem';
import { PauseManager } from './systems/PauseManager';
import { ProgressStore, type StorageLike } from './systems/ProgressStore';
import { GameUI } from './ui/GameUI';
import type { Services } from './game/Services';
import type { RunSnapshot } from './game/RunModel';

const pause = new PauseManager();
const audio = new AudioSystem();
const platform = new YandexAdapter(pause);
// Access to localStorage itself may throw in restricted iframe/privacy modes.
const storage: StorageLike = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
const store = new ProgressStore(storage, platform);
let game: Phaser.Game;
let playing = false, ready = false, previousBest = 0;
let input: InputSystem;
const ui = new GameUI(store, {
  start(resume) {
    audio.unlock();
    pause.set('manual', false);
    input.clear(); input.enabled = true;
    previousBest = store.data.bestHeight;
    playing = true;
    const snapshot = resume ? store.data.activeRun ?? undefined : undefined;
    game.scene.stop('Menu'); game.scene.stop('Play');
    game.scene.start('Play', { snapshot });
    ui.play(); syncPause(); platform.fullscreen();
  },
  menu() {
    if (playing) (game.scene.getScene('Play') as PlayScene).save();
    playing = false; input.enabled = false; input.clear();
    platform.gameplay(false); pause.set('manual', false);
    game.scene.stop('Play'); game.scene.start('Menu');
    ui.menu(); void store.flushCloud();
  },
  pause() { pause.set('manual', !pause.has('manual')); input.clear(); syncPause(); },
  resume() { pause.set('manual', false); audio.unlock(); syncPause(); },
  sound() { store.toggleSound(); audio.enabled = store.data.sound; audio.unlock(); audio.setPaused(pause.paused); },
  async reward() {
    audio.unlock(); ui.rewardBusy(true);
    const result = await platform.rewarded(() => { store.addCoins(25); void store.flushCloud(); });
    ui.rewardBusy(false);
    ui.toast(result === 'rewarded' ? '+25 монет. Сохранено!' : result === 'closed' ? 'Видео закрыто без награды.' : result === 'unavailable' ? 'Видео сейчас недоступно. Попробуй на Яндекс Играх.' : 'Не удалось загрузить видео. Попробуй позже.');
  },
});
input = new InputSystem(ui.stage, () => audio.unlock(), () => { pause.set('manual', !pause.has('manual')); syncPause(); });
audio.enabled = store.data.sound;
function syncPause() {
  audio.setPaused(pause.paused);
  input.clear();
  platform.gameplay(playing && !pause.paused);
  ui.paused(pause.paused, pause.has('manual'), ['blur', 'hidden', 'sdk', 'ad'].some(reason => pause.has(reason as 'blur')));
}
pause.subscribe(syncPause);
pause.bindWindow();
const services: Services = {
  audio, input, store, pause, platform,
  onReady() {
    if (playing) return;
    ui.menu();
    if (!ready) { ready = true; platform.ready(); }
  },
  onRunUpdate(state: RunSnapshot) { ui.update(state); },
  onRunEnd(state: RunSnapshot) {
    playing = false; input.enabled = false; input.clear();
    platform.gameplay(false); ui.result(state, previousBest); void store.flushCloud();
  },
};

window.addEventListener('game-load-error', () => ui.loadingError('Не удалось загрузить ресурсы. Проверь соединение и попробуй снова.'));
window.addEventListener('pagehide', () => { if (playing) (game.scene.getScene('Play') as PlayScene).save(); void store.flushCloud(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && playing) { (game.scene.getScene('Play') as PlayScene).save(); void store.flushCloud(); } });

async function boot() {
  await platform.init();
  await store.loadCloud();
  audio.enabled = store.data.sound;
  ui.sync();
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'canvas', width: VIEW.width, height: VIEW.height,
    backgroundColor: '#173a46',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: false },
    audio: { noAudio: true },
    scene: [BootScene, MenuScene, PlayScene],
    callbacks: { preBoot: g => g.registry.set('services', services) },
  });
}
void boot().catch(() => ui.loadingError('Не удалось запустить игру. Обнови страницу и попробуй снова.'));
