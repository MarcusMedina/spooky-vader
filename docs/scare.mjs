// Click a figure: it runs off to its own side, and the UFO beams it back after `delay` ms. Each figure is independent.
// Expects layers with data-fig="m" (the man, left) and data-fig="f" (the woman, right) inside `frame`.
const REDUCED = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
// where the figures stand (fractions of width/height); the man is left of 0.5, the woman right of it
const HIT = { x0: 0.22, x1: 0.78, split: 0.5, y0: 0.05, y1: 0.97 };
const DIR = { m: -1, f: 1 };

export function attachScare(frame, { delay = 15000, onAway = () => {}, onBack = () => {} } = {}) {
  const state = { m: { busy: false, timer: null, glow: null }, f: { busy: false, timer: null, glow: null } };
  const layer = (k) => frame.querySelector(`[data-fig="${k}"]`);
  const anyAway = () => state.m.busy || state.f.busy;

  function reset() {
    for (const k of ["m", "f"]) {
      const s = state[k], el = layer(k);
      clearTimeout(s.timer); s.timer = null; s.busy = false; s.glow?.remove(); s.glow = null;
      if (el) { el.getAnimations().forEach((a) => a.cancel()); el.style.transformOrigin = ""; }
    }
  }

  function runAway(k) {
    const s = state[k], el = layer(k);
    if (s.busy || !el) return;
    s.busy = true; onAway(k);
    if (REDUCED()) el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
    else {
      const N = 8, kf = [];
      for (let i = 0; i <= N; i++) {
        const p = i / N;
        kf.push({ transform: `translate(${DIR[k] * 110 * p ** 1.5}%, ${i % 2 && i < N ? -3 : 0}%) rotate(${DIR[k] * 6}deg)`, offset: p });
      }
      el.animate(kf, { duration: 1500, easing: "ease-in", fill: "forwards" });
    }
    s.timer = setTimeout(() => beamBack(k), delay);
  }

  function beamBack(k) {
    const s = state[k], el = layer(k);
    if (!el) return;
    const glow = s.glow = document.createElement("div");
    Object.assign(glow.style, {
      position: "absolute", inset: "0", pointerEvents: "none", opacity: "0",
      clipPath: "polygon(36% 17%, 64% 17%, 79% 94%, 21% 94%)",
      background: "linear-gradient(#e8ffc0, rgba(182,255,154,.15))",
    });
    frame.insertBefore(glow, layer("f") ?? el);
    if (!REDUCED()) glow.animate([{ opacity: 0 }, { opacity: 0.8, offset: 0.3 }, { opacity: 0.8, offset: 0.7 }, { opacity: 0 }], { duration: 2600 });
    el.getAnimations().forEach((a) => a.cancel());
    el.style.transformOrigin = "50% 13%"; // the UFO
    const anim = el.animate(
      REDUCED() ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: "scale(.04)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }],
      { duration: REDUCED() ? 200 : 1600, easing: "ease-out", fill: "both" });
    anim.finished.then(() => {
      anim.cancel(); el.style.transformOrigin = ""; glow.remove(); s.glow = null; s.busy = false;
      if (!anyAway()) onBack();
    }).catch(() => {});
  }

  /** which figure is under the pointer, or null */
  const hit = (e) => {
    const r = frame.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (x < HIT.x0 || x > HIT.x1 || y < HIT.y0 || y > HIT.y1) return null;
    return x < HIT.split ? "m" : "f";
  };
  frame.addEventListener("click", (e) => { const k = hit(e); if (k) runAway(k); });
  frame.addEventListener("mousemove", (e) => { const k = hit(e); frame.style.cursor = k && !state[k].busy ? "pointer" : ""; });
  // keyboard: Enter/Space sends whichever figure is still home (the man first)
  frame.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault(); runAway(!state.m.busy ? "m" : "f");
  });
  return { reset };
}
