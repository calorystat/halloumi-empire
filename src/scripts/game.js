const KEY = 'halloumi-empire-v0-save-1';
const KEYS = ['farm', 'dairy', 'grill'];
const COST = { farm: 12, dairy: 18, grill: 24 };
const HIRE = { farm: 16, dairy: 32, grill: 48 };
const BASE_CYCLE = { farm: 2.5, dairy: 3, grill: 3.5 };
const LABEL = { farm: 'Ferme', dairy: 'Atelier', grill: 'Grill' };
const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.floor(n).toLocaleString('fr-FR');
const blank = () => ({
  coins: 0, milk: 0, halloumi: 0,
  levels: { farm: 1, dairy: 1, grill: 1 },
  auto: { farm: false, dairy: false, grill: false },
  progress: { farm: 0, dairy: 0, grill: 0 },
  sold: 0, taps: 0, firstSale: false,
  lastUpdatedAt: Date.now(),
});

function load() {
  try {
    const old = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!old?.levels || !old?.auto) return blank();
    const next = blank();
    for (const k of ['coins', 'milk', 'halloumi', 'sold', 'taps', 'lastUpdatedAt']) {
      if (Number.isFinite(old[k]) && old[k] >= 0) next[k] = old[k];
    }
    next.firstSale = old.firstSale === true || next.sold > 0;
    for (const k of KEYS) {
      if (Number.isInteger(old.levels[k]) && old.levels[k] >= 1 && old.levels[k] <= 1000) {
        next.levels[k] = old.levels[k];
      }
      next.auto[k] = old.auto[k] === true;
      if (Number.isFinite(old.progress?.[k]) && old.progress[k] >= 0) {
        next.progress[k] = Math.min(old.progress[k], BASE_CYCLE[k]);
      }
    }
    return next;
  } catch {
    return blank();
  }
}

let state = load();
let lastTick = Date.now();
let lastSave = lastTick;
let selected = null;
let currentTab = 'island';
let toastTimer;
let pendingOffline = null;
let previous = { milk: state.milk, halloumi: state.halloumi, sold: state.sold };
const price = () => 8 + (state.levels.grill - 1) * 3;
const upgradeCost = (k) => Math.ceil(COST[k] * 1.38 ** (state.levels[k] - 1));
const cycle = (k) => BASE_CYCLE[k] / (1 + Math.floor((state.levels[k] - 1) / 5) * 0.12);

function save(now = Date.now()) {
  state.lastUpdatedAt = now;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* Storage disabled */ }
  lastSave = now;
}

function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

function sell(qty) {
  state.halloumi -= qty;
  state.coins += qty * price();
  state.sold += qty;
  state.firstSale = true;
}

function advance(seconds) {
  if (state.auto.farm) {
    state.progress.farm += seconds;
    const batches = Math.floor(state.progress.farm / cycle('farm'));
    if (batches) {
      state.milk += batches * state.levels.farm;
      state.progress.farm -= batches * cycle('farm');
    }
  }
  if (state.auto.dairy) {
    state.progress.dairy = Math.min(cycle('dairy'), state.progress.dairy + seconds);
    if (state.milk > 0 && state.progress.dairy >= cycle('dairy')) {
      const qty = Math.min(state.milk, state.levels.dairy);
      state.milk -= qty;
      state.halloumi += qty;
      state.progress.dairy = 0;
    }
  }
  if (state.auto.grill) {
    state.progress.grill = Math.min(cycle('grill'), state.progress.grill + seconds);
    if (state.halloumi > 0 && state.progress.grill >= cycle('grill')) {
      sell(Math.min(state.halloumi, state.levels.grill));
      state.progress.grill = 0;
    }
  }
}

function catchUp(now, showReward = true) {
  const elapsed = Math.min(14400, Math.max(0, (now - state.lastUpdatedAt) / 1000));
  const before = { coins: state.coins, sold: state.sold };
  const whole = Math.floor(elapsed);
  for (let i = 0; i < whole; i++) advance(1);
  if (elapsed - whole) advance(elapsed - whole);
  lastTick = now;
  save(now);
  previous = { milk: state.milk, halloumi: state.halloumi, sold: state.sold };
  if (showReward && elapsed >= 10 && state.coins > before.coins) {
    pendingOffline = {
      coins: state.coins - before.coins,
      sold: state.sold - before.sold,
    };
    $('offline-detail').textContent = `${fmt(pendingOffline.sold)} bloc(s) vendus pendant ton absence`;
    $('offline-coins').textContent = `+${fmt(pendingOffline.coins)} pièces`;
    $('offline-overlay').hidden = false;
  }
}

