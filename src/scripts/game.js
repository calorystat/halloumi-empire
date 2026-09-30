const KEY = 'halloumi-empire-v0-save-1';

const STATIONS = ['farm', 'dairy', 'grill'];

const COST = {
  farm: 12,
  dairy: 18,
  grill: 24,
};

const HIRE = {
  farm: 16,
  dairy: 32,
  grill: 48,
};

const BASE_CYCLE = {
  farm: 2.5,
  dairy: 3,
  grill: 3.5,
};

const LABEL = {
  farm: 'Ferme',
  dairy: 'Atelier',
  grill: 'Grill',
};

const $ = (id) => document.getElementById(id);

const fmt = (number) =>
  Math.floor(number).toLocaleString('fr-FR');

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

function load() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(KEY) || 'null'
    );

    if (!saved?.levels || !saved?.auto) {
      return blank();
    }

    const next = blank();

    for (const key of [
      'coins',
      'milk',
      'halloumi',
      'sold',
      'taps',
      'lastUpdatedAt',
    ]) {
      if (
        Number.isFinite(saved[key]) &&
        saved[key] >= 0
      ) {
        next[key] = saved[key];
      }
    }

    next.firstSale =
      saved.firstSale === true || next.sold > 0;

    for (const key of STATIONS) {
      if (
        Number.isInteger(saved.levels[key]) &&
        saved.levels[key] >= 1 &&
        saved.levels[key] <= 1000
      ) {
        next.levels[key] = saved.levels[key];
      }

      next.auto[key] =
        saved.auto[key] === true;

      if (
        Number.isFinite(saved.progress?.[key]) &&
        saved.progress[key] >= 0
      ) {
        next.progress[key] = Math.min(
          saved.progress[key],
          BASE_CYCLE[key]
        );
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

let previous = {
  milk: state.milk,
  halloumi: state.halloumi,
  sold: state.sold,
};

const price = () =>
  8 + (state.levels.grill - 1) * 3;

const upgradeCost = (key) =>
  Math.ceil(
    COST[key] *
      1.38 ** (state.levels[key] - 1)
  );

const cycle = (key) =>
  BASE_CYCLE[key] /
  (
    1 +
    Math.floor(
      (state.levels[key] - 1) / 5
    ) * 0.12
  );

function save(now = Date.now()) {
  state.lastUpdatedAt = now;

  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(state)
    );
  } catch {
    // Le stockage peut être indisponible.
  }

  lastSave = now;
}

function toast(text) {
  const element = $('toast');

  element.textContent = text;
  element.hidden = false;

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    element.hidden = true;
  }, 3200);
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
      state.progress.farm / cycle('farm')
    );

    if (batches) {
      state.milk +=
        batches * state.levels.farm;

      state.progress.farm -=
        batches * cycle('farm');
    }
  }

  if (state.auto.dairy) {
    state.progress.dairy = Math.min(
      cycle('dairy'),
      state.progress.dairy + seconds
    );

    if (
      state.milk > 0 &&
      state.progress.dairy >=
        cycle('dairy')
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
      cycle('grill'),
      state.progress.grill + seconds
    );

    if (
      state.halloumi > 0 &&
      state.progress.grill >=
        cycle('grill')
    ) {
      sell(
        Math.min(
          state.halloumi,
          state.levels.grill
        )
      );

      state.progress.grill = 0;
    }
  }
}

function catchUp(now, showReward = true) {
  const elapsed = Math.min(
    14400,
    Math.max(
      0,
      (now - state.lastUpdatedAt) / 1000
    )
  );

  const before = {
    coins: state.coins,
    sold: state.sold,
  };

  const wholeSeconds = Math.floor(elapsed);

  for (
    let i = 0;
    i < wholeSeconds;
    i++
  ) {
    advance(1);
  }

  if (elapsed - wholeSeconds) {
    advance(
      elapsed - wholeSeconds
    );
  }

  lastTick = now;
  save(now);

  previous = {
    milk: state.milk,
    halloumi: state.halloumi,
    sold: state.sold,
  };

  if (
    showReward &&
    elapsed >= 10 &&
    state.coins > before.coins
  ) {
    pendingOffline = {
      coins:
        state.coins - before.coins,

      sold:
        state.sold - before.sold,
    };

    $('offline-detail').textContent =
      `${fmt(
        pendingOffline.sold
      )} bloc(s) vendus pendant ton absence`;

    $('offline-coins').textContent =
      `+${fmt(
        pendingOffline.coins
      )} pièces`;

    $('offline-overlay').hidden =
      false;
  }
}

