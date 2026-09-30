const KEY = 'halloumi-empire-v0-save-1';

const stations = ['farm', 'dairy', 'grill'];

const baseCost = {
  farm: 12,
  dairy: 18,
  grill: 24,
};

const autoCost = {
  farm: 40,
  dairy: 80,
  grill: 120,
};

const cycle = {
  farm: 2.5,
  dairy: 3,
  grill: 3.5,
};

const blank = () => ({
  coins: 0,
  milk: 0,
  halloumi: 0,
  levels: {
    farm: 1,
    dairy: 1,
    grill: 1,
  },
  auto: {
    farm: false,
    dairy: false,
    grill: false,
  },
  progress: {
    farm: 0,
    dairy: 0,
    grill: 0,
  },
  sold: 0,
  taps: 0,
  firstSale: false,
  lastUpdatedAt: Date.now(),
});

const el = (id) => document.getElementById(id);

const fmt = (number) =>
  Math.floor(number).toLocaleString('fr-FR');

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');

    if (!saved?.levels || !saved?.auto) {
      return blank();
    }

    const clean = blank();

    for (const key of [
      'coins',
      'milk',
      'halloumi',
      'sold',
      'taps',
      'lastUpdatedAt',
    ]) {
      if (Number.isFinite(saved[key]) && saved[key] >= 0) {
        clean[key] = saved[key];
      }
    }

    clean.firstSale =
      saved.firstSale === true || clean.sold > 0;

    for (const key of stations) {
      if (
        Number.isInteger(saved.levels[key]) &&
        saved.levels[key] > 0 &&
        saved.levels[key] <= 1000
      ) {
        clean.levels[key] = saved.levels[key];
      }

      clean.auto[key] = saved.auto[key] === true;

      if (
        Number.isFinite(saved.progress?.[key]) &&
        saved.progress[key] >= 0 &&
        saved.progress[key] < cycle[key]
      ) {
        clean.progress[key] = saved.progress[key];
      }
    }

    return clean;
  } catch {
    return blank();
  }
}

let state = load();
let lastTick = Date.now();
let lastSave = lastTick;
let toastTimer;
let activeTab = 'island';

const price = () => 8 + (state.levels.grill - 1) * 3;

const upgradeCost = (key) =>
  Math.ceil(
    baseCost[key] * Math.pow(1.38, state.levels[key] - 1)
  );

function save(now = Date.now()) {
  state.lastUpdatedAt = now;

  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Le stockage peut être désactivé dans certains navigateurs.
  }

  lastSave = now;
}

function sell(quantity) {
  state.halloumi -= quantity;
  state.coins += quantity * price();
  state.sold += quantity;
  state.firstSale = true;
}

function advance(seconds) {
  if (state.auto.farm) {
    state.progress.farm += seconds;

    const batches = Math.floor(
      state.progress.farm / cycle.farm
    );

    if (batches) {
      state.milk += batches * state.levels.farm;
      state.progress.farm -= batches * cycle.farm;
    }
  }

  if (state.auto.dairy) {
    state.progress.dairy = Math.min(
      cycle.dairy,
      state.progress.dairy + seconds
    );

    if (
      state.milk >= 1 &&
      state.progress.dairy >= cycle.dairy
    ) {
      const quantity = Math.min(
        state.milk,
        state.levels.dairy
      );

      state.milk -= quantity;
      state.halloumi += quantity;
      state.progress.dairy = 0;
    }
  }

  if (state.auto.grill) {
    state.progress.grill = Math.min(
      cycle.grill,
      state.progress.grill + seconds
    );

    if (
      state.halloumi >= 1 &&
      state.progress.grill >= cycle.grill
    ) {
      sell(
        Math.min(state.halloumi, state.levels.grill)
      );

      state.progress.grill = 0;
    }
  }
}

function toast(message) {
  const notice = el('notice');

  notice.textContent = message;
  notice.hidden = false;

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    notice.hidden = true;
  }, 3500);
}

