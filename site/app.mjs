import { classify, tempBand, windClass, sunTimes } from "./classify.mjs";
import { pickScene } from "./scene.mjs";
import { moonSvg, moonPhase } from "./moon.mjs";
import { cloudsSvg } from "./clouds.mjs";
import { attachScare } from "./scare.mjs";
import { placeLabel } from "./places.mjs";
import { fetchForecast, upcoming, classifyEntry } from "./smhi.mjs";

const [rules, texts] = await Promise.all(["rules.json", "texts.sv.json"].map((f) => fetch(f).then((r) => r.json())));
const $ = (id) => document.getElementById(id);

const CITIES = [
  ["Kungsbacka", 57.4872, 12.076], ["Göteborg", 57.7089, 11.9746], ["Stockholm", 59.3293, 18.0686], ["Malmö", 55.605, 13.0038],
  ["Uppsala", 59.8586, 17.6389], ["Västerås", 59.6099, 16.5448], ["Örebro", 59.2753, 15.2134], ["Linköping", 58.4109, 15.6216],
  ["Helsingborg", 56.0465, 12.6945], ["Halmstad", 56.6745, 12.8578], ["Jönköping", 57.7826, 14.1618], ["Växjö", 56.8777, 14.8091],
  ["Kalmar", 56.6634, 16.3568], ["Visby", 57.6348, 18.2948], ["Karlstad", 59.3793, 13.5036], ["Sundsvall", 62.3908, 17.3069],
  ["Östersund", 63.1792, 14.6357], ["Umeå", 63.8258, 20.263], ["Luleå", 65.5848, 22.1547], ["Kiruna", 67.8558, 20.2253],
];
const L = {
  temp: { freezing: "Stark kyla", cold: "Kallt", cool: "Svalt", mild: "Milt", warm: "Varmt", hot: "Hett" },
  wind: { calm: "Vindstilla", breezy: "Lite vind", windy: "Blåsigt", storm: "Storm" },
  precip: { none: "Uppehåll", rain: "Regn", snow: "Snö", sleet: "Snöblandat", thunder: "Åska" },
  sky: { sunny: "Sol", partly: "Halvklart", cloudy: "Mulet", fog: "Dimma" },
  day: { day: "Dag", night: "Natt" },
};
const hhmm = (iso) => new Date(iso).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Stockholm" });
// ?datum=2026-12-31T23:45:00+01:00 forces the date (testing xmas hats / fireworks)
const forced = new URLSearchParams(location.search).get("datum");
const clock = () => (forced && !isNaN(new Date(forced)) ? new Date(forced) : new Date());
const fmtT = (t) => `${Math.round(t)}°`;

const sunText = (when) => {
  const s = sunTimes(when, place.lat, place.lon);
  return s.kind === "always-up" ? "Midnattssol" : s.kind === "always-down" ? "Solen når inte upp"
    : `upp ${hhmm(s.sunrise)} · ner ${hhmm(s.sunset)}`;
};

function show(c, extra = {}) {
  const p = pickScene(c, rules, extra.when ?? clock()), tx = texts.activities[p.activity];
  scare.reset(); // new scene: figures are home again
  const layers = { sceneBg: "bg", sceneGnd: "gnd", sceneF: "f", sceneM: "m", scene: "top" };
  for (const [id, ext] of Object.entries(layers)) {
    const el = $(id); el.classList.add("swap");
    el.onload = () => el.classList.remove("swap");
    el.src = `scenes/${p.scene}.${ext}.svg`;
  }
  const img = $("scene");
  $("clouds").innerHTML = p.activity === "hide-thunder" ? "" : cloudsSvg(c.sky, c.daylight); // thunder scenes bring their own storm clouds
  img.alt = `${tx.label}, ${texts.outfits[p.outfit].toLowerCase()}`;
  const when = extra.when ?? clock(), moon = $("moon"), frame = $("frame");
  frame.dataset.daylight = c.daylight; // sky colour follows the sun at the chosen place
  frame.toggleAttribute("data-overcast", c.sky === "cloudy" || c.sky === "fog" || c.precip !== "none");
  moon.hidden = c.daylight === "day" || ["sunbathe", "fireworks"].includes(p.activity); // sun / fireworks own that part of the sky
  if (!moon.hidden) { moon.innerHTML = moonSvg(when); moon.title = moonPhase(when).name; }
  $("act").textContent = tx.label;
  $("line").textContent = tx.line + (p.season === "xmas" ? " " + texts.seasons.xmas : "");
  $("pills").innerHTML = [["Temp", L.temp[c.tempBand] + (extra.t !== undefined ? ` ${fmtT(extra.t)}` : "")], ["Vind", L.wind[c.wind]],
    ["Nederbörd", L.precip[c.precip]], ["Himmel", L.sky[c.sky]], ["Sol", sunText(when)], ["Kläder", texts.outfits[p.outfit]]]
    .map(([a, b]) => `<span class="pill">${a}: <b>${b}</b></span>`).join("");
  lastPick = p;
  return p;
}

