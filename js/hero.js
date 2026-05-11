/**
 * hero.js — rotating Earth globe, Kardashev progress ring, live data display.
 *
 * Dependencies:
 *   globe.gl (CDN, loaded before this script)
 *   data/global.json (written by scripts/fetch_data.py)
 */

/* ── Constants ──────────────────────────────────────────────── */
const RING_R           = 90;                       /* SVG ring radius (viewBox units) */
const CIRCUMFERENCE    = 2 * Math.PI * RING_R;     /* ≈ 565.49 */
const RING_CENTER      = { x: 100, y: 100 };       /* SVG viewBox centre */
const ANIM_DELAY_MS    = 600;   /* pause before ring draws in */
const NUMBER_ANIM_MS   = 2400;  /* K-number count-up duration */

/* ── Utilities ──────────────────────────────────────────────── */

/** Ease-out cubic — fast start, gentle finish */
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

/** Animate a DOM text node from `from` to `to` over `duration` ms. */
function countUp(el, from, to, duration, fmt) {
  const start = performance.now();
  function tick(now) {
    const raw     = Math.min((now - start) / duration, 1);
    const eased   = easeOut(raw);
    el.textContent = fmt(from + (to - from) * eased);
    if (raw < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/**
 * Given a progress fraction (0–1) and the SVG ring geometry, return
 * the (cx, cy) position of the arc's leading-edge tip dot.
 *
 * The arc starts at the top (12 o'clock) and fills clockwise.
 * Angle 0 = top; positive angle = clockwise.
 */
function tipPosition(fraction) {
  const angle = fraction * Math.PI * 2 - Math.PI / 2;  /* −90° offset = start at top */
  return {
    cx: RING_CENTER.x + RING_R * Math.cos(angle),
    cy: RING_CENTER.y + RING_R * Math.sin(angle),
  };
}

/* ── Globe ──────────────────────────────────────────────────── */

function initGlobe() {
  const el   = document.getElementById('globe');
  /* Read the rendered size AFTER layout is applied so the canvas
     gets exact integer pixel dimensions — this ensures the sphere
     is centred inside the canvas (matching the ring's inset:0 position). */
  const rect = el.getBoundingClientRect();
  const size = Math.round(rect.width) || 400;

  const globe = Globe({ rendererConfig: { alpha: true } })
    .width(size)
    .height(size)
    .backgroundColor('rgba(0,0,0,0)')
    .globeImageUrl('//unpkg.com/three-globe/example/img/earth-day.jpg')
    .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
    .showAtmosphere(false)
    (el);

  const controls = globe.controls();
  controls.autoRotate      = true;
  controls.autoRotateSpeed = 0.4;
  controls.enableZoom      = false;

  /* Zoom in so the Earth fills the ring ring snugly */
  globe.pointOfView({ lat: 18, lng: 10, altitude: 1.5 });

  /* Keep canvas size in sync with CSS when the window is resized */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const s = Math.round(el.getBoundingClientRect().width);
      if (s > 0) globe.width(s).height(s);
    }, 150);
  }, { passive: true });

  return globe;
}

/* ── Ring animation ─────────────────────────────────────────── */

function animateRing(progressPct) {
  const fraction = Math.min(Math.max(progressPct / 100, 0), 1);
  const arc   = document.getElementById('ring-progress');
  const pulse = document.getElementById('ring-pulse');
  const tip   = document.getElementById('ring-tip');

  setTimeout(() => {
    const offset = CIRCUMFERENCE * (1 - fraction);
    arc.style.strokeDashoffset   = offset;
    if (pulse) pulse.style.strokeDashoffset = offset;

    tip.style.opacity = '1';
    const halo = document.getElementById('ring-tip-halo');
    animateTip(tip, halo, fraction);
  }, ANIM_DELAY_MS);
}

/**
 * Move the tip dot along the circular arc from fraction=0 to targetFraction.
 * Interpolating the fraction (not raw cx/cy) keeps the dot on the ring at
 * every frame instead of cutting across as a straight chord.
 */
function animateTip(tipEl, haloEl, targetFraction) {
  const start    = performance.now();
  const duration = NUMBER_ANIM_MS;

  function tick(now) {
    const t    = Math.min((now - start) / duration, 1);
    const frac = easeOut(t) * targetFraction;
    const { cx, cy } = tipPosition(frac);
    tipEl.setAttribute('cx', cx);
    tipEl.setAttribute('cy', cy);
    if (haloEl) {
      haloEl.setAttribute('cx', cx);
      haloEl.setAttribute('cy', cy);
    }
    if (t < 1) {
      requestAnimationFrame(tick);
    } else if (haloEl) {
      haloEl.classList.add('active');  /* start radar-ping once dot arrives */
    }
  }
  requestAnimationFrame(tick);
}

/* ── Stats display ──────────────────────────────────────────── */

function updateDisplay(data) {
  /* Animated K number count-up */
  countUp(
    document.getElementById('k-number'),
    0, data.kardashev_number, NUMBER_ANIM_MS,
    v => v.toFixed(4)
  );

  /* Animated progress percentage */
  countUp(
    document.getElementById('k-progress-text'),
    0, data.kardashev_progress_pct, NUMBER_ANIM_MS,
    v => `${v.toFixed(2)}% toward Type I`
  );

  /* Static stats */
  const energyTWh = data.total_primary_energy_twh;
  document.getElementById('k-energy').textContent =
    `${Math.round(energyTWh).toLocaleString()} TWh/yr`;

  document.getElementById('k-power').textContent =
    `${data.average_power_tw.toFixed(2)} TW`;

  const footer = document.getElementById('data-footer');
  if (footer) {
    const src = data.source.split('/')[0].trim();
    footer.innerHTML =
      `Data as of ${data.dataset_published} &middot; <a href="https://ourworldindata.org/energy" target="_blank" rel="noopener">${src}</a>`;
  }
}

/* ── Boot ───────────────────────────────────────────────────── */

async function init() {
  /* Start globe immediately — doesn't need data */
  try {
    initGlobe();
  } catch (err) {
    console.warn('Globe init failed:', err);
  }

  /* Fetch data then animate ring + stats */
  try {
    const resp = await fetch('data/global.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    updateDisplay(data);
    animateRing(data.kardashev_progress_pct);
  } catch (err) {
    console.error('Could not load global.json:', err);
    document.getElementById('k-number').textContent        = '—';
    document.getElementById('k-progress-text').textContent = '';
  }
}

document.addEventListener('DOMContentLoaded', init);
