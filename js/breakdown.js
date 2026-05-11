/**
 * breakdown.js — Energy by source (donut + trend) + top-10 nations list.
 *
 * Dependencies (CDN):  chart.js@4.4.0
 * Data files:          data/by_source.json, data/by_country.json
 */

/* ── Source metadata ─────────────────────────────────────────── */

const SOURCES = [
  'coal', 'oil', 'gas', 'nuclear', 'hydro', 'solar', 'wind', 'biofuels', 'other_renewables',
];

const SOURCE_COLORS = {
  coal:             '#374151',
  oil:              '#6b7280',
  gas:              '#9ca3af',
  nuclear:          '#7c3aed',
  hydro:            '#2563eb',
  solar:            '#f59e0b',
  wind:             '#10b981',
  biofuels:         '#84cc16',
  other_renewables: '#06b6d4',
};

const SOURCE_LABELS = {
  coal:             'Coal',
  oil:              'Oil',
  gas:              'Natural Gas',
  nuclear:          'Nuclear',
  hydro:            'Hydropower',
  solar:            'Solar',
  wind:             'Wind',
  biofuels:         'Biofuels',
  other_renewables: 'Other Renewables',
};

const FOSSIL_SET = new Set(['coal', 'oil', 'gas']);

/* Rank colors: 1st (amber) → 10th (deep blue), all vivid on dark bg */
const RANK_COLORS = [
  '#f97316',  /* 1  — amber (site accent) */
  '#f06430',  /* 2  — orange              */
  '#e5484d',  /* 3  — red                 */
  '#d03271',  /* 4  — rose                */
  '#b02891',  /* 5  — fuchsia             */
  '#8b24ad',  /* 6  — purple              */
  '#6621c2',  /* 7  — violet              */
  '#4622d4',  /* 8  — indigo-violet       */
  '#2832c2',  /* 9  — indigo              */
  '#1d4ed8',  /* 10 — blue                */
];

/* ── Chart.js defaults ───────────────────────────────────────── */
Chart.defaults.color = '#64748b';
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";

/* ── Donut chart ─────────────────────────────────────────────── */
function renderDonut(world, year) {
  document.getElementById('source-year').textContent = year;

  const total = SOURCES.reduce((s, k) => s + (world[k] || 0), 0);
  document.getElementById('dc-total').textContent = Math.round(total).toLocaleString();

  const ctx = document.getElementById('chart-donut').getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: SOURCES.map(s => SOURCE_LABELS[s]),
      datasets: [{
        data: SOURCES.map(s => world[s] || 0),
        backgroundColor: SOURCES.map(s => SOURCE_COLORS[s]),
        borderWidth: 0,
        hoverOffset: 10,
        hoverBorderWidth: 0,
      }],
    },
    options: {
      cutout: '72%',
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      animation: { animateRotate: true, duration: 1200, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pct = (ctx.raw / total * 100).toFixed(1);
              return `  ${Math.round(ctx.raw).toLocaleString()} TWh · ${pct}%`;
            },
          },
        },
      },
    },
  });

  /* Legend */
  document.getElementById('source-list').innerHTML = SOURCES.map(s => {
    const v = world[s] || 0;
    const pct = (v / total * 100).toFixed(1);
    return `<div class="src-item">
      <div class="src-swatch" style="background:${SOURCE_COLORS[s]}"></div>
      <span class="src-name">${SOURCE_LABELS[s]}</span>
      <span class="src-twh">${Math.round(v).toLocaleString()}</span>
      <span class="src-pct">${pct}%</span>
    </div>`;
  }).join('');

  /* Fossil vs clean summary */
  const fossilTWh = SOURCES.filter(s => FOSSIL_SET.has(s)).reduce((a, s) => a + (world[s] || 0), 0);
  const cleanTWh  = total - fossilTWh;
  const fpct = (fossilTWh / total * 100).toFixed(1);
  const cpct = (cleanTWh  / total * 100).toFixed(1);

  document.getElementById('fossil-summary').innerHTML = `
    <div class="fs-group">
      <div class="fs-dot" style="background:#6b7280"></div>
      <span class="fs-label">Fossil fuels</span>
      <span class="fs-pct">${fpct}%</span>
    </div>
    <div class="fs-bar"><div class="fs-fill" style="width:${fpct}%"></div></div>
    <div class="fs-group">
      <div class="fs-dot" style="background:#10b981"></div>
      <span class="fs-label">Clean energy</span>
      <span class="fs-pct">${cpct}%</span>
    </div>`;
}

