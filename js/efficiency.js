/**
 * efficiency.js — Energy conversion gap, source efficiencies, and pathways to K=1.
 *
 * Data files: data/global.json, data/by_sector.json
 */

/* TWh/yr → Watts:  E(Wh) = E(TWh) × 10^12;  P(W) = E(Wh) / t(h) */
const TWH_PER_YEAR_TO_W = 1e12 / 8760;

/* ── Source efficiency data (static, physics-based values) ───── */
const SOURCE_EFF = [
  {
    label: 'Coal',
    color: '#374151',
    eff: 33,
    type: 'fossil',
    note: 'Steam-cycle thermal limit. ~67% of coal\'s heat content is discharged as waste heat at power stations.',
  },
  {
    label: 'Oil · ICE',
    color: '#6b7280',
    eff: 25,
    type: 'fossil',
    note: 'Internal combustion engines convert ~25% of fuel energy to motion. The rest leaves as exhaust heat and friction.',
  },
  {
    label: 'Natural Gas',
    color: '#9ca3af',
    eff: 58,
    type: 'fossil',
    note: 'Combined-cycle gas turbines are the most efficient fossil option, yet still discard ~42% of input energy as heat.',
  },
  {
    label: 'Nuclear',
    color: '#7c3aed',
    eff: 33,
    type: 'thermal',
    note: 'Subject to the same Rankine steam-cycle thermodynamic limit as coal. The fission heat source doesn\'t change the conversion bottleneck.',
  },
  {
    label: 'Hydropower',
    color: '#2563eb',
    eff: 90,
    type: 'renewable',
    note: 'Hydraulic turbines convert ~90% of water\'s gravitational potential energy to electricity — among the highest efficiencies of any machine.',
  },
  {
    label: 'Solar PV',
    color: '#f59e0b',
    eff: 98,
    type: 'renewable',
    note: 'All captured solar electricity flows directly to the grid with no thermal waste. Panel efficiency limits how much sunlight is captured, not how efficiently captured energy is used.',
  },
  {
    label: 'Wind',
    color: '#10b981',
    eff: 98,
    type: 'renewable',
    note: 'Turbines convert extracted wind energy to electricity with minimal losses. Uncaptured wind simply continues flowing — it is not "wasted" in any thermodynamic sense.',
  },
  {
    label: 'Biofuels',
    color: '#84cc16',
    eff: 35,
    type: 'fossil',
    note: 'Burned in combustion engines or thermal plants. Subject to the same thermodynamic conversion limits as other heat-based sources.',
  },
];

/* ── Efficiency pathways (static content) ────────────────────── */
const PATHWAYS = [
  {
    icon: '🚗',
    title: 'Electrify Transport',
    metric: '3–4×',
    metricLabel: 'efficiency gain',
    color: '#0ea5e9',
    body: 'Internal combustion engines waste ~75% of fuel as heat. Electric motors convert ~90% of electrical energy to motion. Electrifying the global vehicle fleet would cut transport\'s primary energy demand by up to 70% while delivering the same mobility.',
    impact: 'Transport sector: 29,700 TWh final energy — the second-largest consumer globally.',
  },
  {
    icon: '☀️',
    title: 'Decarbonise Power',
    metric: '2–3×',
    metricLabel: 'efficiency gain',
    color: '#f59e0b',
    body: 'Coal and gas power plants discard 40–67% of fuel energy as waste heat before electrons reach the grid. Solar and wind convert captured energy to electricity with near-zero conversion loss. Replacing thermal generation eliminates the single largest category of energy waste.',
    impact: 'Fossil fuels: 80%+ of primary energy, each thermal plant running at 33–58% efficiency.',
  },
  {
    icon: '🔌',
    title: 'Modernise the Grid',
    metric: '6–8%',
    metricLabel: 'transmission recovered',
    color: '#10b981',
    body: 'Global electricity transmission loses 7–8% in line resistance and distribution inefficiency. High-voltage DC lines, superconducting cables, and smart-grid technology can reduce this below 2%, recovering over 5% of all electricity ever generated.',
    impact: 'At current scale: ~1,500 TWh recovered annually through grid modernisation alone.',
  },
  {
    icon: '🏠',
    title: 'Insulate Buildings',
    metric: '30–50%',
    metricLabel: 'heating energy saved',
    color: '#8b5cf6',
    body: 'Residential and commercial heating dominate the building sector. Modern passive-house standards cut heating demand by 80–90% versus average stock. Deep retrofits of existing buildings would eliminate hundreds of TWh of energy lost to inadequate insulation.',
    impact: 'Residential (26,000 TWh) + Commercial (11,200 TWh) = 37,200 TWh of final energy annually.',
  },
];