function catchUp(now) {
  const seconds = Math.min(
    14400,
    Math.max(0, (now - state.lastUpdatedAt) / 1000)
  );

  const coinsBefore = state.coins;
  const fullSeconds = Math.floor(seconds);

  for (let i = 0; i < fullSeconds; i++) {
    advance(1);
  }

  if (seconds - fullSeconds) {
    advance(seconds - fullSeconds);
  }

  lastTick = now;
  save(now);

  if (seconds >= 10 && state.coins > coinsBefore) {
    toast(
      `Pendant ton absence : +${fmt(
        state.coins - coinsBefore
      )} pièces !`
    );
  }
}

function mission() {
  if (!state.firstSale) {
    return 'Trais, fabrique puis vends ton premier halloumi !';
  }

  if (!state.auto.farm) {
    return 'Automatise la ferme dans Améliorations.';
  }

  if (!state.auto.dairy) {
    return 'Automatise l’atelier dans Améliorations.';
  }

  if (!state.auto.grill) {
    return 'Automatise le grill dans Améliorations.';
  }

  if (state.sold < 100) {
    return `Vends 100 blocs : encore ${fmt(
      100 - state.sold
    )} !`;
  }

  return 'Ton empire démarre ! Continue les améliorations.';
}

function effect(station, text) {
  const card = el(`place-${station}`);
  const animation = el('fx');

  card.classList.remove('pulse');
  animation.classList.remove('fly');

  // Relance l'animation si le joueur tape plusieurs fois.
  void card.offsetWidth;

  card.classList.add('pulse');
  animation.textContent = text;
  animation.classList.add('fly');

  setTimeout(() => {
    card.classList.remove('pulse');
    animation.classList.remove('fly');
  }, 950);
}

function render() {
  el('coins').textContent = fmt(state.coins);
  el('milk').textContent = fmt(state.milk);
  el('halloumi').textContent = fmt(state.halloumi);
  el('price').textContent = fmt(price());
  el('objective').textContent = mission();

  el('island-status').textContent = state.auto.grill
    ? 'Ton île tourne toute seule !'
    : state.auto.farm
      ? 'Ton empire prend vie…'
      : 'Une petite aventure commence…';

  for (const key of stations) {
    el(`${key}-level`).textContent =
      `Nv. ${state.levels[key]}`;

    el(`${key}-indicator`).hidden =
      !state.auto[key];

    el(`${key}-upgrade-info`).textContent =
      key === 'grill'
        ? `Nv. ${state.levels[key]} · ${price()} pièces par bloc`
        : `Nv. ${state.levels[key]} · ${state.levels[key]} ${
            key === 'farm' ? 'lait' : 'bloc(s)'
          } par cycle`;

    const upgrade = document.querySelector(
      `[data-upgrade="${key}"]`
    );

    const automation = document.querySelector(
      `[data-auto="${key}"]`
    );

    const manual = document.querySelector(
      `[data-manual="${key}"]`
    );

    upgrade.textContent =
      `Améliorer · ${fmt(upgradeCost(key))} pièces`;

    upgrade.disabled =
      state.coins < upgradeCost(key);

    automation.textContent = state.auto[key]
      ? '✓ Automatique'
      : `Automatiser · ${fmt(autoCost[key])} pièces`;

    automation.disabled =
      state.auto[key] || state.coins < autoCost[key];

    automation.classList.toggle(
      'done',
      state.auto[key]
    );

    const quantity =
      key === 'farm'
        ? state.levels.farm
        : Math.min(
            state[key === 'dairy' ? 'milk' : 'halloumi'],
            state.levels[key]
          );

    manual.disabled =
      key !== 'farm' && quantity < 1;

    manual.innerHTML =
      key === 'farm'
        ? `Traire <b>+${quantity} lait</b>`
        : key === 'dairy'
          ? `Fabriquer <b>${quantity} bloc${
              quantity > 1 ? 's' : ''
            }</b>`
          : `Vendre <b>+${
              quantity * price()
            } pièces</b>`;
  }

  const steps = [
    [state.firstSale, 'Premier halloumi vendu'],
    [state.auto.farm, 'Ferme automatisée'],
    [state.auto.dairy, 'Atelier automatisé'],
    [state.auto.grill, 'Grill automatisé'],
    [state.sold >= 100, '100 blocs vendus'],
  ];

  el('milestones').replaceChildren(
    ...steps.map(([done, label]) => {
      const item = document.createElement('div');
      const icon = document.createElement('span');
      const name = document.createElement('span');

      item.className =
        'achievement' + (done ? ' complete' : '');

      icon.className = 'seal';
      icon.textContent = done ? '✦' : '○';
      name.textContent = label;

      item.append(icon, name);

      return item;
    })
  );

  el('stats').textContent =
    `${fmt(state.sold)} blocs vendus · ` +
    `${fmt(state.taps)} actions manuelles`;
}

