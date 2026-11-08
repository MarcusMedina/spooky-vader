// Pure and browser-safe: pass the parsed rules.json as `cfg`.
const matches = (when, c) => Object.entries(when).every(([k, vals]) => vals.includes(c[k]));

/** "MM-DD HH:MM" in Swedish local time (Europe/Stockholm). */
export function localKey(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
/** Window may wrap over new year (from > to). Strings compare lexicographically. */
export const inWindow = (key, w) => (w.from <= w.to ? key >= w.from && key <= w.to : key >= w.from || key <= w.to);

/** Which seasonal extras apply at `when` (a Date). */
export function seasonAt(when, cfg) {
  if (!when || !cfg.seasons) return { xmas: false, fireworks: false };
  const k = localKey(when);
  return { xmas: inWindow(k, cfg.seasons.xmas), fireworks: inWindow(k, cfg.seasons.fireworks) };
}

/** classification -> { rule, activity, outfit, scene, season } ; scene = file name stem:
 *  "<activity>--<outfit>" or "<activity>--<outfit>--xmas". Pass `when` (Date) to enable seasons. */
export function pickScene(c, cfg, when) {
  const rule = cfg.rules.find((r) => matches(r.when, c));
  const outfit = rule.outfit === "auto" ? cfg.outfitByTemp[c.tempBand] : rule.outfit;
  const s = seasonAt(when, cfg);
  const activity = s.fireworks ? "fireworks" : rule.activity;
  const xmas = s.xmas && !s.fireworks;
  return {
    rule: s.fireworks ? "fireworks" : rule.id, activity, outfit, season: xmas ? "xmas" : s.fireworks ? "fireworks" : null,
    scene: `${activity}--${outfit}${xmas ? "--xmas" : ""}`,
    ready: cfg.outfits[outfit].art === "ready" && cfg.activities[activity] === "ready",
  };
}
