// Pure and browser-safe: cloud layer (dark at night, light by day) for the page, stacked between the scene's background and foreground.
// sky: "sunny" -> none, "partly" -> a few clouds, "cloudy" -> a drifting cloud deck, "fog" -> none (the scene has its own fog).
const cloud = (x, y, s, dur, delay) => {
  const puffs = [[0, 0, 70, 34], [60, -16, 58, 36], [-62, -8, 52, 28], [120, 6, 44, 24], [-112, 8, 40, 22]]
    .map(([dx, dy, rx, ry]) => `<ellipse cx="${dx}" cy="${dy}" rx="${rx}" ry="${ry}"/>`).join("");
  return `<g transform="translate(${x} ${y}) scale(${s})"><g class="cl" style="animation-duration:${dur}s;animation-delay:-${delay}s"><g fill="url(#cld)">${puffs}</g></g></g>`;
};
const SETS = {
  partly: [[-100, 70, 1.0, 150, 40], [-100, 135, 0.8, 190, 120]],
  cloudy: [[-100, 55, 1.25, 130, 20], [-100, 105, 1.0, 170, 100], [-100, 40, 0.9, 150, 70], [-100, 140, 1.15, 210, 160], [-100, 75, 1.4, 240, 200], [-100, 125, 0.85, 180, 30]],
};
export function cloudsSvg(sky, daylight = "night") {
  const set = SETS[sky]; if (!set) return "";
  const day = daylight === "day";
  const deck = sky === "cloudy" ? '<rect width="1090" height="260" fill="url(#cshade)"/>' : "";
  return '<svg class="clouds" viewBox="0 0 1090 900" preserveAspectRatio="xMidYMin slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
    + `<defs><linearGradient id="cld" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${day ? "#ffffff" : "#5a6a82"}"/><stop offset="1" stop-color="${day ? "#c4cfdb" : "#2a3446"}"/></linearGradient>`
    + `<linearGradient id="cshade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1220" stop-opacity="${day ? ".18" : ".55"}"/><stop offset="1" stop-color="#0c1220" stop-opacity="0"/></linearGradient>`
    + '<style>@media (prefers-reduced-motion: no-preference){@keyframes cl{from{transform:translateX(0)}to{transform:translateX(1500px)}}.cl{animation:cl linear infinite}}</style></defs>'
    + deck + set.map((c) => cloud(...c)).join("") + "</svg>";
}