const scare = attachScare($("frame"), {
  onAway: () => ($("line").textContent = "En gubbe sprang iväg! UFO:n hämtar den om en liten stund."),
  onBack: () => { const p = lastPick; if (p) $("line").textContent = texts.activities[p.activity].line + (p.season === "xmas" ? " " + texts.seasons.xmas : ""); },
});
let lastPick = null;

// ---- forecast ------------------------------------------------------------
let place = { name: "Kungsbacka", lat: 57.4872, lon: 12.076 }, forecast = null, picked = 0;
const setStatus = (s) => ($("status").textContent = s);

function renderTimeline(entries) {
  const el = $("timeline"); el.innerHTML = "";
  entries.forEach((e, i) => {
    const r = classifyEntry(e, place.lat, place.lon), p = pickScene(r.class, rules, forced ? clock() : new Date(e.time));
    const b = document.createElement("button"); b.type = "button"; b.className = "slot";
    b.setAttribute("aria-pressed", i === picked);
    b.innerHTML = `<span class="tm">${i === 0 ? "Nu" : hhmm(e.time)}</span><span class="tp">${r.params.t === undefined ? "–" : fmtT(r.params.t)}</span><span class="ac">${texts.activities[p.activity].label}</span>`;
    b.onclick = () => { picked = i; renderTimeline(entries); show(r.class, { t: r.params.t, when: forced ? clock() : new Date(e.time) }); };
    el.appendChild(b);
  });
}
async function load() {
  setStatus("Hämtar prognos från SMHI…");
  try {
    forecast = await fetchForecast(place.lat, place.lon);
    const now = new Date(), all = upcoming(forecast, now, 30);
    const entries = all.filter((e, i) => i === 0 || (new Date(e.time) - new Date(all[0].time)) % (3 * 36e5) === 0).slice(0, 10);
    picked = 0; renderTimeline(entries);
    const r = classifyEntry(entries[0], place.lat, place.lon);
    show(r.class, { t: r.params.t, when: forced ? clock() : new Date(entries[0].time) }); setStatus("");
  } catch (err) {
    console.error(err);
    setStatus("Kunde inte hämta prognosen från SMHI just nu. Du kan fortfarande testa eget väder nedan.");
    $("act").textContent = "Vädret saknas"; $("line").textContent = ""; $("manual").open = true; manualRender();
  }
}

// ---- place ---------------------------------------------------------------
const sel = $("city");
CITIES.forEach(([n], i) => sel.add(new Option(n, i)));
try { const s = localStorage.getItem("vadertroll-city"); if (s && CITIES[+s]) sel.value = s; } catch {}
const geoOpt = () => sel.querySelector('option[value="geo"]');
const useCity = () => { if (sel.value === "geo") return; geoOpt()?.remove(); // a city was picked: drop "Din plats"
  const [name, lat, lon] = CITIES[+sel.value]; place = { name, lat, lon };
  try { localStorage.setItem("vadertroll-city", sel.value); } catch {} load(); };
sel.onchange = useCity;
$("geo").onclick = () => {
  if (!navigator.geolocation) return setStatus("Din webbläsare saknar platstjänst.");
  setStatus("Frågar efter din plats…");
  navigator.geolocation.getCurrentPosition(
    async (p) => {
      const { latitude: lat, longitude: lon } = p.coords;
      let name = "Din plats";
      try { name = placeLabel(await fetch("places.json").then((r) => r.json()), lat, lon); } catch {} // bundled list: the position never leaves the browser except to SMHI
      place = { name, lat, lon };
      (geoOpt() ?? sel.add(new Option(name, "geo"), 0)); geoOpt().textContent = name; sel.value = "geo"; load(); }, // not saved: the position stays in memory only
    () => setStatus("Ingen platsåtkomst. Välj en stad i listan."), { timeout: 8000, maximumAge: 600000 });
};

// ---- manual weather ------------------------------------------------------
const S = { t: 0, w: 1, precip: "none", sky: "partly", day: "day" };
function seg(id, key, opts) { const el = $(id); el.innerHTML = "";
  for (const k of Object.keys(opts)) { const b = document.createElement("button"); b.type = "button"; b.textContent = opts[k];
    b.setAttribute("aria-pressed", S[key] === k); b.onclick = () => { S[key] = k; manualRender(); }; el.appendChild(b); } }
function manualRender() {
  $("t").value = S.t; $("w").value = S.w; $("tOut").textContent = `${S.t} °C`; $("wOut").textContent = `${S.w} m/s`;
  seg("precip", "precip", L.precip); seg("sky", "sky", L.sky); seg("day", "day", L.day);
  show({ tempBand: tempBand(S.t), precip: S.precip, wind: windClass(S.w), sky: S.sky, daylight: S.day }, { t: S.t });
}
$("t").oninput = (e) => { S.t = +e.target.value; manualRender(); };
$("w").oninput = (e) => { S.w = +e.target.value; manualRender(); };
$("manual").addEventListener("toggle", () => { if ($("manual").open) manualRender(); else if (forecast) load(); });

useCity();

// ---- install (PWA) -------------------------------------------------------
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch((e) => console.warn("sw", e));
let installEvt = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; $("install").hidden = false; });
addEventListener("appinstalled", () => { installEvt = null; $("install").hidden = true; });
$("install").onclick = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; $("install").hidden = true; };
