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
// Solar elevation > -0.833° counts as day. Low-precision NOAA-style formula, fine for ±10 min.
export function isDaylight(date, lat, lon) {
  const rad = Math.PI / 180, d = date instanceof Date ? date : new Date(date);
  const doy = Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5);
  const g = (2 * Math.PI / 365) * (doy - 1 + (d.getUTCHours() - 12) / 24);
  const decl = 0.006918 - 0.399912*Math.cos(g) + 0.070257*Math.sin(g) - 0.006758*Math.cos(2*g) + 0.000907*Math.sin(2*g);
  const eqt = 229.18 * (0.000075 + 0.001868*Math.cos(g) - 0.032077*Math.sin(g) - 0.014615*Math.cos(2*g) - 0.040849*Math.sin(2*g));
  const mins = d.getUTCHours()*60 + d.getUTCMinutes();
  const ha = ((mins + eqt + 4*lon - 720) / 4) * rad;
  const el = Math.asin(Math.sin(lat*rad)*Math.sin(decl) + Math.cos(lat*rad)*Math.cos(decl)*Math.cos(ha)) / rad;
  return el > -0.833 ? "day" : "night";
}
export function classify(p, when, lat, lon) {
  return {
    tempBand: tempBand(p.t), precip: precipFrom(p), wind: windClass(p.ws),
    sky: skyFrom(p), daylight: isDaylight(when, lat, lon),
  };
}
