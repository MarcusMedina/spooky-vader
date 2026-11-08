#!/usr/bin/env python3
"""Build every reachable (activity, outfit) duo scene from weather/rules.json.
Usage: build-duo.py [--png]  -> moody/dist/duo/<activity>--<outfit>.svg"""
import json, re, sys, subprocess, pathlib
base = pathlib.Path(__file__).resolve().parent.parent
root = base / "moody"; parts = root / "parts"; out = root / "dist" / "duo"; out.mkdir(parents=True, exist_ok=True)
cfg = json.loads((root / "duos.json").read_text())
variants = json.loads((root / "variants.json").read_text())
rules = json.loads((base / "weather" / "rules.json").read_text())
VAR = re.compile(r"var\(--([\w-]+),\s*(#[0-9a-fA-F]{3,8})\)")
L = cfg["layout"]; W, H = L["width"], L["height"]; SX = W / 900
TEMPS = ["freezing", "cold", "cool", "mild", "warm", "hot"]

def combos():
    s = set()
    for r in rules["rules"]:
        for t in r["when"].get("tempBand", TEMPS):
            o = rules["outfitByTemp"][t] if r["outfit"] == "auto" else r["outfit"]
            s.add((r["activity"], o))
    return sorted(s)

def part(name):
    p = parts / f"{name}.svg"
    if not p.exists(): sys.exit(f"missing part: {name}")
    t = p.read_text()
    vb = int(re.search(r'viewBox="0 0 (\d+) ', t).group(1))
    return vb, re.sub(r"^.*?<svg[^>]*>|</svg>\s*$", "", t, flags=re.S)

def scene_layer(names):
    o = ""
    for n in names:
        vb, body = part(n)
        body = VAR.sub(lambda m: m.group(2), body)
        o += f'<g transform="scale({W / vb} 1)">{body}</g>' 
    return o

def uniq(body, suf):
    ids = re.findall(r'\bid="([^"]+)"', body)
    if len(ids) != len(set(ids)): sys.exit(f"duplicate ids inside troll {suf}")
    for i in set(ids):
        body = body.replace(f'id="{i}"', f'id="{i}--{suf}"').replace(f"url(#{i})", f"url(#{i}--{suf})").replace(f'href="#{i}"', f'href="#{i}--{suf}"')
    return body

def troll(who, outfit, act):
    layers = [l for l in cfg["outfits"][outfit][who] if l not in act.get("drop_male", []) or who != "male"]
    layers = layers + act.get(f"{who}_extra", [])
    if "skis" in layers:  # skis go under the body, right after the legs
        layers.remove("skis"); layers.insert(layers.index("legs") + 1, "skis")
    body = "".join(part(l)[1] for l in layers)
    vals = variants[L[who]["variant"]]
    body = uniq(VAR.sub(lambda m: vals.get(m.group(1), m.group(2)), body), who[0])
    t = L[who]; p = act.get("pose", {}).get(who, {})
    return (f'<g transform="translate({t["tx"]} {t["ty"] + p.get("dy", 0)}) scale({t["s"]}) '
            f'rotate({p.get("rot", 0)} 450 830)">{body}</g>')

png = "--png" in sys.argv
for name, o in combos():
    if o not in cfg["outfits"]: sys.exit(f"outfit without art: {o}")
    a = cfg["activities"][name]
    bg = ('<defs><radialGradient id="duo-bg" cx="50%" cy="50%" r="75%"><stop offset="0" stop-color="#243320"/>'
          '<stop offset=".6" stop-color="#121a10"/><stop offset="1" stop-color="#070a06"/></radialGradient></defs>'
          f'<rect width="{W}" height="{H}" fill="url(#duo-bg)"/>')
    ground = scene_layer(["ground"] + cfg["outfits"][o]["ground"] + a["ground"])
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{bg}{ground}'
           f'{troll("female", o, a)}{troll("male", o, a)}{scene_layer(a["front"])}</svg>')
    ids = re.findall(r'\bid="([^"]+)"', svg)
    dup = sorted({i for i in ids if ids.count(i) > 1})
    if dup: sys.exit(f"duplicate ids in {name}--{o}: {dup[:5]}")
    f = out / f"{name}--{o}.svg"; f.write_text(svg)
    if png: subprocess.run(["rsvg-convert", "-o", str(f.with_suffix(".png")), str(f)], check=True)
    print("built", f.name, len(svg) // 1024, "KB")
