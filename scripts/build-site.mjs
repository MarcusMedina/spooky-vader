#!/usr/bin/env node
// Assemble the GitHub Pages site into docs/ (serve from "main / docs").
import { cpSync, mkdirSync, rmSync, readdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
const out = new URL("../docs/", import.meta.url), r = (p) => new URL(p, import.meta.url);
rmSync(out, { recursive: true, force: true }); mkdirSync(new URL("scenes/", out), { recursive: true });
for (const f of ["index.html", "style.css", "app.mjs", "scare.mjs"]) cpSync(r(`../site/${f}`), new URL(f, out));
for (const f of ["classify.mjs", "scene.mjs", "smhi.mjs", "moon.mjs", "clouds.mjs", "places.mjs", "rules.json", "texts.sv.json"]) cpSync(r(`../weather/${f}`), new URL(f, out));
const dir = r("../dolls/dist/");
if (!existsSync(dir)) throw new Error("Run python3 scripts/build-dolls.py first");
for (const f of readdirSync(dir).filter((f) => /\.(bg|gnd|f|m|top)\.svg$/.test(f))) cpSync(new URL(f, dir), new URL(`scenes/${f}`, out));
cpSync(r("../site/icons/"), new URL("icons/", out), { recursive: true });
cpSync(r("../site/manifest.webmanifest"), new URL("manifest.webmanifest", out));
cpSync(r("../site/places.json"), new URL("places.json", out));
// service worker: precache the app shell; version = hash of everything in docs/ (so each change busts caches)
const shell = ["./", "index.html", "style.css", "app.mjs", "scare.mjs", "classify.mjs", "scene.mjs", "smhi.mjs", "moon.mjs", "clouds.mjs", "places.mjs", "places.json", "rules.json", "texts.sv.json", "manifest.webmanifest", "icons/icon-192.png"];
const h = createHash("sha256");
for (const f of [...shell.filter((f) => f !== "./"), ...readdirSync(new URL("scenes/", out)).map((f) => `scenes/${f}`)].sort()) h.update(f).update(readFileSync(new URL(f, out)));
writeFileSync(new URL("sw.js", out), readFileSync(r("../site/sw.js"), "utf8").replace("__VERSION__", "spooky-" + h.digest("hex").slice(0, 12)).replace("__SHELL__", JSON.stringify(shell)));
writeFileSync(new URL(".nojekyll", out), "");
console.log("docs/ ready");
