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

const ALL_ALLERGENS = Object.keys(ALLERGEN_COLORS);

function normalize(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const selected = new Set();
let mode = 'hide'; // 'hide' = masquer les plats qui contiennent ; 'show' = afficher uniquement ceux qui contiennent
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
const filterLabel = document.getElementById('filterLabel');
const modeToggle = document.getElementById('modeToggle');

modeToggle.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    mode = btn.dataset.mode;
    modeToggle.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b === btn));
    filterLabel.textContent = mode === 'hide'
      ? 'Masquer les plats contenant :'
      : 'Afficher uniquement les plats contenant :';
    render();
  });
});

logoImg.addEventListener('error', () => {
  logoImg.style.display = 'none';
  logoSlot.classList.add('logo-empty');
});

function buildChips() {
  chipsEl.innerHTML = ALL_ALLERGENS.map(a => `
    <div class="chip" data-allergen="${a}">
      <span class="dot" style="background:${ALLERGEN_COLORS[a]}"></span>
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
    if (selected.size > 0) {
      const hasAny = item.a.some(a => selected.has(a));
      if (mode === 'hide' && hasAny) return false;
      if (mode === 'show' && !hasAny) return false;
    }
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
      <span class="tag"><span class="dot" style="background:${ALLERGEN_COLORS[a] || '#999'}"></span>${a}</span>
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

fetch('data/data.json')
  .then(res => res.json())
  .then(data => {
    DATA = data;
    buildChips();
    render();
  })
  .catch(() => {
    listEl.innerHTML = '<div class="empty-state"><div class="big">Impossible de charger les données</div><div>Vérifiez que data/data.json est bien présent, et que le site est servi via http(s) (pas ouvert en double-clic).</div></div>';
  });