function mission() {
  if (!state.firstSale) return 'Trais, fabrique, puis vends ton premier bloc !';
  if (!state.auto.farm) return 'Recrute une fermière pour produire sans toucher.';
  if (!state.auto.dairy) return 'Recrute un fromager dans l’atelier.';
  if (!state.auto.grill) return 'Recrute un cuisinier pour automatiser les ventes.';
  if (state.sold < 100) return `Encore ${fmt(100 - state.sold)} blocs avant 100 ventes !`;
  return 'Ton empire tourne ! Repère le prochain goulot.';
}

function bottleneck() {
  if (!state.auto.farm) return 'Priorité : recruter une fermière.';
  if (!state.auto.dairy) return 'Priorité : automatiser l’atelier.';
  if (!state.auto.grill) return 'Priorité : automatiser le grill.';
  if (state.milk === 0 && state.halloumi === 0) return 'Manque de lait : améliore la ferme.';
  if (state.milk > state.halloumi + 6) return 'Le lait s’accumule : améliore l’atelier.';
  if (state.halloumi > 6) return 'Le halloumi s’accumule : améliore le grill.';
  return 'Chaîne équilibrée : augmente le rendement du poste le moins avancé.';
}

function burst(text) {
  const el = $('burst');
  el.classList.remove('fly');
  void el.offsetWidth;
  el.textContent = text;
  el.classList.add('fly');
}

function travel(id) {
  const el = $(id);
  el.classList.remove('travel');
  void el.offsetWidth;
  el.classList.add('travel');
}

function renderSheet() {
  if (!selected) return;
  const k = selected;
  $('sheet-title').textContent = LABEL[k];
  $('sheet-level').textContent = fmt(state.levels[k]);
  $('sheet-output').textContent = k === 'grill'
    ? `${fmt(price())} pièces / bloc`
    : `${fmt(state.levels[k])} ${k === 'farm' ? 'lait' : 'bloc(s)'} / cycle`;
  $('sheet-status').textContent = state.auto[k]
    ? `Employé recruté · 1 cycle toutes les ${cycle(k).toFixed(1)} s`
    : 'Production manuelle : recrute un employé pour automatiser.';
  const up = $('upgrade');
  up.textContent = `Améliorer · ${fmt(upgradeCost(k))} pièces`;
  up.disabled = state.coins < upgradeCost(k);
  $('upgrade-preview').textContent = k === 'grill'
    ? `Prochain niveau : ${fmt(price() + 3)} pièces par bloc.`
    : `Prochain niveau : ${fmt(state.levels[k] + 1)} par cycle.`;
  const hire = $('automate');
  hire.textContent = state.auto[k] ? '✓ Employé recruté' : `Recruter · ${fmt(HIRE[k])} pièces`;
  hire.disabled = state.auto[k] || state.coins < HIRE[k];
}

function render() {
  $('coins').textContent = fmt(state.coins);
  $('milk').textContent = fmt(state.milk);
  $('halloumi').textContent = fmt(state.halloumi);
  $('price').textContent = fmt(price());
  $('sold').textContent = fmt(state.sold);
  $('taps').textContent = fmt(state.taps);
  $('objective').textContent = mission();
  $('bottleneck').textContent = bottleneck();
  const theoretical = state.auto.grill ? 60 / cycle('grill') * state.levels.grill * price() : 0;
  $('income').textContent = `≤ ${fmt(theoretical)}/min`;
  for (const k of KEYS) {
    $(k + '-level').textContent = `Niveau ${fmt(state.levels[k])}`;
    $(k + '-worker').hidden = !state.auto[k];
    $(k + '-meter').style.width = state.auto[k]
      ? `${Math.min(100, state.progress[k] / cycle(k) * 100)}%`
      : '0%';
    const manual = document.querySelector(`[data-manual="${k}"]`);
    manual.disabled = k === 'dairy' ? state.milk < 1 : k === 'grill' ? state.halloumi < 1 : false;
  }
  const milestones = [
    [state.firstSale, 'Premier bloc vendu'],
    [state.auto.farm, 'Ferme automatisée'],
    [state.auto.dairy, 'Atelier automatisé'],
    [state.auto.grill, 'Grill automatisé'],
    [state.sold >= 100, '100 blocs vendus'],
  ];
  $('milestones').replaceChildren(...milestones.map(([done, text]) => {
    const div = document.createElement('div');
    div.className = 'achievement' + (done ? ' complete' : '');
    div.textContent = `${done ? '✦' : '○'}  ${text}`;
    return div;
  }));
  renderSheet();
}

