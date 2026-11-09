// SMHI observation/forecast values -> discrete classes. Pure functions, no I/O.
export const TEMP_BANDS = ["freezing", "cold", "cool", "mild", "warm", "hot"];
export const PRECIP = ["none", "rain", "snow", "sleet", "thunder"];
export const WINDS = ["calm", "breezy", "windy", "storm"];
export const SKIES = ["sunny", "partly", "cloudy", "fog"];
export const DAYLIGHT = ["day", "night"];

export const tempBand = (t) =>
  t < -5 ? "freezing" : t < 5 ? "cold" : t < 13 ? "cool" : t < 20 ? "mild" : t < 26 ? "warm" : "hot";
export const windClass = (ms) => (ms < 3 ? "calm" : ms < 8 ? "breezy" : ms < 14 ? "windy" : "storm");

// wsymb2: 11,21 thunder; 7 fog; 12-14,22-24 sleet; 15-17,25-27 snow; 8-10,18-20 rain
export function precipFrom({ wsymb2, pcat, tstm = 0 }) {
  if (wsymb2 === 11 || wsymb2 === 21 || tstm >= 60) return "thunder";
  if (wsymb2 !== undefined) {
    if ([15,16,17,25,26,27].includes(wsymb2)) return "snow";
    if ([12,13,14,22,23,24].includes(wsymb2)) return "sleet";
    if ([8,9,10,18,19,20].includes(wsymb2)) return "rain";
    return "none";
  }
  return { 0: "none", 1: "snow", 2: "sleet", 3: "rain", 4: "rain", 5: "sleet", 6: "sleet" }[pcat] ?? "none";
}
export function skyFrom({ wsymb2, tcc_mean }) {
  if (wsymb2 === 7) return "fog";
  const o = tcc_mean ?? (wsymb2 <= 2 ? 1 : wsymb2 <= 4 ? 3 : 7);
  return o <= 2 ? "sunny" : o <= 5 ? "partly" : "cloudy";
}
// Solar elevation in degrees. Low-precision NOAA-style formula, fine for ±10 min.
export function solarElevation(date, lat, lon) {
  const rad = Math.PI / 180, d = date instanceof Date ? date : new Date(date);
  const doy = Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5);
  const g = (2 * Math.PI / 365) * (doy - 1 + (d.getUTCHours() - 12) / 24);
  const decl = 0.006918 - 0.399912*Math.cos(g) + 0.070257*Math.sin(g) - 0.006758*Math.cos(2*g) + 0.000907*Math.sin(2*g);
  const eqt = 229.18 * (0.000075 + 0.001868*Math.cos(g) - 0.032077*Math.sin(g) - 0.014615*Math.cos(2*g) - 0.040849*Math.sin(2*g));
  const mins = d.getUTCHours()*60 + d.getUTCMinutes();
  const ha = ((mins + eqt + 4*lon - 720) / 4) * rad;
  return Math.asin(Math.sin(lat*rad)*Math.sin(decl) + Math.cos(lat*rad)*Math.cos(decl)*Math.cos(ha)) / rad;
}
// Elevation above -0.833° (sun's upper edge at the horizon, with refraction) counts as day.
const HORIZON = -0.833;
export const isDaylight = (date, lat, lon) => (solarElevation(date, lat, lon) > HORIZON ? "day" : "night");

/** Sunrise/sunset on the Swedish local day containing `date` -> { kind: "normal"|"always-up"|"always-down", sunrise, sunset }.
 *  Scans minute by minute (1440 cheap evaluations), so it needs no extra formula. */
export function sunTimes(date, lat, lon) {
  const d = date instanceof Date ? date : new Date(date);
  const [y, m, dd] = d.toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" }).split("-").map(Number);
  const noon = Date.UTC(y, m - 1, dd, 12); // local-day noon read as UTC; the Stockholm offset at noon gives local midnight
  const offsetH = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Stockholm", hour: "2-digit", hourCycle: "h23" }).format(noon)) - 12;
  const start = Date.UTC(y, m - 1, dd) - offsetH * 36e5; // local midnight
  const up = (min) => solarElevation(new Date(start + min * 6e4), lat, lon) > HORIZON;
  let sunrise = null, sunset = null, prev = up(0), anyUp = prev, anyDown = !prev;
  for (let min = 1; min < 1440; min++) {
    const u = up(min);
    anyUp ||= u; anyDown ||= !u;
    if (u && !prev && !sunrise) sunrise = new Date(start + min * 6e4);
    if (!u && prev && !sunset) sunset = new Date(start + min * 6e4);
    prev = u;
  }
  return { kind: sunrise || sunset ? "normal" : anyUp ? "always-up" : "always-down", sunrise, sunset };
}
export function classify(p, when, lat, lon) {
  return {
    tempBand: tempBand(p.t), precip: precipFrom(p), wind: windClass(p.ws),
    sky: skyFrom(p), daylight: isDaylight(when, lat, lon),
  };
}
