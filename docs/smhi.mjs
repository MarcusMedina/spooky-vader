import { classify } from "./classify.mjs";
// SMHI SNOW1gv1. PMP3gv2 was retired 2026-03-31. Docs: https://opendata.smhi.se/metfcst/snow1gv1
export const smhiUrl = (lat, lon) =>
  `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/${lon.toFixed(4)}/lat/${lat.toFixed(4)}/data.json`;

const MISSING = 9999;
const num = (v) => (typeof v === "number" && v !== MISSING ? v : undefined);

/** One timeSeries entry -> params understood by classify(). Field names follow the SNOW1g docs;
 *  cloud/thunder names are best effort (symbol_code alone is enough to classify). */
export function entryParams(e) {
  const d = e.data ?? {};
  let cloud = num(d.cloud_area_fraction ?? d.total_cloud_cover);
  if (cloud !== undefined && cloud > 8) cloud = cloud / 12.5; // percent -> octas
  return {
    t: num(d.air_temperature), ws: num(d.wind_speed), wsymb2: num(d.symbol_code),
    pcat: num(d.predominant_precipitation_type_at_surface), tcc_mean: cloud,
    tstm: num(d.thunderstorm_probability ?? d.probability_of_thunder) ?? 0,
  };
}
export const pickEntry = (json, now = new Date()) =>
  json.timeSeries.find((s) => new Date(s.time) >= now) ?? json.timeSeries.at(-1);

export function classifyEntry(entry, lat, lon) {
  const params = entryParams(entry);
  return { time: entry.time, params, class: classify(params, entry.time, lat, lon) };
}
export const classifyForecast = (json, lat, lon, now = new Date()) => classifyEntry(pickEntry(json, now), lat, lon);

/** Next `hours` hourly-ish entries from now, for a timeline. */
export function upcoming(json, now = new Date(), hours = 24) {
  const end = now.getTime() + hours * 36e5;
  return json.timeSeries.filter((s) => { const t = new Date(s.time).getTime(); return t >= now.getTime() - 36e5 && t <= end; });
}
export async function fetchForecast(lat, lon, fetchImpl = fetch) {
  const r = await fetchImpl(smhiUrl(lat, lon));
  if (!r.ok) throw new Error(`SMHI ${r.status}`);
  return r.json();
}