/* ── Render functions ────────────────────────────────────────── */

function renderGap(primaryTWh, finalTWh, dataYear) {
  const lostTWh  = primaryTWh - finalTWh;
  const finalPct = (finalTWh / primaryTWh * 100).toFixed(1);
  const lostPct  = (lostTWh  / primaryTWh * 100).toFixed(1);

  document.getElementById('gap-year').textContent    = dataYear;
  document.getElementById('gap-primary').textContent = Math.round(primaryTWh).toLocaleString();
  document.getElementById('gap-final').textContent   = Math.round(finalTWh).toLocaleString();
  document.getElementById('gap-lost-val').textContent = Math.round(lostTWh).toLocaleString();

  /* Animate bar after a brief paint delay */
  requestAnimationFrame(() => {
    setTimeout(() => {
      document.getElementById('gap-bar-final').style.width = finalPct + '%';
      document.getElementById('gap-bar-lost').style.width  = lostPct  + '%';
    }, 120);
  });

  document.getElementById('gbl-used').textContent = finalPct + '% delivered';
  document.getElementById('gbl-lost').textContent = lostPct  + '% lost';
}

function renderKScale(primaryTWh, finalTWh) {
  const kPrimary = (Math.log10(primaryTWh * TWH_PER_YEAR_TO_W) - 6) / 10;
  const kFinal   = (Math.log10(finalTWh   * TWH_PER_YEAR_TO_W) - 6) / 10;

  document.getElementById('ks-primary').textContent     = kPrimary.toFixed(4);
  document.getElementById('ks-final').textContent       = kFinal.toFixed(4);
  document.getElementById('ks-primary-twh').textContent = Math.round(primaryTWh).toLocaleString();
  document.getElementById('ks-final-twh').textContent   = Math.round(finalTWh).toLocaleString();
}

function renderSourceEff() {
  document.getElementById('src-eff-grid').innerHTML = SOURCE_EFF.map(s => `
    <div class="src-eff-card eff-type-${s.type}">
      <div class="seff-header">
        <div class="seff-dot" style="background:${s.color}"></div>
        <span class="seff-name">${s.label}</span>
        <span class="seff-pct">${s.eff}%</span>
      </div>
      <div class="seff-bar-track">
        <div class="seff-bar-fill" style="width:${s.eff}%;background:${s.color}"></div>
      </div>
      <p class="seff-note">${s.note}</p>
    </div>
  `).join('');
}

function renderPathways() {
  document.getElementById('pathway-grid').innerHTML = PATHWAYS.map(p => `
    <div class="pathway-card" style="--pw-color:${p.color}">
      <div class="pw-header">
        <span class="pw-icon">${p.icon}</span>
        <div class="pw-title-wrap">
          <span class="pw-title">${p.title}</span>
          <span class="pw-metric">${p.metric} <span class="pw-metric-label">${p.metricLabel}</span></span>
        </div>
      </div>
      <p class="pw-body">${p.body}</p>
      <div class="pw-impact">${p.impact}</div>
    </div>
  `).join('');
}

/* ── Boot ───────────────────────────────────────────────────── */
async function init() {
  try {
    const [globalData, sectorData] = await Promise.all([
      fetch('data/global.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch('data/by_sector.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    ]);

    const primaryTWh = globalData.total_primary_energy_twh;
    const finalTWh   = Object.values(sectorData.world).reduce((a, b) => a + b, 0);

    renderGap(primaryTWh, finalTWh, globalData.data_year);
    renderKScale(primaryTWh, finalTWh);
    renderSourceEff();
    renderPathways();
  } catch (err) {
    console.error('Failed to load efficiency data:', err);
  }
}

document.addEventListener('DOMContentLoaded', init);
