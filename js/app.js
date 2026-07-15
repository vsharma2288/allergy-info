const ALLERGEN_COLORS = {
  'Gluten': 'var(--c-gluten)',
  'Soja': 'var(--c-soja)',
  'Fruit à Coques': 'var(--c-noix)',
  'Arachides': 'var(--c-arachides)',
  'Sésame': 'var(--c-sesame)',
  'Moutardes': 'var(--c-moutardes)',
  'Lupin': 'var(--c-lupin)',
  'Sulfites': 'var(--c-sulfites)',
};

// Colors handed out (in order, cycling if needed) to any allergen found in the
// sheet that isn't in the fixed list above, so new allergens still look distinct.
const FALLBACK_PALETTE = [
  '#8e6b3f', '#4b7f8c', '#a3527a', '#5a7d3f',
  '#c2703d', '#3f5f8c', '#7d3f6b', '#8c7a3f',
];

function getAllergenColor(a) {
  if (ALLERGEN_COLORS[a]) return ALLERGEN_COLORS[a];
  // Deterministically pick a fallback color based on the allergen's own name,
  // so the same unknown allergen always gets the same color across reloads.
  let hash = 0;
  for (let i = 0; i < a.length; i++) hash = (hash * 31 + a.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

// Built dynamically from whatever allergens actually appear in the loaded data,
// so a brand-new allergen added in the Google Sheet automatically gets a chip.
let ALL_ALLERGENS = Object.keys(ALLERGEN_COLORS);

function computeAllergensFromData(data) {
  const found = new Set();
  data.forEach(item => item.a.forEach(a => found.add(a)));

  // Known allergens first (stable, familiar order), then any newly discovered
  // ones appended alphabetically.
  const known = Object.keys(ALLERGEN_COLORS).filter(a => found.has(a));
  const unknown = [...found].filter(a => !ALLERGEN_COLORS[a]).sort((a, b) => a.localeCompare(b, 'fr'));
  return [...known, ...unknown];
}

function normalize(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const selected = new Set();
let query = '';
let DATA = [];

const chipsEl = document.getElementById('chips');
const listEl = document.getElementById('list');
const countEl = document.getElementById('count');
const emptyEl = document.getElementById('emptyState');
const clearBtn = document.getElementById('clearBtn');
const searchEl = document.getElementById('search');
const logoSlot = document.getElementById('logoSlot');
const logoImg = document.getElementById('logo');

logoImg.addEventListener('error', () => {
  logoImg.style.display = 'none';
  logoSlot.classList.add('logo-empty');
});

function buildChips() {
  chipsEl.innerHTML = ALL_ALLERGENS.map(a => `
    <div class="chip" data-allergen="${a}">
      <span class="dot" style="background:${getAllergenColor(a)}"></span>
      <span>${a}</span>
    </div>
  `).join('');

  chipsEl.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const a = chip.dataset.allergen;
      if (selected.has(a)) { selected.delete(a); chip.classList.remove('active'); }
      else { selected.add(a); chip.classList.add('active'); }
      render();
    });
  });
}

function render() {
  const q = normalize(query.trim());
  const filtered = DATA.filter(item => {
    if (q && !normalize(item.n).includes(q)) return false;
    if (selected.size > 0 && item.a.some(a => selected.has(a))) return false;
    return true;
  });

  countEl.innerHTML = `<b>${filtered.length}</b> sur ${DATA.length} plats`;
  clearBtn.classList.toggle('show', selected.size > 0 || query.trim().length > 0);

  if (filtered.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';

  listEl.innerHTML = filtered.map(item => {
    const tags = item.a.map(a => `
      <span class="tag"><span class="dot" style="background:${getAllergenColor(a)}"></span>${a}</span>
    `).join('');
    const rightSide = item.a.length === 0
      ? '<span class="safe-badge">✓ Aucun allergène listé</span>'
      : `<div class="tag-row">${tags}</div>`;
    return `
      <div class="card">
        <span class="dish-name">${item.n}</span>
        ${rightSide}
      </div>
    `;
  }).join('');
}

clearBtn.addEventListener('click', () => {
  selected.clear();
  query = '';
  searchEl.value = '';
  chipsEl.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  render();
});

searchEl.addEventListener('input', (e) => {
  query = e.target.value;
  render();
});

// ---- Live data source: published Google Sheet (CSV) ----
// In Google Sheets: File > Share > Publish to web > select the data tab >
// format "Comma-separated values (.csv)" > Publish. Paste the resulting URL below.
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRp60hrrKhswT2kwzKuhYVOdDi8mBILeMzA-Qs_BujDXAJbl5AlS5iSH52xglt0720a9Y8ZXhXyoGTl/pub?gid=105391164&single=true&output=csv';

// Column names as they appear in row 1 of the sheet
const COL_NAME = 'Désignation';
const COL_ALLERGENS = 'Allergènes';

function parseAllergenCell(cell) {
  if (!cell) return [];
  const trimmed = cell.trim();
  if (trimmed === '' || trimmed === '/') return [];
  return trimmed
    .split(',')
    .map(a => a.trim())
    .filter(a => a.length > 0 && a !== '/');
}

function loadFromSheet() {
  // cache-bust so browsers/CDNs don't serve a stale copy of the CSV
  const url = SHEET_CSV_URL + (SHEET_CSV_URL.includes('?') ? '&' : '?') + 'cachebust=' + Date.now();

  return fetch(url)
    .then(res => {
      if (!res.ok) throw new Error('Network response was not ok');
      return res.text();
    })
    .then(csvText => new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: reject,
      });
    }))
    .then(rows => {
      return rows
        .filter(row => row[COL_NAME] && row[COL_NAME].trim() !== '')
        .map(row => ({
          n: row[COL_NAME].trim(),
          a: parseAllergenCell(row[COL_ALLERGENS]),
        }));
    });
}

// Fallback to the last known-good local copy if the live sheet can't be reached
function loadFromLocalFallback() {
  return fetch('data/data.json').then(res => res.json());
}

loadFromSheet()
  .then(data => {
    console.log(`Loaded ${data.length} dishes from Google Sheet.`);
    DATA = data;
    ALL_ALLERGENS = computeAllergensFromData(DATA);
    buildChips();
    render();
  })
  .catch((err) => {
    console.warn('Live sheet fetch failed, falling back to local data.json:', err);
    loadFromLocalFallback()
      .then(data => {
        console.log(`Loaded ${data.length} dishes from local fallback data.json.`);
        DATA = data;
        ALL_ALLERGENS = computeAllergensFromData(DATA);
        buildChips();
        render();
      })
      .catch(() => {
        listEl.innerHTML = '<div class="empty-state"><div class="big">Impossible de charger les données</div><div>Vérifiez la connexion et que le lien Google Sheet est bien publié.</div></div>';
      });
  });