/* ── Trend chart ─────────────────────────────────────────────── */
function renderTrend(trend) {
  const ctx = document.getElementById('chart-trend').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: trend.map(t => t.year),
      datasets: SOURCES.map(s => ({
        label: SOURCE_LABELS[s],
        data: trend.map(t => t.sources[s] || 0),
        backgroundColor: SOURCE_COLORS[s] + 'cc',
        borderColor: 'transparent',
        borderWidth: 0,
        stack: 'energy',
        barPercentage: 1.0,
        categoryPercentage: 1.0,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900 },
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          callbacks: {
            title: items => `Year ${items[0].label}`,
            label: ctx => `  ${ctx.dataset.label}: ${Math.round(ctx.raw).toLocaleString()} TWh`,
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { color: 'rgba(255,255,255,0.04)' },
          border: { display: false },
          ticks: { color: '#64748b', maxTicksLimit: 10, font: { size: 10 } },
        },
        y: {
          stacked: true,
          grid: { color: 'rgba(255,255,255,0.05)' },
          border: { display: false },
          ticks: {
            color: '#64748b',
            font: { size: 10 },
            callback: v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v,
          },
          title: { display: true, text: 'TWh / year', color: '#475569', font: { size: 10 } },
        },
      },
    },
  });
}

/* ── Top-10 list ─────────────────────────────────────────────── */

let listMode = 'total';

function getTop10(countries, mode) {
  return [...countries]
    .sort((a, b) => {
      const va = mode === 'percapita' ? (a.energy_per_capita_kwh || 0) : a.primary_energy_twh;
      const vb = mode === 'percapita' ? (b.energy_per_capita_kwh || 0) : b.primary_energy_twh;
      return vb - va;
    })
    .slice(0, 10);
}

function renderTop10List(top10, mode) {
  const el = document.getElementById('top10-list');
  if (!el) return;

  const maxVal = mode === 'percapita'
    ? Math.max(...top10.map(c => c.energy_per_capita_kwh || 0))
    : top10[0].primary_energy_twh;

  el.innerHTML = top10.map((c, i) => {
    const val    = mode === 'percapita' ? (c.energy_per_capita_kwh || 0) : c.primary_energy_twh;
    const barPct = (val / maxVal * 100).toFixed(1);
    const color  = RANK_COLORS[i];
    const label  = mode === 'percapita'
      ? `${Math.round(val).toLocaleString()} kWh`
      : `${Math.round(val).toLocaleString()} TWh`;

    return `<div class="t10-item">
      <span class="t10-rank">${i + 1}</span>
      <div class="t10-dot" style="background:${color}"></div>
      <span class="t10-name">${c.name}</span>
      <span class="t10-val">${label}</span>
      <div class="t10-bar">
        <div class="t10-fill" style="width:${barPct}%;background:${color}55;border-right:2px solid ${color}"></div>
      </div>
    </div>`;
  }).join('');
}

function initTop10(countries, dataYear) {
  document.getElementById('top10-year').textContent = dataYear;
  renderTop10List(getTop10(countries, listMode), listMode);

  document.querySelectorAll('.map-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.map-toggle').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      listMode = btn.dataset.mode;
      renderTop10List(getTop10(countries, listMode), listMode);
    });
  });
}

/* ── Boot ───────────────────────────────────────────────────── */
async function init() {
  try {
    const [sourceData, countryData] = await Promise.all([
      fetch('data/by_source.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch('data/by_country.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    ]);

    renderDonut(sourceData.world, sourceData.data_year);
    renderTrend(sourceData.trend);
    initTop10(countryData.countries, countryData.data_year);
  } catch (err) {
    console.error('Failed to load data:', err);
  }
}

document.addEventListener('DOMContentLoaded', init);