function mission() {
  if (!state.firstSale) {
    return 'Trais, fabrique, puis vends ton premier bloc !';
  }

  if (!state.auto.farm) {
    return 'Recrute une fermière pour produire sans toucher.';
  }

  if (!state.auto.dairy) {
    return 'Recrute un fromager dans l’atelier.';
  }

  if (!state.auto.grill) {
    return 'Recrute un cuisinier pour automatiser les ventes.';
  }

  if (state.sold < 100) {
    return `Encore ${fmt(
      100 - state.sold
    )} blocs avant 100 ventes !`;
  }

  return 'Ton empire tourne ! Repère le prochain goulot.';
}

function bottleneck() {
  if (!state.auto.farm) {
    return 'Priorité : recruter une fermière.';
  }

  if (!state.auto.dairy) {
    return 'Priorité : automatiser l’atelier.';
  }

  if (!state.auto.grill) {
    return 'Priorité : automatiser le grill.';
  }

  if (
    state.milk === 0 &&
    state.halloumi === 0
  ) {
    return 'Manque de lait : améliore la ferme.';
  }

  if (
    state.milk >
    state.halloumi + 6
  ) {
    return 'Le lait s’accumule : améliore l’atelier.';
  }

  if (state.halloumi > 6) {
    return 'Le halloumi s’accumule : améliore le grill.';
  }

  return 'Chaîne équilibrée : augmente le rendement du poste le moins avancé.';
}

function burst(text) {
  const element = $('burst');

  element.classList.remove('fly');

  // Relance l’animation après plusieurs taps.
  void element.offsetWidth;

  element.textContent = text;
  element.classList.add('fly');
}

function travel(id) {
  const element = $(id);

  element.classList.remove(
    'travel'
  );

  void element.offsetWidth;

  element.classList.add(
    'travel'
  );
}

function renderSheet() {
  if (!selected) {
    return;
  }

  const key = selected;

  $('sheet-title').textContent =
    LABEL[key];

  $('sheet-level').textContent =
    fmt(state.levels[key]);

  $('sheet-output').textContent =
    key === 'grill'
      ? `${fmt(
          price()
        )} pièces / bloc`
      : `${fmt(
          state.levels[key]
        )} ${
          key === 'farm'
            ? 'lait'
            : 'bloc(s)'
        } / cycle`;

  $('sheet-status').textContent =
    state.auto[key]
      ? `Employé recruté · 1 cycle toutes les ${cycle(
          key
        ).toFixed(1)} s`
      : 'Production manuelle : recrute un employé pour automatiser.';

  const upgradeButton =
    $('upgrade');

  upgradeButton.textContent =
    `Améliorer · ${fmt(
      upgradeCost(key)
    )} pièces`;

  upgradeButton.disabled =
    state.coins <
    upgradeCost(key);

  $('upgrade-preview').textContent =
    key === 'grill'
      ? `Prochain niveau : ${fmt(
          price() + 3
        )} pièces par bloc.`
      : `Prochain niveau : ${fmt(
          state.levels[key] + 1
        )} par cycle.`;

  const hireButton =
    $('automate');

  hireButton.textContent =
    state.auto[key]
      ? '✓ Employé recruté'
      : `Recruter · ${fmt(
          HIRE[key]
        )} pièces`;

  hireButton.disabled =
    state.auto[key] ||
    state.coins < HIRE[key];
}

