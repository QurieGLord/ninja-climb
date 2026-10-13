import { SKINS, RULES, zoneAt, type SkinId } from '../data/config';
import type { RunSnapshot } from '../game/RunModel';
import type { ProgressStore } from '../systems/ProgressStore';

const paths: Record<string, string> = {
  jump: '<path d="M12 20V4m-6 6 6-6 6 6"/>',
  dash: '<path d="m13 2-8 12h7l-1 8L21 9h-8l0-7Z"/>',
  sound: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 6 6m0-6-6 6"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  left: '<path d="m15 5-7 7 7 7"/>', right: '<path d="m9 5 7 7-7 7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  coin: '<circle cx="12" cy="12" r="8"/><path d="M10 10h4v4h-4z"/>',
  trophy: '<path d="M8 3h8v7a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v6m-4 0h8"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  sword: '<path d="m5 19 3-3m-2-3 5 5m-3-3L18 4l3-1-1 3L10 17"/>',
  play: '<path d="m9 5 11 7-11 7V5Z"/>',
  cloud: '<path d="M6 17a4 4 0 0 1-1-8 6 6 0 0 1 11-2 5 5 0 1 1 2 10H6Z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.1"/>',
};
export const icon = (name: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.cloud}</svg>`;
interface Actions { start(resume: boolean): void; menu(): void; pause(): void; resume(): void; sound(): void; reward(): Promise<void> }

export class GameUI {
  stage: HTMLElement;
  private overlay: HTMLElement;
  private mode: 'loading' | 'menu' | 'play' | 'result' = 'loading';
  private dialog?: HTMLElement;
  private previousFocus?: HTMLElement;
  constructor(private store: ProgressStore, private actions: Actions) {
    document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
      <main class="shell">
        <aside class="side side-left" aria-label="Ninja Climb">
          <a class="brand" href="#" aria-label="Ninja Climb — главное меню"><span class="brand-mark">忍</span><span>NINJA CLIMB<small>THE SKY IS ONLY THE BEGINNING</small></span></a>
          <div class="manifest"><span class="eyebrow"><i></i> ВЕРТИКАЛЬНАЯ АРКАДА</span><p>Выше<br>облаков.<br><em>Ближе<br>к себе.</em></p><div class="fine-line"></div><span class="manifest-note">Один прыжок.<br>Тысяча возможностей.</span></div>
          <div class="edition"><span>01 / НЕБЕСНЫЙ ХРАМ</span><span class="edition-line"></span><span>2026</span></div>
        </aside>
        <section id="stage" aria-label="Игровое поле Ninja Climb">
          <div id="canvas"></div>
          <div id="overlay">
            <div id="loader" class="loader"><span class="seal">忍</span><h2>Путь начинается</h2><p>Пробуждаем небесный храм…</p><span class="loading-line"></span></div>
            <header id="game-top" class="game-top hidden"><span class="tiny-logo">忍 <b>NINJA CLIMB</b></span><div class="top-actions"><button id="sound" class="icon-button" aria-label="Выключить звук">${icon('sound')}</button><button id="pause" class="icon-button hidden" aria-label="Пауза">${icon('pause')}</button></div></header>
            <section id="menu" class="menu hidden">
              <div class="menu-copy"><div class="eyebrow">ПУТЬ В ОБЛАКА</div><h1>NINJA<br><span>CLIMB</span><span class="title-dot">.</span></h1><p>Прыжок за прыжком.<br>Стань легендой небесного храма.</p></div>
              <div class="menu-bottom"><div class="menu-records"><span>${icon('trophy')} <b id="menu-best">0</b> м <small>РЕКОРД</small></span><span>${icon('coin')} <b class="wallet">0</b> <small>МОНЕТЫ</small></span></div>
                <button id="start" class="button primary">Начать восхождение ${icon('arrow')}</button>
                <button id="new-run" class="text-button hidden">Начать новый забег</button>
                <div class="secondary-row"><button id="skins" class="button secondary"><span class="skin-dot"></span> Облик</button><button id="help" class="button secondary">${icon('help')} Как играть</button></div>
              </div>
            </section>
            <section id="hud" class="hud hidden" aria-label="Результат забега"><div class="height-block"><span id="zone" class="eyebrow">ТИХАЯ РОЩА</span><div><b id="height">0</b><span>м</span></div></div><div class="run-stats"><span>${icon('coin')} <b id="run-coins">0</b></span><small>ОЧКИ <b id="score">0</b></small></div></section>
            <div id="vitals" class="vitals hidden" aria-label="Здоровье"></div><div id="boss-hud" class="boss-hud hidden"><b>СТРАЖ ГРОЗЫ</b><span id="boss-phase"></span><div><i id="boss-health"></i></div></div><div id="combo" class="combo hidden"></div>
            <div id="play-hint" class="play-hint hidden">Первый шаг — за тобой.</div>
            <nav id="controls" class="controls hidden" aria-label="Управление"><div class="move-controls"><button class="control direction" data-control="left" aria-label="Влево">${icon('left')}</button><button class="control direction" data-control="right" aria-label="Вправо">${icon('right')}</button></div><div class="action-controls"><button class="control dash" data-control="dash" aria-label="Рывок">${icon('dash')}<span>РЫВОК</span></button><button class="control jump" data-control="jump" aria-label="Прыжок">${icon('jump')}<span>ПРЫЖОК</span></button><button class="control attack" data-control="attack" aria-label="Атаковать">${icon('sword')}<span>УДАР</span></button></div></nav>
            <section id="pause-overlay" class="veil hidden"><div class="pause-panel"><span class="seal">静</span><div class="eyebrow">ВДОХ. ВЫДОХ.</div><h2>Мгновение тишины</h2><p id="pause-note">Храм подождёт.</p><button id="resume" class="button primary">Продолжить ${icon('play')}</button><button id="pause-menu" class="button secondary">В меню · сохранить забег</button></div></section>
            <section id="result" class="veil hidden"><div class="result-panel"><div class="eyebrow">ЕЩЁ НА ШАГ БЛИЖЕ К НЕБУ</div><h2>Хороший полёт<span>.</span></h2><div class="result-height"><b id="result-height">0</b> м</div><div id="new-record" class="record-badge hidden">${icon('trophy')} НОВАЯ ВЫСОТА</div><p id="result-cause"></p><div class="result-grid"><div><small>ОЧКИ</small><b id="result-score">0</b></div><div><small>МОНЕТЫ</small><b id="result-coins">+0</b></div><div><small>КОМБО</small><b id="result-combo">×0</b></div></div><button id="retry" class="button primary">Ещё один прыжок ${icon('arrow')}</button><button id="reward" class="button secondary">${icon('play')} +25 монет за видео</button><button id="result-menu" class="text-button">Вернуться в меню</button></div></section>
            <div id="toast" role="status" class="toast hidden"></div>
            <div id="dialog-root"></div>
          </div>
        </section>
        <aside class="side side-right"><div class="chapter"><span class="chapter-number">壱</span><span class="eyebrow">ГЛАВА ПЕРВАЯ</span><h2>Вершина<br>внутри тебя.</h2><p>Там, где заканчивается земля,<br>начинается твой путь.</p></div><div class="guide"><div class="eyebrow">ИСКУССТВО ПОЛЁТА</div><div><span class="guide-icon">${icon('arrow')}</span><p><b>Направляй прыжок</b><small>← → / A D · Space — прыжок</small></p></div><div><span class="guide-icon">${icon('sword')}</span><p><b>Атакуй в воздухе</b><small>J — катана · Shift — рывок</small></p></div><div><span class="guide-icon">${icon('cloud')}</span><p><b>Продолжай комбо</b><small>Воздушное попадание возвращает рывок</small></p></div></div><div class="save-info">${icon('cloud')}<span id="save-status">Прогресс на устройстве</span></div></aside>
      </main>`;
    this.stage = document.querySelector('#stage')!;
    this.overlay = document.querySelector('#overlay')!;
    const bind = (id: string, fn: () => void) => this.el(id).addEventListener('click', fn);
    bind('start', () => actions.start(!!store.data.activeRun));
    bind('new-run', () => actions.start(false));
    bind('retry', () => actions.start(false));
    bind('sound', actions.sound);
    bind('pause', actions.pause);
    bind('resume', actions.resume);
    bind('pause-menu', actions.menu);
    bind('result-menu', actions.menu);
    bind('help', () => this.showHelp());
    bind('skins', () => this.showSkins());
    bind('reward', () => { void actions.reward(); });
    document.querySelector('.brand')?.addEventListener('click', e => { e.preventDefault(); if (this.mode !== 'loading') actions.menu(); });
    store.subscribe(() => this.sync());
    new ResizeObserver(() => this.resize()).observe(this.stage);
    this.resize(); this.sync();
    window.addEventListener('keydown', e => {
      if (!this.dialog) return;
      if (e.code === 'Escape') { this.closeDialog(); e.stopImmediatePropagation(); }
      if (e.code === 'Tab') {
        const buttons = [...this.dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const first = buttons[0], last = buttons.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }, true);
  }
  private el(id: string) { return document.getElementById(id)!; }
  private show(id: string, visible: boolean) { this.el(id).classList.toggle('hidden', !visible); }
  private text(id: string, value: string | number) { const e = this.el(id); if (e.textContent !== String(value)) e.textContent = String(value); }
  private resize() { this.overlay.style.transform = `scale(${this.stage.clientWidth / 480})`; }
  sync() {
    const p = this.store.data;
    document.querySelectorAll('.wallet').forEach(e => { if (e.textContent !== String(p.coins)) e.textContent = String(p.coins); });
    this.text('menu-best', p.bestHeight);
    this.text('save-status', this.store.status);
    const soundLabel = p.sound ? 'Выключить звук' : 'Включить звук';
    if (this.el('sound').getAttribute('aria-label') !== soundLabel) {
      this.el('sound').innerHTML = icon(p.sound ? 'sound' : 'mute');
      this.el('sound').setAttribute('aria-label', soundLabel);
    }
    if (this.mode === 'menu') {
      this.el('start').innerHTML = p.activeRun ? `Продолжить · ${p.activeRun.height} м ${icon('arrow')}` : `Начать восхождение ${icon('arrow')}`;
      this.show('new-run', !!p.activeRun);
    }
    const skin = SKINS.find(s => s.id === p.selectedSkin)!;
    this.overlay.style.setProperty('--scarf', `#${skin.appearance.scarf.toString(16)}`);
  }
  menu() { this.mode = 'menu'; this.setMode(); this.sync(); }
  play() { this.closeDialog(); this.mode = 'play'; this.setMode(); document.activeElement instanceof HTMLElement && document.activeElement.blur(); }
  private setMode() {
    this.show('loader', this.mode === 'loading');
    this.show('menu', this.mode === 'menu'); this.show('hud', this.mode === 'play');
    this.show('controls', this.mode === 'play'); this.show('vitals', this.mode === 'play'); this.show('boss-hud', false); this.show('pause', this.mode === 'play');
    this.show('result', this.mode === 'result'); this.show('pause-overlay', false); this.show('combo', false);
    this.show('play-hint', false);
    this.show('game-top', true);
  }
  update(s: RunSnapshot) {
    this.text('height', s.height); this.text('score', s.height * 10 + s.score); this.text('run-coins', s.earned);
    this.text('zone', zoneAt(s.height).name.toUpperCase());
    this.text('combo', `ВОЗДУШНОЕ КОМБО ×${s.combo}`);
    this.show('combo', s.combo > 0 && s.comboLeft > 0);
    const lessons = ['1 / 5  ·  Пройди в сторону: ← → или кнопки снизу.', '2 / 5  ·  Удержи ПРЫЖОК / Space — поднимешься выше.', '3 / 5  ·  Прижмись к стене слева. ПРЫЖОК оттолкнёт тебя.', '4 / 5  ·  РЫВОК / Shift: направление задают стрелки, ↑ — вверх.', '5 / 5  ·  Подойди к стражу. УДАР / J — катана вперёд.'];
    this.text('play-hint', lessons[s.tutorial] ?? '');
    this.el('play-hint').classList.toggle('hint-top', s.player.y-s.cameraY+24 > 570);
    this.show('play-hint', s.tutorial < 5 && this.mode === 'play');
    this.text('vitals', '●'.repeat(Math.max(0,s.player.health)) + '○'.repeat(Math.max(0,3-s.player.health)));
    const boss = s.enemies.find(e => e.kind === 'oni' && e.hp > 0 && Math.abs(e.y-s.player.y)<380);
    this.show('boss-hud', !!boss && this.mode === 'play');
    if(boss){ this.el('boss-phase').style.setProperty('--charge', boss.state === 'windup' ? String(Math.min(1,boss.stateTime/(0.85*(boss.hp<=3?0.75:1)))) : '0'); this.text('boss-phase', boss.state === 'recover' ? 'АТАКУЙ · ОКНО УЯЗВИМОСТИ' : boss.state === 'windup' ? 'ПРИГОТОВЬСЯ К УДАРУ' : boss.hp<=3 ? 'ФАЗА II' : 'ФАЗА I'); this.el('boss-health').style.width = `${boss.hp/6*100}%`; }
    document.querySelector('[data-control="dash"]')?.classList.toggle('spent', !s.player.dashReady);
    const attack = document.querySelector<HTMLButtonElement>('[data-control="attack"]')!;
    attack.style.setProperty('--cooldown', `${s.player.cooldown / RULES.attackCooldown * 100}%`);
  }
  paused(paused: boolean, manual: boolean, blocked: boolean) {
    if (this.mode !== 'play') return;
    this.show('pause-overlay', paused);
    const focused = document.activeElement;
    if (!paused && focused instanceof HTMLElement && (focused.closest('#pause-overlay') || focused.id === 'pause')) focused.blur();
    this.el('resume').toggleAttribute('disabled', blocked);
    this.text('pause-note', blocked ? 'Продолжим после возвращения в игру.' : manual ? 'Храм подождёт.' : 'Возвращаемся к восхождению…');
  }
  result(s: RunSnapshot, previousBest: number) {
    this.mode = 'result'; this.setMode(); this.show('play-hint', false);
    this.text('result-height', s.height); this.text('result-score', s.height * 10 + s.score);
    this.text('result-coins', `+${s.earned}`); this.text('result-combo', `×${s.bestCombo}`); this.text('result-cause', s.cause);
    this.show('new-record', s.height > previousBest);
    this.el('retry').focus({ preventScroll: true });
  }
  loadingError(message: string) {
    this.el('loader').innerHTML = `<span class="seal">忍</span><h2>Храм пока недоступен</h2><p>${message}</p><button id="reload" class="button primary">Повторить загрузку</button>`;
    this.show('loader', true);
    this.el('reload').onclick = () => location.reload();
  }
  private toastTimer?: ReturnType<typeof setTimeout>;
  toast(message: string) {
    this.text('toast', message); this.show('toast', true);
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => this.show('toast', false), 4500);
  }
  rewardBusy(value: boolean) { this.el('reward').toggleAttribute('disabled', value); }
  private openDialog(content: string, title: string) {
    this.previousFocus = document.activeElement as HTMLElement;
    this.el('dialog-root').innerHTML = `<div class="veil dialog-veil"><section class="dialog" role="dialog" aria-modal="true" aria-label="${title}"><button class="icon-button dialog-close" aria-label="Закрыть">${icon('close')}</button>${content}</section></div>`;
    this.dialog = this.el('dialog-root').querySelector('.dialog')!;
    this.dialog.querySelector<HTMLButtonElement>('.dialog-close')!.onclick = () => this.closeDialog();
    this.dialog.querySelector<HTMLButtonElement>('button')!.focus();
    this.el('menu').inert = true;
  }
  closeDialog() { this.el('dialog-root').innerHTML = ''; this.dialog = undefined; this.el('menu').inert = false; this.previousFocus?.focus({ preventScroll: true }); }
  private showHelp() {
    this.openDialog(`<div class="eyebrow">ДОВЕРЬСЯ ВЕТРУ</div><h2>Искусство движения</h2><p>Ты выбираешь момент каждого прыжка. Начало пути — безопасное обучение.</p><ol class="help-list"><li><b>Двигайся и прыгай</b><span>← → / A D — направление. Space или ПРЫЖОК — отталкивание. Удерживай, чтобы прыгнуть выше.</span></li><li><b>Используй стены</b><span>Прижмись к каменной стене: сначала ниндзя удержится, потом начнёт скользить. ПРЫЖОК оттолкнёт в обратную сторону. Электрические стены опасны.</span></li><li><b>Совершай рывки</b><span>Shift или РЫВОК. Стрелки / W S выбирают направление; без направления — вверх по диагонали. Приземление и попадание в воздухе возвращают рывок.</span></li><li><b>Бей катаной вперёд</b><span>J / УДАР / левый клик. Один замах — одно попадание по цели. Воздушные попадания продолжают комбо, если между ними меньше двух секунд.</span></li></ol><p class="help-footnote">Мышь: удерживание поля — движение, левый клик — удар, правый — рывок к указателю. Экранные кнопки доступны и мыши. У босса дождись удара и атакуй во время его отдыха. P / Esc — пауза.</p>`, 'Как играть');
  }
  private showSkins() {
    this.openDialog(`<div class="eyebrow">ТВОЙ ПУТЬ. ТВОЙ СТИЛЬ.</div><h2>Облики ниндзя</h2><p>Одна сила. Три характера.</p><div class="skin-wallet">${icon('coin')} <b class="wallet">${this.store.data.coins}</b> монет</div><div class="skin-list">${SKINS.map(s => {
      const owned = this.store.data.ownedSkins.includes(s.id), selected = this.store.data.selectedSkin === s.id;
      return `<button class="skin-card ${selected ? 'selected' : ''}" data-skin="${s.id}"><span class="skin-preview" style="background-image:url('${import.meta.env.BASE_URL}assets/characters/${s.id}.png')"></span><span><b>${s.name}</b><small>${selected ? 'ВЫБРАН' : owned ? 'ВЫБРАТЬ' : `${s.price} МОНЕТ`}</small></span><em>${selected ? '✓' : owned ? '→' : icon('coin')}</em></button>`;
    }).join('')}</div><p class="help-footnote">Монеты начисляются за сбор и победы. Все облики дают одинаковые игровые возможности.</p>`, 'Облики ниндзя');
    this.dialog?.querySelectorAll<HTMLButtonElement>('[data-skin]').forEach(button => {
      button.onclick = () => {
        if (this.store.selectSkin(button.dataset.skin as SkinId)) { this.closeDialog(); this.showSkins(); }
        else this.toast('Нужно больше монет. Они ждут тебя в облаках.');
      };
    });
  }
}
