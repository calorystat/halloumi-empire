const KEY = 'halloumi-empire-v0-save-1';
const AUTO_COST = { farm: 40, dairy: 80, grill: 120 };
const BASE_COST = { farm: 12, dairy: 18, grill: 24 };
const CYCLE = { farm: 2.5, dairy: 3, grill: 3.5 };
const MAX_AWAY = 4 * 60 * 60;
const fresh = () => ({ coins: 0, milk: 0, halloumi: 0, levels: { farm: 1, dairy: 1, grill: 1 }, auto: { farm: false, dairy: false, grill: false }, progress: { farm: 0, dairy: 0, grill: 0 }, sold: 0, taps: 0, firstSale: false, lastUpdatedAt: Date.now() });
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!saved || !saved.levels || !saved.auto) return fresh();
    const clean = fresh();
    for (const key of ['coins', 'milk', 'halloumi', 'sold', 'taps', 'lastUpdatedAt']) if (Number.isFinite(saved[key]) && saved[key] >= 0) clean[key] = saved[key];
    clean.firstSale = saved.firstSale === true || clean.sold > 0;
    for (const k of ['farm', 'dairy', 'grill']) {
      if (Number.isInteger(saved.levels[k]) && saved.levels[k] >= 1 && saved.levels[k] <= 1000) clean.levels[k] = saved.levels[k];
      clean.auto[k] = saved.auto[k] === true;
      if (Number.isFinite(saved.progress?.[k]) && saved.progress[k] >= 0 && saved.progress[k] < CYCLE[k]) clean.progress[k] = saved.progress[k];
    }
    return clean;
  } catch { return fresh(); }
}
let s = load();
let lastTick = Date.now();
let savedAt = lastTick;
let noticeTimeout;
const el = id => document.getElementById(id);
const format = n => Math.floor(n).toLocaleString('fr-FR');
const price = () => 8 + (s.levels.grill - 1) * 3;
const cost = k => Math.ceil(BASE_COST[k] * Math.pow(1.38, s.levels[k] - 1));
function save(now = Date.now()) {
  s.lastUpdatedAt = now;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* Storage may be unavailable. */ }
  savedAt = now;
}
function sell(n) { s.halloumi -= n; s.coins += n * price(); s.sold += n; s.firstSale = true; }
function advance(dt) {
  if (s.auto.farm) {
    s.progress.farm += dt;
    const batches = Math.floor(s.progress.farm / CYCLE.farm);
    if (batches) { s.milk += batches * s.levels.farm; s.progress.farm -= batches * CYCLE.farm; }
  }
  if (s.auto.dairy) {
    s.progress.dairy = Math.min(CYCLE.dairy, s.progress.dairy + dt);
    if (s.milk >= 1 && s.progress.dairy >= CYCLE.dairy) {
      const n = Math.min(s.levels.dairy, s.milk);
      s.milk -= n; s.halloumi += n; s.progress.dairy = 0;
    }
  }
  if (s.auto.grill) {
    s.progress.grill = Math.min(CYCLE.grill, s.progress.grill + dt);
    if (s.halloumi >= 1 && s.progress.grill >= CYCLE.grill) {
      sell(Math.min(s.levels.grill, s.halloumi)); s.progress.grill = 0;
    }
  }
}
function catchUp(now) {
  const seconds = Math.min(MAX_AWAY, Math.max(0, (now - s.lastUpdatedAt) / 1000));
  const before = s.coins;
  const whole = Math.floor(seconds);
  for (let i = 0; i < whole; i++) advance(1);
  if (seconds - whole > 0) advance(seconds - whole);
  lastTick = now;
  save(now);
  if (seconds >= 10 && s.coins > before) show(`Pendant ton absence : +${format(s.coins - before)} pièces !`);
}
function show(message) {
  const box = el('notice'); box.textContent = message; box.hidden = false;
  clearTimeout(noticeTimeout); noticeTimeout = setTimeout(() => { box.hidden = true; }, 4500);
}
function objective() {
  if (!s.firstSale) return 'Trais une chèvre, fabrique un halloumi et vends-le.';
  if (!s.auto.farm) return 'Automatise la ferme pour produire du lait sans toucher.';
  if (!s.auto.dairy) return 'Automatise la fromagerie.';
  if (!s.auto.grill) return 'Automatise le grill pour faire tourner toute la chaîne.';
  if (s.sold < 100) return `Vends 100 halloumis : encore ${format(100 - s.sold)} !`;
  return 'Bravo ! Toute ta fromagerie fonctionne. Améliore les postes pour gagner davantage.';
}
function render() {
  el('coins').textContent = format(s.coins);
  el('milk').textContent = format(s.milk);
  el('halloumi').textContent = format(s.halloumi);
  el('price').textContent = `${format(price())} 🪙`;
  el('income').textContent = s.auto.grill ? `Jusqu’à ${format(60 / CYCLE.grill * s.levels.grill * price())} / min` : 'Vente manuelle';
  el('objective').textContent = objective();
  for (const k of ['farm', 'dairy', 'grill']) {
    el(`${k}-level`).textContent = `Nv. ${s.levels[k]}`;
    el(`${k}-speed`).textContent = `${s.levels[k]} / cycle`;
    const up = document.querySelector(`[data-upgrade="${k}"]`);
    up.textContent = `Améliorer · ${format(cost(k))} 🪙`;
    up.disabled = s.coins < cost(k);
    const auto = document.querySelector(`[data-auto="${k}"]`);
    auto.textContent = s.auto[k] ? '✓ Automatique' : `Automatiser · ${format(AUTO_COST[k])} 🪙`;
    auto.disabled = s.auto[k] || s.coins < AUTO_COST[k];
    auto.classList.toggle('is-on', s.auto[k]);
  }
  const manual = { farm: s.levels.farm, dairy: Math.min(s.milk, s.levels.dairy), grill: Math.min(s.halloumi, s.levels.grill) };
  for (const k of ['farm', 'dairy', 'grill']) {
    const btn = document.querySelector(`[data-manual="${k}"]`);
    btn.disabled = (k !== 'farm' && manual[k] < 1);
    btn.textContent = k === 'farm' ? `Traire +${manual[k]} lait` : k === 'dairy' ? `Fabriquer · ${manual[k]} lait` : `Vendre · +${manual[k] * price()} 🪙`;
  }
  const steps = [ [s.firstSale, 'Premier halloumi vendu'], [s.auto.farm, 'Ferme automatisée'], [s.auto.dairy, 'Fromagerie automatisée'], [s.auto.grill, 'Grill automatisé'], [s.sold >= 100, '100 halloumis vendus'] ];
  el('milestones').replaceChildren(...steps.map(([done, label]) => { const d = document.createElement('div'); d.className = `milestone${done ? ' done' : ''}`; d.textContent = `${done ? '✓' : '○'} ${label}`; return d; }));
  el('stats').textContent = `${format(s.sold)} halloumis vendus · ${format(s.taps)} actions manuelles`;
}
document.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn || btn.disabled) return;
  const k = btn.dataset.manual;
  if (k) {
    if (k === 'farm') s.milk += s.levels.farm;
    if (k === 'dairy' && s.milk >= 1) { const n = Math.min(s.milk, s.levels.dairy); s.milk -= n; s.halloumi += n; }
    if (k === 'grill' && s.halloumi >= 1) sell(Math.min(s.halloumi, s.levels.grill));
    s.taps++;
  }
  const upgrade = btn.dataset.upgrade;
  if (upgrade && s.coins >= cost(upgrade)) { s.coins -= cost(upgrade); s.levels[upgrade]++; show(`${{farm:'Ferme',dairy:'Fromagerie',grill:'Grill'}[upgrade]} amélioré !`); }
  const auto = btn.dataset.auto;
  if (auto && !s.auto[auto] && s.coins >= AUTO_COST[auto]) { s.coins -= AUTO_COST[auto]; s.auto[auto] = true; show('Poste automatisé !'); }
  if (btn.id === 'reset' && window.confirm('Effacer cette partie et recommencer à zéro ?')) { s = fresh(); show('Nouvelle partie commencée.'); }
  save(); render();
});
catchUp(Date.now());
render();
setInterval(() => {
  if (document.hidden) return;
  const now = Date.now();
  const dt = Math.max(0, Math.min(MAX_AWAY, (now - lastTick) / 1000));
  lastTick = now;
  if (dt > 3) { catchUp(now); }
  else { advance(dt); if (now - savedAt >= 3000) save(now); }
  render();
}, 250);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else { catchUp(Date.now()); render(); } });
window.addEventListener('pagehide', () => save());
