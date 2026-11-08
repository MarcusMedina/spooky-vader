#!/usr/bin/env python3
"""Builds site/places.json (Swedish places, [name, lat, lon]) from a GeoNames-derived cities.json
(e.g. https://github.com/lutangar/cities.json, data (c) GeoNames, CC BY 4.0).  Usage: make-places.py cities.json"""
import json, sys
FIX = {"Gothenburg": "Göteborg"}
d = [c for c in json.load(open(sys.argv[1])) if c["country"] == "SE"]
seen, out = set(), []
for c in sorted(d, key=lambda c: c["name"]):
    n = FIX.get(c["name"], c["name"]); k = (n, round(float(c["lat"]), 1), round(float(c["lng"]), 1))
    if k in seen: continue
    seen.add(k); out.append([n, round(float(c["lat"]), 3), round(float(c["lng"]), 3)])
json.dump(out, open(__file__.rsplit("/", 2)[0] + "/site/places.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(len(out), "places")
