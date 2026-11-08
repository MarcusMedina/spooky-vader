import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import * as C from "../classify.mjs";
import { pickScene as pick } from "../scene.mjs";
import { config, texts } from "../config.mjs";
const pickScene = (c) => pick(c, config);
import { classifyForecast } from "../smhi.mjs";

test("tempBand boundaries", () => {
  const t = [[-20,"freezing"],[-5.1,"freezing"],[-5,"cold"],[4.9,"cold"],[5,"cool"],[12.9,"cool"],[13,"mild"],[19.9,"mild"],[20,"warm"],[25.9,"warm"],[26,"hot"],[35,"hot"]];
  for (const [v, b] of t) assert.equal(C.tempBand(v), b, `${v}`);
});
test("windClass boundaries", () => {
  for (const [v, b] of [[0,"calm"],[2.9,"calm"],[3,"breezy"],[7.9,"breezy"],[8,"windy"],[13.9,"windy"],[14,"storm"]]) assert.equal(C.windClass(v), b);
});
test("wsymb2 -> precip (all 27 symbols mapped)", () => {
  const exp = { 11:"thunder",21:"thunder" };
  [8,9,10,18,19,20].forEach((s)=>exp[s]="rain"); [12,13,14,22,23,24].forEach((s)=>exp[s]="sleet"); [15,16,17,25,26,27].forEach((s)=>exp[s]="snow");
  for (let s = 1; s <= 27; s++) assert.equal(C.precipFrom({ wsymb2: s }), exp[s] ?? "none", `symbol ${s}`);
  assert.equal(C.precipFrom({ wsymb2: 3, tstm: 80 }), "thunder");
});
test("sky", () => {
  assert.equal(C.skyFrom({ wsymb2: 7 }), "fog");
  assert.equal(C.skyFrom({ wsymb2: 1, tcc_mean: 0 }), "sunny");
  assert.equal(C.skyFrom({ wsymb2: 4, tcc_mean: 4 }), "partly");
  assert.equal(C.skyFrom({ wsymb2: 6, tcc_mean: 8 }), "cloudy");
});
test("daylight in Kungsbacka", () => {
  const [lat, lon] = [57.49, 12.08];
  assert.equal(C.isDaylight("2026-06-21T10:00:00Z", lat, lon), "day");
  assert.equal(C.isDaylight("2026-06-21T18:30:00Z", lat, lon), "day");   // 20:30 local, midsummer
  assert.equal(C.isDaylight("2026-06-21T22:30:00Z", lat, lon), "night"); // 00:30 local: sun ~10° below horizon
  assert.equal(C.isDaylight("2026-12-21T00:00:00Z", lat, lon), "night");
  assert.equal(C.isDaylight("2026-12-21T11:00:00Z", lat, lon), "day");
});

// --- exhaustive: every combination yields a valid scene --------------------
const all = [];
for (const tempBand of C.TEMP_BANDS) for (const precip of C.PRECIP) for (const wind of C.WINDS)
  for (const sky of C.SKIES) for (const daylight of C.DAYLIGHT) all.push({ tempBand, precip, wind, sky, daylight });

test(`every one of ${all.length} weather combinations maps to a valid scene`, () => {
  for (const c of all) {
    const s = pickScene(c);
    assert.ok(s.rule, JSON.stringify(c));
    assert.ok(config.outfits[s.outfit], `outfit ${s.outfit} for ${JSON.stringify(c)}`);
    assert.ok(s.activity in config.activities, `activity ${s.activity}`);
  }
});
test("rules reference only known outfits/activities and fallback is last", () => {
  for (const r of config.rules) {
    assert.ok(r.outfit === "auto" || config.outfits[r.outfit], r.id);
    assert.ok(r.activity in config.activities, r.id);
  }
  assert.deepEqual(config.rules.at(-1).when, {});
  assert.equal(new Set(config.rules.map((r) => r.id)).size, config.rules.length);
  for (const b of C.TEMP_BANDS) assert.ok(config.outfits[config.outfitByTemp[b]], b);
});
test("rule priority examples from the brief", () => {
  const base = { tempBand: "mild", precip: "none", wind: "calm", sky: "partly", daylight: "day" };
  assert.equal(pickScene({ ...base, precip: "thunder", wind: "storm" }).activity, "hide-thunder");
  assert.equal(pickScene({ ...base, precip: "snow", tempBand: "cold" }).activity, "ski");
  assert.equal(pickScene({ ...base, precip: "snow", tempBand: "cold", wind: "breezy" }).activity, "snowball");
  assert.equal(pickScene({ ...base, precip: "rain", tempBand: "warm" }).activity, "dance-in-rain");
  assert.equal(pickScene({ ...base, precip: "rain", tempBand: "cool" }).outfit, "rain");
  assert.equal(pickScene({ ...base, tempBand: "warm", sky: "sunny" }).activity, "sunbathe");
  assert.equal(pickScene({ ...base, tempBand: "warm", sky: "cloudy" }).activity, "tennis");
  assert.equal(pickScene({ ...base, tempBand: "freezing", wind: "windy" }).outfit, "cold");
});
const TEMPS = C.TEMP_BANDS;
test("every reachable (activity, outfit) has a built duo scene file", () => {
  for (const c of all) {
    const s = pickScene(c);
    assert.equal(config.outfits[s.outfit].art, "ready", s.outfit);
    assert.equal(config.activities[s.activity], "ready", s.activity);
    for (const ext of ["svg", "bg.svg", "fg.svg"]) assert.ok(existsSync(new URL(`../../dolls/dist/${s.scene}.${ext}`, import.meta.url)), `${s.scene}.${ext}`);
  }
});
test("SNOW1g parsing ignores 9999 and handles percent cloud cover", async () => {
  const { entryParams } = await import("../smhi.mjs");
  assert.equal(entryParams({ data: { air_temperature: 9999, wind_speed: 3, symbol_code: 1 } }).t, undefined);
  assert.equal(entryParams({ data: { air_temperature: -9, cloud_area_fraction: 100 } }).tcc_mean, 8);
  assert.equal(entryParams({ data: { air_temperature: -9 } }).t, -9);
});
test("SMHI fixture -> classification", () => {
  const json = JSON.parse(readFileSync(new URL("./smhi-fixture.json", import.meta.url)));
  const r = classifyForecast(json, 57.49, 12.08, new Date("2026-11-08T17:30:00Z"));
  assert.equal(r.time, "2026-11-08T18:00:00Z");
  assert.deepEqual(r.class, { tempBand: "cold", precip: "snow", wind: "calm", sky: "cloudy", daylight: "night" });
});

