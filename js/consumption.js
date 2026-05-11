/**
 * consumption.js — Energy by sector (bar chart + cards) + top per-capita consumers.
 *
 * Dependencies (CDN):  chart.js@4.4.0
 * Data files:          data/by_sector.json, data/by_country.json
 */

/* ── Sector metadata ─────────────────────────────────────────── */

const SECTORS = ['industry', 'transport', 'residential', 'commercial', 'agriculture', 'other'];

const SECTOR_META = {
  industry:    { label: 'Industry',    icon: '🏭', color: '#f59e0b', desc: 'Manufacturing, mining, construction, and chemical production' },
  transport:   { label: 'Transport',   icon: '✈️',  color: '#0ea5e9', desc: 'Road vehicles, aviation, shipping, and rail' },
  residential: { label: 'Residential', icon: '🏠', color: '#10b981', desc: 'Home heating, cooling, appliances, and lighting' },
  commercial:  { label: 'Commercial',  icon: '🏢', color: '#8b5cf6', desc: 'Offices, retail, hospitals, and public buildings' },
  agriculture: { label: 'Agriculture', icon: '🌾', color: '#84cc16', desc: 'Farming, forestry, and fishing machinery' },
  other:       { label: 'Other',       icon: '⚡', color: '#64748b', desc: 'Non-energy uses and energy sector own-use' },
};

const WORLD_POP = 8_000_000_000;

/* Rank colors: 1st (amber) → 10th (deep blue) */
const RANK_COLORS = [
  '#f97316', '#f06430', '#e5484d', '#d03271', '#b02891',
  '#8b24ad', '#6621c2', '#4622d4', '#2832c2', '#1d4ed8',
];

/* ── Chart.js defaults ───────────────────────────────────────── */
Chart.defaults.color = '#64748b';
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";

/* ── Horizontal bar chart ────────────────────────────────────── */
function renderChart(world, total) {
  const ctx = document.getElementById('chart-sectors').getContext('2d');

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: SECTORS.map(s => SECTOR_META[s].label),
      datasets: [{
        data: SECTORS.map(s => world[s] || 0),
        backgroundColor: SECTORS.map(s => SECTOR_META[s].color + '55'),
        borderColor:     SECTORS.map(s => SECTOR_META[s].color),
        borderWidth: 1.5,
        borderRadius: 3,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1100, easing: 'easeOutQuart' },
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
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          border: { display: false },
          ticks: {
            color: '#64748b',
            font: { size: 10 },
            callback: v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v,
          },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: '#94a3b8', font: { size: 11 } },
        },
      },
    },
  });
}

/* ── Sector cards ────────────────────────────────────────────── */
function renderCards(world, total) {
  const grid = document.getElementById('sector-grid');

  grid.innerHTML = SECTORS.map(s => {
    const { label, icon, color, desc } = SECTOR_META[s];
    const twh    = world[s] || 0;
    const pct    = (twh / total * 100).toFixed(1);
    const kwh_pc = Math.round((twh * 1e9) / WORLD_POP).toLocaleString();

    return `<div class="sector-card" style="--sc-color:${color}">
      <div class="sc-top">
        <span class="sc-icon">${icon}</span>
        <span class="sc-name">${label}</span>
      </div>
      <div class="sc-value">${Math.round(twh).toLocaleString()}</div>
      <div class="sc-unit-label">TWh / year</div>
      <div class="sc-bar-row">
        <div class="sc-bar">
          <div class="sc-fill" style="width:${pct}%"></div>
        </div>
        <span class="sc-pct">${pct}%</span>
      </div>
      <div class="sc-percapita">
        <strong>${kwh_pc} kWh</strong> per person per year
      </div>
      <div class="sc-desc-text">${desc}</div>
    </div>`;
  }).join('');
}

/* ── Per-capita ranked list ──────────────────────────────────── */
function renderPerCapita(countries, dataYear) {
  document.getElementById('percapita-year').textContent = dataYear;

  const top10 = [...countries]
    .filter(c => c.energy_per_capita_kwh > 0)
    .sort((a, b) => b.energy_per_capita_kwh - a.energy_per_capita_kwh)
    .slice(0, 10);

  const maxVal = top10[0].energy_per_capita_kwh;

  document.getElementById('percapita-list').innerHTML = top10.map((c, i) => {
    const val    = Math.round(c.energy_per_capita_kwh).toLocaleString();
    const barPct = (c.energy_per_capita_kwh / maxVal * 100).toFixed(1);
    const color  = RANK_COLORS[i];

    return `<div class="t10-item">
      <span class="t10-rank">${i + 1}</span>
      <div class="t10-dot" style="background:${color}"></div>
      <span class="t10-name">${c.name}</span>
      <span class="t10-val">${val} kWh</span>
      <div class="t10-bar">
        <div class="t10-fill" style="width:${barPct}%;background:${color}55;border-right:2px solid ${color}"></div>
      </div>
    </div>`;
  }).join('');
}

/* ── Data note ───────────────────────────────────────────────── */
function renderNote(data) {
  const el = document.getElementById('data-note');
  el.innerHTML = `
    <strong>Note on methodology:</strong> These figures represent
    <strong>final energy consumption</strong> — the energy actually delivered to
    end users — not primary energy. Primary energy (shown on the Generation page)
    is roughly 50% higher because it includes conversion losses in power plants,
    refineries, and transmission networks. Data year: ${data.data_year}.
    Source: <a href="${data.source_url}" target="_blank" rel="noopener">${data.edition}</a>.`;
}

/* ── Boot ───────────────────────────────────────────────────── */
async function init() {
  try {
    const [sectorData, countryData] = await Promise.all([
      fetch('data/by_sector.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch('data/by_country.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    ]);

    const total = SECTORS.reduce((s, k) => s + (sectorData.world[k] || 0), 0);

    document.getElementById('data-year').textContent  = sectorData.data_year;
    document.getElementById('total-val').textContent  = Math.round(total).toLocaleString();

    renderChart(sectorData.world, total);
    renderCards(sectorData.world, total);
    renderPerCapita(countryData.countries, countryData.data_year);
    renderNote(sectorData);
  } catch (err) {
    console.error('Failed to load consumption data:', err);
  }
}

document.addEventListener('DOMContentLoaded', init);