function render() {
  $('coins').textContent =
    fmt(state.coins);

  $('milk').textContent =
    fmt(state.milk);

  $('halloumi').textContent =
    fmt(state.halloumi);

  $('price').textContent =
    fmt(price());

  $('sold').textContent =
    fmt(state.sold);

  $('taps').textContent =
    fmt(state.taps);

  $('objective').textContent =
    mission();

  $('bottleneck').textContent =
    bottleneck();

  const theoreticalIncome =
    state.auto.grill
      ? (
          60 /
          cycle('grill')
        ) *
        state.levels.grill *
        price()
      : 0;

  $('income').textContent =
    `≤ ${fmt(
      theoreticalIncome
    )}/min`;

  for (const key of STATIONS) {
    $(`${key}-level`).textContent =
      `Niv. ${fmt(
        state.levels[key]
      )}`;

    $(`${key}-worker`).hidden =
      !state.auto[key];

    /*
     * Les jauges existaient dans le premier
     * écran V0.3, mais pas dans la nouvelle
     * carte. On ne les actualise que si elles
     * sont présentes.
     */
    const meter =
      $(`${key}-meter`);

    if (meter) {
      meter.style.width =
        state.auto[key]
          ? `${Math.min(
              100,
              (
                state.progress[key] /
                cycle(key)
              ) * 100
            )}%`
          : '0%';
    }

    const manualButton =
      document.querySelector(
        `[data-manual="${key}"]`
      );

    manualButton.disabled =
      key === 'dairy'
        ? state.milk < 1
        : key === 'grill'
          ? state.halloumi < 1
          : false;
  }

  const milestones = [
    [
      state.firstSale,
      'Premier bloc vendu',
    ],
    [
      state.auto.farm,
      'Ferme automatisée',
    ],
    [
      state.auto.dairy,
      'Atelier automatisé',
    ],
    [
      state.auto.grill,
      'Grill automatisé',
    ],
    [
      state.sold >= 100,
      '100 blocs vendus',
    ],
  ];

  $('milestones').replaceChildren(
    ...milestones.map(
      ([done, text]) => {
        const item =
          document.createElement(
            'div'
          );

        item.className =
          'achievement' +
          (done ? ' complete' : '');

        item.textContent =
          `${
            done ? '✦' : '○'
          }  ${text}`;

        return item;
      }
    )
  );

  renderSheet();
}

function openSheet(key) {
  selected = key;

  renderSheet();

  $('station-overlay').hidden =
    false;

  $('close-sheet').focus();
}

function closeSheet() {
  $('station-overlay').hidden =
    true;

  selected = null;
}

function tab(name) {
  currentTab = name;

  for (const key of [
    'island',
    'achievements',
    'empire',
  ]) {
    $(`screen-${key}`).hidden =
      key !== name;
  }

  document.querySelector(
    '.objective'
  ).hidden = name !== 'island';

  $('screen-title').textContent =
    {
      island: 'Mon île',
      achievements: 'Exploits',
      empire: 'Empire',
    }[name];

  for (
    const button of
    document.querySelectorAll(
      '[data-tab]'
    )
  ) {
    const current =
      button.dataset.tab === name;

    button.classList.toggle(
      'selected',
      current
    );

    if (current) {
      button.setAttribute(
        'aria-current',
        'page'
      );
    } else {
      button.removeAttribute(
        'aria-current'
      );
    }
  }
}

