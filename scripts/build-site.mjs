#!/usr/bin/env node
// Assemble the GitHub Pages site into docs/ (serve from "main / docs").
import { cpSync, mkdirSync, rmSync, readdirSync, writeFileSync, existsSync } from "node:fs";
const out = new URL("../docs/", import.meta.url), r = (p) => new URL(p, import.meta.url);
rmSync(out, { recursive: true, force: true }); mkdirSync(new URL("scenes/", out), { recursive: true });
for (const f of ["index.html", "style.css", "app.mjs"]) cpSync(r(`../site/${f}`), new URL(f, out));
for (const f of ["classify.mjs", "scene.mjs", "smhi.mjs", "rules.json", "texts.sv.json"]) cpSync(r(`../weather/${f}`), new URL(f, out));
const dir = r("../dolls/dist/");
if (!existsSync(dir)) throw new Error("Run python3 scripts/build-dolls.py first");
for (const f of readdirSync(dir).filter((f) => f.endsWith(".svg"))) cpSync(new URL(f, dir), new URL(`scenes/${f}`, out));
writeFileSync(new URL(".nojekyll", out), "");
console.log("docs/ ready");
