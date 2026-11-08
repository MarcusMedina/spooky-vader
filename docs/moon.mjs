// Pure and browser-safe: moon phase from the date alone (mean synodic month, accurate to roughly +-half a day).
const SYNODIC = 29.530588853;
const NEW_MOON_2000 = Date.UTC(2000, 0, 6, 18, 14); // a known new moon
export const PHASES = ["Nymåne", "Växande skära", "Första kvarteret", "Växande måne", "Fullmåne", "Avtagande måne", "Sista kvarteret", "Avtagande skära"];

/** -> { age (days since new moon), illumination 0..1, waxing, index 0..7, name } */
export function moonPhase(date) {
  const age = ((((date - NEW_MOON_2000) / 864e5) % SYNODIC) + SYNODIC) % SYNODIC;
  const theta = (2 * Math.PI * age) / SYNODIC;
  const index = Math.round((age / SYNODIC) * 8) % 8;
  return { age, illumination: (1 - Math.cos(theta)) / 2, waxing: age < SYNODIC / 2, index, name: PHASES[index] };
}

/** Inline SVG (viewBox -60 -60 120 120) of the moon with its lit part, waxing = lit on the right (Swedish sky: northern hemisphere). */
export function moonSvg(date) {
  const m = moonPhase(date), R = 48, theta = (2 * Math.PI * m.age) / SYNODIC;
  const cos = Math.cos(theta), rx = (R * Math.abs(cos)).toFixed(1);
  const lit = `M 0 ${-R} A ${R} ${R} 0 0 1 0 ${R} A ${rx} ${R} 0 0 ${cos > 0 ? 0 : 1} 0 ${-R} Z`;
  const flip = m.waxing ? "" : ' transform="scale(-1 1)"';
  return `<svg class="moon" viewBox="-60 -60 120 120" role="img" aria-label="${m.name}" xmlns="http://www.w3.org/2000/svg">`
    + `<defs><radialGradient id="mglow"><stop offset=".55" stop-color="#fff6c8" stop-opacity=".35"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></radialGradient>`
    + `<clipPath id="mlit"><path d="${lit}"${flip}/></clipPath></defs>`
    + `<circle r="60" fill="url(#mglow)" opacity="${(0.25 + 0.75 * m.illumination).toFixed(2)}"/>`
    + `<circle r="${R}" fill="#1b2330"/><circle r="${R}" fill="none" stroke="#3a475a" stroke-width="1.5" opacity=".6"/>`
    + `<g clip-path="url(#mlit)"><circle r="${R}" fill="#f3efd8"/><g fill="#cfc9a6" opacity=".55"><circle cx="-14" cy="-12" r="9"/><circle cx="14" cy="8" r="12"/><circle cx="-8" cy="22" r="6"/><circle cx="22" cy="-22" r="5"/><circle cx="-26" cy="8" r="5"/></g></g></svg>`;
}