document.addEventListener(
  'click',
  (event) => {
    const button =
      event.target.closest(
        'button'
      );

    if (
      button?.dataset.tab
    ) {
      tab(
        button.dataset.tab
      );

      return;
    }

    if (
      button?.id === 'collect'
    ) {
      pendingOffline = null;

      $('offline-overlay').hidden =
        true;

      return;
    }

    if (
      button?.id ===
        'close-sheet' ||
      button?.id ===
        'close-scrim'
    ) {
      closeSheet();

      return;
    }

    if (
      button?.id === 'reset'
    ) {
      if (
        !window.confirm(
          'Effacer ta partie et recommencer ?'
        )
      ) {
        return;
      }

      state = blank();

      previous = {
        milk: 0,
        halloumi: 0,
        sold: 0,
      };

      closeSheet();
      tab('island');
      save();
      render();

      toast(
        'Nouvelle partie commencée !'
      );

      return;
    }

    if (
      button?.id ===
        'upgrade' &&
      selected
    ) {
      const key = selected;
      const cost =
        upgradeCost(key);

      if (
        state.coins < cost
      ) {
        return;
      }

      state.coins -= cost;
      state.levels[key] += 1;

      toast(
        `${LABEL[key]} amélioré !`
      );

      save();
      render();

      return;
    }

    if (
      button?.id ===
        'automate' &&
      selected
    ) {
      const key = selected;

      if (
        state.auto[key] ||
        state.coins <
          HIRE[key]
      ) {
        return;
      }

      state.coins -=
        HIRE[key];

      state.auto[key] =
        true;

      toast(
        `Employé recruté : ${LABEL[key]} automatisé !`
      );

      save();
      render();

      return;
    }

    if (
      button?.dataset.manual
    ) {
      const key =
        button.dataset.manual;

      if (
        key === 'farm'
      ) {
        state.milk +=
          state.levels.farm;

        travel(
          'milk-cargo'
        );

        burst(
          `+${
            state.levels.farm
          } lait`
        );
      } else if (
        key === 'dairy' &&
        state.milk >= 1
      ) {
        const quantity =
          Math.min(
            state.milk,
            state.levels.dairy
          );

        state.milk -=
          quantity;

        state.halloumi +=
          quantity;

        travel(
          'halloumi-cargo'
        );

        burst(
          `+${quantity} bloc(s)`
        );
      } else if (
        key === 'grill' &&
        state.halloumi >= 1
      ) {
        const quantity =
          Math.min(
            state.halloumi,
            state.levels.grill
          );

        sell(quantity);

        burst(
          `+${
            quantity *
            price()
          } pièces`
        );
      } else {
        return;
      }

      state.taps++;

      previous = {
        milk: state.milk,
        halloumi:
          state.halloumi,
        sold: state.sold,
      };

      save();
      render();

      return;
    }

    if (
      !button &&
      !$(
        'station-overlay'
      ).hidden
    ) {
      return;
    }

    const station =
      event.target.closest(
        '[data-open]'
      );

    if (
      station &&
      currentTab ===
        'island'
    ) {
      openSheet(
        station.dataset.open
      );
    }
  }
);

document.addEventListener(
  'keydown',
  (event) => {
    if (
      event.key ===
        'Escape' &&
      !$(
        'station-overlay'
      ).hidden
    ) {
      closeSheet();
    }

    if (
      (
        event.key ===
          'Enter' ||
        event.key ===
          ' '
      ) &&
      event.target.matches(
        '[data-open]'
      )
    ) {
      event.preventDefault();

      openSheet(
        event.target.dataset.open
      );
    }
  }
);

catchUp(Date.now());
render();
tab('island');

setInterval(() => {
  if (
    document.hidden ||
    !$(
      'offline-overlay'
    ).hidden
  ) {
    return;
  }

  const now = Date.now();

  const elapsed =
    Math.max(
      0,
      Math.min(
        14400,
        (
          now - lastTick
        ) / 1000
      )
    );

  lastTick = now;

  if (
    elapsed > 3
  ) {
    catchUp(now);
    render();

    return;
  }

  advance(elapsed);

  if (
    currentTab ===
      'island' &&
    $(
      'station-overlay'
    ).hidden
  ) {
    if (
      state.milk >
      previous.milk
    ) {
      travel(
        'milk-cargo'
      );
    }

    if (
      state.halloumi >
      previous.halloumi
    ) {
      travel(
        'halloumi-cargo'
      );
    }

    if (
      state.sold >
      previous.sold
    ) {
      burst(
        `+${
          (
            state.sold -
            previous.sold
          ) *
          price()
        } pièces`
      );
    }
  }

  previous = {
    milk: state.milk,
    halloumi:
      state.halloumi,
    sold: state.sold,
  };

  if (
    now - lastSave >=
    3000
  ) {
    save(now);
  }

  render();
}, 250);

document.addEventListener(
  'visibilitychange',
  () => {
    if (
      document.hidden
    ) {
      save();
    } else {
      catchUp(
        Date.now()
      );

      render();
    }
  }
);

window.addEventListener(
  'pagehide',
  () => save()
);