function tab(name) {
  activeTab = name;

  for (const key of [
    'island',
    'achievements',
    'upgrades',
  ]) {
    el(`screen-${key}`).hidden = key !== name;
  }

  for (const button of document.querySelectorAll(
    '[data-tab]'
  )) {
    const selected = button.dataset.tab === name;

    button.classList.toggle('selected', selected);

    if (selected) {
      button.setAttribute('aria-current', 'page');
    } else {
      button.removeAttribute('aria-current');
    }
  }

  el('view-title').textContent = {
    island: 'Mon île',
    achievements: 'Exploits',
    upgrades: 'Améliorations',
  }[name];

  el('mission').hidden = name !== 'island';
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');

  if (!button || button.disabled) {
    return;
  }

  if (button.dataset.tab) {
    tab(button.dataset.tab);
    return;
  }

  let animation = null;
  const station = button.dataset.manual;

  if (station) {
    if (station === 'farm') {
      state.milk += state.levels.farm;

      animation = [
        station,
        `+${state.levels.farm} lait`,
      ];
    } else if (
      station === 'dairy' &&
      state.milk > 0
    ) {
      const quantity = Math.min(
        state.milk,
        state.levels.dairy
      );

      state.milk -= quantity;
      state.halloumi += quantity;

      animation = [
        station,
        `+${quantity} halloumi`,
      ];
    } else if (
      station === 'grill' &&
      state.halloumi > 0
    ) {
      const quantity = Math.min(
        state.halloumi,
        state.levels.grill
      );

      sell(quantity);

      animation = [
        station,
        `+${quantity * price()} pièces`,
      ];
    }

    state.taps++;
  }

  const upgrade = button.dataset.upgrade;

  if (
    upgrade &&
    state.coins >= upgradeCost(upgrade)
  ) {
    state.coins -= upgradeCost(upgrade);
    state.levels[upgrade]++;

    toast('Bâtiment amélioré !');
  }

  const automation = button.dataset.auto;

  if (
    automation &&
    !state.auto[automation] &&
    state.coins >= autoCost[automation]
  ) {
    state.coins -= autoCost[automation];
    state.auto[automation] = true;

    toast('Automatisation débloquée !');
  }

  if (
    button.id === 'reset' &&
    window.confirm(
      'Effacer ta partie et recommencer ?'
    )
  ) {
    state = blank();

    toast('Nouvelle partie commencée !');
    tab('island');
  }

  if (animation) {
    effect(...animation);
  }

  save();
  render();
});

catchUp(Date.now());
render();
tab('island');

setInterval(() => {
  if (document.hidden) {
    return;
  }

  const now = Date.now();

  const elapsed = Math.max(
    0,
    Math.min(
      14400,
      (now - lastTick) / 1000
    )
  );

  lastTick = now;

  if (elapsed > 3) {
    catchUp(now);
  } else {
    advance(elapsed);

    if (now - lastSave >= 3000) {
      save(now);
    }
  }

  render();
}, 250);

document.addEventListener(
  'visibilitychange',
  () => {
    if (document.hidden) {
      save();
    } else {
      catchUp(Date.now());
      render();
    }
  }
);

window.addEventListener(
  'pagehide',
  () => save()
);
