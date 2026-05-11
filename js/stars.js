/**
 * stars.js — animated star field on a full-viewport canvas.
 * Each star twinkles independently via a sine wave.
 */
(function () {
  const canvas = document.getElementById('stars');
  const ctx    = canvas.getContext('2d');

  const STAR_COUNT = 320;
  const stars = [];

  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    stars.length  = 0;
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x:     rand(0, canvas.width),
        y:     rand(0, canvas.height),
        r:     rand(0.25, 1.4),
        base:  rand(0.25, 0.85),   /* base opacity */
        phase: rand(0, Math.PI * 2),
        freq:  rand(0.2, 0.9),     /* twinkle frequency (Hz) */
      });
    }
  }

  function frame(ms) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const t = ms / 1000;

    for (const s of stars) {
      const alpha = s.base * (0.55 + 0.45 * Math.sin(t * s.freq * Math.PI * 2 + s.phase));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 215, 255, ${alpha.toFixed(3)})`;
      ctx.fill();
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();
  requestAnimationFrame(frame);
})();
