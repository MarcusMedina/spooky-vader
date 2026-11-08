// Pure and browser-safe: name a position from a bundled list of Swedish places (no network, nothing leaves the browser).
const rad = (d) => (d * Math.PI) / 180;
export function distanceKm(lat1, lon1, lat2, lon2) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}
/** places: [[name, lat, lon], ...] -> label such as "Kungsbacka" (within `near` km), "Nära Halmstad" (within `max` km) or "Din plats" */
export function placeLabel(places, lat, lon, { near = 6, max = 60 } = {}) {
  let best = null, bd = Infinity;
  for (const [name, la, lo] of places) { const d = distanceKm(lat, lon, la, lo); if (d < bd) { bd = d; best = name; } }
  return best && bd <= near ? best : best && bd <= max ? `Nära ${best}` : "Din plats";
}