test("every activity and outfit has Swedish texts", () => {
  for (const a of Object.keys(config.activities)) { assert.ok(texts.activities[a]?.label, a); assert.ok(texts.activities[a]?.line, a); }
  for (const o of Object.keys(config.outfits)) assert.ok(texts.outfits[o], o);
});
test("every rule activity is declared", () => {
  for (const r of config.rules) assert.ok(r.activity in config.activities, r.id);
});

// ---- seasons: Christmas hats until Dec 24, New Year's Eve fireworks 23:30-01:30 (Swedish time) ----
import { seasonAt } from "../scene.mjs";
const S = (iso) => seasonAt(new Date(iso), config);
test("christmas hats: 1-24 Dec (Swedish local time)", () => {
  assert.equal(S("2026-11-30T22:59:00Z").xmas, false); // 23:59 on 30 Nov in Stockholm
  assert.equal(S("2026-11-30T23:00:00Z").xmas, true);  // 00:00 on 1 Dec
  assert.equal(S("2026-12-24T22:58:00Z").xmas, true);  // 23:58 on 24 Dec
  assert.equal(S("2026-12-24T23:00:00Z").xmas, false); // 00:00 on 25 Dec
  assert.equal(S("2026-07-01T12:00:00Z").xmas, false);
});
test("fireworks: 31 Dec 23:30 -> 1 Jan 01:30 (wraps over new year)", () => {
  assert.equal(S("2026-12-31T22:29:00Z").fireworks, false);
  assert.equal(S("2026-12-31T22:30:00Z").fireworks, true);
  assert.equal(S("2026-12-31T23:59:00Z").fireworks, true);
  assert.equal(S("2027-01-01T00:30:00Z").fireworks, true);
  assert.equal(S("2027-01-01T00:31:00Z").fireworks, false);
  assert.equal(S("2026-12-30T23:45:00Z").fireworks, false);
});
test("seasonal scenes exist for every classification and keep weather outfit", () => {
  const xmas = new Date("2026-12-10T12:00:00Z"), nye = new Date("2026-12-31T23:45:00Z");
  for (const c of all) {
    const base = pick(c, config), x = pick(c, config, xmas), f = pick(c, config, nye);
    assert.equal(x.scene, `${base.scene}--xmas`); assert.equal(x.activity, base.activity);
    assert.equal(f.activity, "fireworks"); assert.equal(f.outfit, base.outfit);
    for (const s of [x, f]) assert.ok(existsSync(new URL(`../../dolls/dist/${s.scene}.svg`, import.meta.url)), s.scene);
  }
  assert.equal(pick(all[0], config).season, null);
});
test("fireworks keep the weather's precipitation", () => {
  const nye = new Date("2026-12-31T23:45:00Z"), c = { tempBand: "cold", precip: "snow", wind: "calm", sky: "cloudy", daylight: "night" };
  assert.equal(pick(c, config, nye).scene, "fireworks--cold--snow");
  assert.equal(pick({ ...c, precip: "sleet" }, config, nye).scene, "fireworks--rain--rain");
  assert.equal(pick({ ...c, precip: "none" }, config, nye).scene, "fireworks--cold");
});

// ---- moon phase ----
import { moonPhase, moonSvg } from "../moon.mjs";
test("moon phase matches known new/full moons (within a day)", () => {
  assert.ok(moonPhase(new Date("2026-02-17T12:01:00Z")).illumination < 0.03, "new moon 2026-02-17");
  assert.ok(moonPhase(new Date("2026-01-03T10:03:00Z")).illumination > 0.97, "full moon 2026-01-03");
  const q = moonPhase(new Date("2026-01-10T15:48:00Z")); // last quarter
  assert.ok(Math.abs(q.illumination - 0.5) < 0.08 && !q.waxing, "last quarter");
  assert.equal(moonPhase(new Date("2026-01-03T10:03:00Z")).name, "Fullmåne");
});
test("moon svg renders for a whole month without errors", () => {
  for (let d = 0; d < 30; d++) assert.match(moonSvg(new Date(Date.UTC(2026, 10, 1 + d))), /^<svg[\s\S]*<\/svg>$/);
});

import { cloudsSvg } from "../clouds.mjs";
test("clouds: none for sunny/fog, more for cloudy than partly", () => {
  assert.equal(cloudsSvg("sunny"), ""); assert.equal(cloudsSvg("fog"), "");
  const n = (x) => (cloudsSvg(x).match(/class="cl"/g) ?? []).length;
  assert.ok(n("partly") > 0 && n("cloudy") > n("partly"));
});