function openSheet(k) {
  selected = k;
  renderSheet();
  $('station-overlay').hidden = false;
  $('close-sheet').focus();
}
function closeSheet() { $('station-overlay').hidden = true; selected = null; }
function tab(name) {
  currentTab = name;
  for (const k of ['island', 'achievements', 'empire']) $('screen-' + k).hidden = k !== name;
  document.querySelector('.objective').hidden = name !== 'island';
  $('screen-title').textContent = { island: 'Mon île', achievements: 'Exploits', empire: 'Empire' }[name];
  for (const btn of document.querySelectorAll('[data-tab]')) {
    const current = btn.dataset.tab === name;
    btn.classList.toggle('selected', current);
    if (current) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  }
}

// Each station is tappable, while the orange button performs its manual action.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (btn?.dataset.tab) { tab(btn.dataset.tab); return; }
  if (btn?.id === 'collect') {
    pendingOffline = null;
    $('offline-overlay').hidden = true;
    return;
  }
  if (btn?.id === 'close-sheet' || btn?.id === 'close-scrim') { closeSheet(); return; }
  if (btn?.id === 'reset') {
    if (!window.confirm('Effacer ta partie et recommencer ?')) return;
    state = blank();
    previous = { milk: 0, halloumi: 0, sold: 0 };
    closeSheet(); tab('island'); save(); render(); toast('Nouvelle partie commencée !');
    return;
  }
  if (btn?.id === 'upgrade' && selected) {
    const k = selected, cost = upgradeCost(k);
    if (state.coins < cost) return;
    state.coins -= cost; state.levels[k] += 1;
    toast(`${LABEL[k]} amélioré !`); save(); render(); return;
  }
  if (btn?.id === 'automate' && selected) {
    const k = selected;
    if (state.auto[k] || state.coins < HIRE[k]) return;
    state.coins -= HIRE[k]; state.auto[k] = true;
    toast(`Employé recruté : ${LABEL[k]} automatisé !`); save(); render(); return;
  }
  if (btn?.dataset.manual) {
    const k = btn.dataset.manual;
    if (k === 'farm') {
      state.milk += state.levels.farm; travel('milk-cargo'); burst(`+${state.levels.farm} lait`);
    } else if (k === 'dairy' && state.milk >= 1) {
      const qty = Math.min(state.milk, state.levels.dairy);
      state.milk -= qty; state.halloumi += qty;
      travel('halloumi-cargo'); burst(`+${qty} bloc(s)`);
    } else if (k === 'grill' && state.halloumi >= 1) {
      const qty = Math.min(state.halloumi, state.levels.grill);
      sell(qty); burst(`+${qty * price()} pièces`);
    } else return;
    state.taps++; previous = { milk: state.milk, halloumi: state.halloumi, sold: state.sold };
    save(); render(); return;
  }
  if (!btn && !$('station-overlay').hidden) return;
  const station = e.target.closest('[data-open]');
  if (station && currentTab === 'island') openSheet(station.dataset.open);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('station-overlay').hidden) closeSheet();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-open]')) {
    e.preventDefault(); openSheet(e.target.dataset.open);
  }
});

catchUp(Date.now());
render(); tab('island');
setInterval(() => {
  if (document.hidden || !$('offline-overlay').hidden) return;
  const now = Date.now();
  const dt = Math.max(0, Math.min(14400, (now - lastTick) / 1000));
  lastTick = now;
  if (dt > 3) {
    catchUp(now); render(); return;
  }
  advance(dt);
  if (currentTab === 'island' && $('station-overlay').hidden) {
    if (state.milk > previous.milk) travel('milk-cargo');
    if (state.halloumi > previous.halloumi) travel('halloumi-cargo');
    if (state.sold > previous.sold) burst(`+${(state.sold - previous.sold) * price()} pièces`);
  }
  previous = { milk: state.milk, halloumi: state.halloumi, sold: state.sold };
  if (now - lastSave >= 3000) save(now);
  render();
}, 250);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
  else { catchUp(Date.now()); render(); }
});
window.addEventListener('pagehide', () => save());
