/**
 * sectors.js — Energy by sector: horizontal bar chart + sector cards.
 *
 * Dependencies (CDN):  chart.js@4.4.0
 * Data file:           data/by_sector.json
 */

/* ── Sector metadata ─────────────────────────────────────────── */

const SECTORS = ['industry', 'transport', 'residential', 'commercial', 'agriculture', 'other'];

const SECTOR_META = {
  industry:    { label: 'Industry',          icon: '🏭', color: '#f59e0b', desc: 'Manufacturing, mining, construction, and chemical production' },
  transport:   { label: 'Transport',         icon: '✈️',  color: '#0ea5e9', desc: 'Road vehicles, aviation, shipping, and rail' },
  residential: { label: 'Residential',       icon: '🏠', color: '#10b981', desc: 'Home heating, cooling, appliances, and lighting' },
  commercial:  { label: 'Commercial',        icon: '🏢', color: '#8b5cf6', desc: 'Offices, retail, hospitals, and public buildings' },
  agriculture: { label: 'Agriculture',       icon: '🌾', color: '#84cc16', desc: 'Farming, forestry, and fishing machinery' },
  other:       { label: 'Other',             icon: '⚡', color: '#64748b', desc: 'Non-energy uses and energy sector own-use' },
};

const WORLD_POP = 8_000_000_000; /* approximate 2022 world population */

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
    const kwh_pc = Math.round((twh * 1e9) / WORLD_POP).toLocaleString(); /* TWh → kWh per person */

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

/* ── Data note ───────────────────────────────────────────────── */
function renderNote(data) {
  const el = document.getElementById('data-note');
  el.innerHTML = `
    <strong>Note on methodology:</strong> These figures represent
    <strong>final energy consumption</strong> — the energy actually delivered to
    end users — not primary energy. Primary energy (shown on the Overview page)
    is roughly 50% higher because it includes conversion losses in power plants,
    refineries, and transmission networks. Data year: ${data.data_year}.
    Source: <a href="${data.source_url}" target="_blank" rel="noopener">${data.edition}</a>.`;
}

/* ── Boot ───────────────────────────────────────────────────── */
async function init() {
  try {
    const data = await fetch('data/by_sector.json')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

    const total = SECTORS.reduce((s, k) => s + (data.world[k] || 0), 0);

    document.getElementById('data-year').textContent = data.data_year;
    document.getElementById('total-val').textContent = Math.round(total).toLocaleString();

    renderChart(data.world, total);
    renderCards(data.world, total);
    renderNote(data);
  } catch (err) {
    console.error('Failed to load sector data:', err);
  }
}

document.addEventListener('DOMContentLoaded', init);
