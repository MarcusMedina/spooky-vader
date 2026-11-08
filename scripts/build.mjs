#!/usr/bin/env node
// Builds dist/troll-sprite.svg (CSS-variable version for browsers) and
// dist/preview.svg (colors baked per variant, renders in any SVG tool).
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dirs = ['art/parts', 'art/props'];
const variants = JSON.parse(readFileSync(join(root, 'art/variants.json'), 'utf8'));
const cfg = JSON.parse(readFileSync(join(root, 'art/outfits.json'), 'utf8'));

const parts = new Map();
for (const d of dirs) {
  for (const f of readdirSync(join(root, d)).filter(f => f.endsWith('.svg'))) {
    const name = basename(f, '.svg');
    if (parts.has(name)) throw new Error(`duplicate part name: ${name}`);
    const text = readFileSync(join(root, d, f), 'utf8');
    const m = text.match(/<svg[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>/);
    if (!m) throw new Error(`${f}: no <svg viewBox>`);
    parts.set(name, { viewBox: m[1], inner: m[2].replace(/<title>[\s\S]*?<\/title>/, '').trim(), file: f });
  }
}

// ids must be globally unique across parts (parts prefix their own ids)
const seen = new Map();
for (const [name, p] of parts) {
  for (const m of p.inner.matchAll(/\sid="([^"]+)"/g)) {
    if (seen.has(m[1])) throw new Error(`id "${m[1]}" used in both ${seen.get(m[1])} and ${name}`);
    seen.set(m[1], name);
  }
}

function layers(outfit, pose) {
  const o = cfg.outfits[outfit], p = cfg.poses[pose];
  if (!o || !p) throw new Error(`unknown outfit/pose: ${outfit}/${pose}`);
  const sub = s => s && s.replace('{pose}', pose);
  const list = [o.ground, 'body', `arms-${pose}`, ...o.torso, sub(o.sleeves), 'head', p.face, ...o.hat, sub(o.hands)].filter(Boolean);
  for (const l of list) if (!parts.has(l)) throw new Error(`outfit ${outfit}/${pose} references missing part: ${l}`);
  return list;
}

function bake(inner, variant) {
  const pal = variants[variant];
  let t = inner.replace(/var\(--([a-z-]+),\s*(#[0-9A-Fa-f]{3,8})\)/g, (_, k, fb) => pal[k] ?? fb);
  const ids = [...t.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  for (const id of ids) {
    t = t.replaceAll(`id="${id}"`, `id="${id}--${variant}"`)
         .replaceAll(`url(#${id})`, `url(#${id}--${variant})`)
         .replaceAll(`href="#${id}"`, `href="#${id}--${variant}"`);
  }
  return t;
}

mkdirSync(join(root, 'dist'), { recursive: true });

// 1) browser sprite
let sprite = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n';
for (const [name, p] of parts) sprite += `<symbol id="${name}" viewBox="${p.viewBox}">${p.inner}</symbol>\n`;
sprite += '</svg>\n';
writeFileSync(join(root, 'dist/troll-sprite.svg'), sprite);

// 2) baked preview sheet: one row per outfit, stand | cheer
const lineup = [['moss', 'rain'], ['bog', 'winter'], ['jade', 'sun']];
const S = 150, SH = 160, W = S * 2, H = SH * 3;
let out = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W * 4}" height="${H * 4}">\n<rect width="${W}" height="${H}" fill="#DCE6EC"/>\n<defs>\n`;
const used = new Set();
const need = [];
lineup.forEach(([v, o]) => ['stand', 'cheer'].forEach(po => { layers(o, po).forEach(l => need.push([l, v])); need.push([cfg.outfits[o].props, v]); }));
for (const [l, v] of need) {
  const key = `${l}--${v}`;
  if (used.has(key)) continue;
  used.add(key);
  out += `<symbol id="${key}" viewBox="${parts.get(l).viewBox}">${bake(parts.get(l).inner, v)}</symbol>\n`;
}
out += '</defs>\n';
lineup.forEach(([v, o], row) => ['stand', 'cheer'].forEach((po, col) => {
  const x = col * S, y = row * SH;
  const L = layers(o, po);
  out += `<use href="#${L[0]}--${v}" x="${x}" y="${y}" width="${S}" height="${SH}"/>\n`;
  out += `<use href="#${cfg.outfits[o].props}--${v}" x="${x}" y="${y}" width="${S}" height="${SH}"/>\n`;
  for (const l of L.slice(1)) out += `<use href="#${l}--${v}" x="${x}" y="${y}" width="${S}" height="${SH}"/>\n`;
}));
out += '</svg>\n';
writeFileSync(join(root, 'dist/preview.svg'), out);
console.log(`ok: ${parts.size} parts, sprite + preview written`);
