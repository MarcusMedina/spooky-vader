#!/usr/bin/env python3
"""Compose moody parts into scenes. Usage: build-moody.py  -> moody/dist/<scene>.svg (+png via rsvg-convert)"""
import json, re, sys, subprocess, pathlib
root = pathlib.Path(__file__).resolve().parent.parent / "moody"
parts = root / "parts"; dist = root / "dist"; dist.mkdir(exist_ok=True)
scenes = json.loads((root/"scenes.json").read_text())
variants = json.loads((root/"variants.json").read_text()) if (root/"variants.json").exists() else {"default": {}}
VAR = re.compile(r"var\(--([\w-]+),\s*(#[0-9a-fA-F]{3,8})\)")
def inner(name):
    p = parts / f"{name}.svg"
    if not p.exists(): sys.exit(f"missing part: {name}")
    t = p.read_text()
    return re.sub(r"^.*?<svg[^>]*>|</svg>\s*$", "", t, flags=re.S)
ids = {}
for scene, layers in scenes.items():
    for vname, vals in variants.items():
        body = "".join(inner(l) for l in layers)
        for i in re.findall(r'\bid="([^"]+)"', body):
            ids[i] = ids.get(i, 0) + 1
        dup = [i for i, c in ids.items() if c > 1]
        if dup: sys.exit(f"duplicate ids in {scene}: {dup}")
        ids.clear()
        body = VAR.sub(lambda m: vals.get(m.group(1), m.group(2)), body)
        out = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 900" width="900" height="900">{body}</svg>'
        f = dist / f"{scene}-{vname}.svg"; f.write_text(out)
        subprocess.run(["rsvg-convert", "-o", str(f.with_suffix(".png")), str(f)], check=True)
        print("built", f.name)
