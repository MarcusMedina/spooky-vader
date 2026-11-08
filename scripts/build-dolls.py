#!/usr/bin/env python3
"""Spooky väder: pale shop-window mannequins, posed by joint angles.
Builds (Greys by default, --shop for mannequins) every reachable (activity, outfit) scene from weather/rules.json -> dolls/dist/<activity>--<outfit>.svg
Usage: build-dolls.py [--png]"""
import json, math, re, sys, subprocess, pathlib
base = pathlib.Path(__file__).resolve().parent.parent
dolls = base / "dolls"; out = dolls / ("dist" if "--shop" not in sys.argv else "dist-shop"); out.mkdir(parents=True, exist_ok=True)
POSES = json.loads((dolls / "poses.json").read_text())
CFG = json.loads((dolls / "scenes.json").read_text())
RULES = json.loads((base / "weather" / "rules.json").read_text())
PARTS = base / "moody" / "parts"
W, H, GROUND = 1090, 900, 842
CX = {"male": 425, "female": 665}; MID = 545
STYLE = "shop" if "--shop" in sys.argv else "alien"
ST = {"shop": dict(sh=(72, 58), hp=(56, 66), wa=(44, 36), T=250, hip=30, L=(165, 150, 128, 118), lw=(40, 30), aw=(28, 22), hand=18, slw=(34, 30), tw=(46, 36), tws=48, bw=38, bx=34, bry=14, footrx=30, footry=12, neck=24),
      "alien": dict(sh=(40, 36), hp=(36, 40), wa=(26, 24), T=190, hip=20, L=(130, 120, 125, 115), lw=(22, 16), aw=(15, 12), hand=7, slw=(26, 22), tw=(28, 22), tws=30, bw=22, bx=22, bry=10, footrx=20, footry=8, neck=12)}[STYLE]
BASE, SHADE, HI, LINE = (("#e6e0d4", "#a9a193", "#ffffff", "#6c665c") if STYLE == "shop" else ("#b9c4bd", "#76877f", "#eaf3ee", "#46544e"))
TEMPS = ["freezing", "cold", "cool", "mild", "warm", "hot"]
f1 = lambda v: f"{v:.1f}"

def combos():
    s = set()
    for r in RULES["rules"]:
        for t in r["when"].get("tempBand", TEMPS):
            s.add((r["activity"], RULES["outfitByTemp"][t] if r["outfit"] == "auto" else r["outfit"]))
    for o in RULES["outfits"]: s.add(("fireworks", o))
    return sorted(s)

def rot(v, deg):
    a = math.radians(deg); return (v[0]*math.cos(a) - v[1]*math.sin(a), v[0]*math.sin(a) + v[1]*math.cos(a))
def add(a, b): return (a[0]+b[0], a[1]+b[1])
def dirv(side, ang): a = math.radians(ang); return (side*math.sin(a), math.cos(a))
def pt(p): return f"{f1(p[0])} {f1(p[1])}"

def limb(p, q, w, color=BASE, shade=True):
    s = (f'<path d="M {pt(p)} L {pt(q)}" stroke="{color}" stroke-width="{w}" stroke-linecap="round" fill="none"/>')
    if shade:
        s += (f'<path d="M {f1(p[0]+w*.28)} {f1(p[1])} L {f1(q[0]+w*.28)} {f1(q[1])}" stroke="{SHADE}" stroke-width="{f1(w*.38)}" stroke-linecap="round" fill="none" opacity=".5"/>'
              f'<path d="M {f1(p[0]-w*.2)} {f1(p[1])} L {f1(q[0]-w*.2)} {f1(q[1])}" stroke="{HI}" stroke-width="{f1(w*.14)}" stroke-linecap="round" fill="none" opacity=".7"/>')
    return s
def seam(p, w): return f'<path d="M {f1(p[0]-w/2)} {f1(p[1])} Q {f1(p[0])} {f1(p[1]+5)} {f1(p[0]+w/2)} {f1(p[1])}" stroke="{LINE}" stroke-width="2.2" fill="none" opacity=".7"/>'

def ik(shoulder, target, U, F, bend_side):
    d = math.dist(shoulder, target); d = min(max(d, 20), U+F-1)
    ux, uy = ((target[0]-shoulder[0])/math.dist(shoulder, target), (target[1]-shoulder[1])/math.dist(shoulder, target))
    A = math.acos(max(-1, min(1, (U*U + d*d - F*F)/(2*U*d))))
    c, s = math.cos(bend_side*A), math.sin(bend_side*A)
    el = (shoulder[0] + U*(ux*c - uy*s), shoulder[1] + U*(ux*s + uy*c))
    hd = ((target[0]-el[0]), (target[1]-el[1])); n = math.hypot(*hd) or 1
    return el, (el[0] + hd[0]/n*F, el[1] + hd[1]/n*F)

# ---- one doll -------------------------------------------------------------------
def build_doll(gender, outfit, act, pose_in, ctx):
    side_inner = 1 if gender == "male" else -1       # screen side of the inner arm/leg
    woman = gender == "female"
    P = dict(POSES["default"]); P.update(pose_in)
    i = 1 if woman else 0
    sh, hp, wa, T = ST["sh"][i], ST["hp"][i], ST["wa"][i], ST["T"]
    hip = ST["hip"]; L1, L2, UA, FA = ST["L"]
    cx = CX[gender]
    lean, tilt = P["lean"], P["tilt"]
    # legs (local coords, pelvis at 0,0)
    legs = {}
    for name, s in (("inner_leg", side_inner), ("outer_leg", -side_inner)):
        g = P[name]; k = g.get("k", 1)
        hipp = (s*hip, 0)
        knee = add(hipp, (s*L1*math.sin(math.radians(g["t"]))*k if k < 1 else s*L1*math.sin(math.radians(g["t"])), L1*math.cos(math.radians(g["t"]))*k))
        ank = add(knee, (s*L2*math.sin(math.radians(g["s"])), L2*math.cos(math.radians(g["s"]))))
        legs[s] = (hipp, knee, ank)
    foot_low = max(l[2][1] + 18 for l in legs.values())
    py = GROUND - foot_low - P["jump"]
    shoulder = {s: add((0, 0), rot((s*(sh-4), -T+12), lean)) for s in (-1, 1)}
    neck_base = rot((0, -T-6), lean)
    head_c = add(neck_base, rot((0, -70 if STYLE == 'shop' else -100), lean+tilt))
    world = lambda p: (cx+p[0], py+p[1])
    unworld = lambda p: (p[0]-cx, p[1]-py)
    # arms
    arms = {}
    for name, s in (("inner_arm", side_inner), ("outer_arm", -side_inner)):
        a = P[name]; sp = shoulder[s]
        if a.get("hold"):
            tgt = unworld((MID, ctx["mid_y"]))
        elif "to" in a:
            ref, dx, dy = a["to"]
            if ref == "mid": tgt = unworld((MID, ctx["mid_y"]))
            elif ref == "midhi": tgt = unworld((MID, ctx["mid_y"] - 250))
            elif ref == "pelvis": tgt = (s*abs(dx), dy)
            else: tgt = add(head_c, (s*dx, dy))
        else:
            e = add(sp, tuple(UA*c for c in dirv(s, a["au"]))); w = add(e, tuple(FA*c for c in dirv(s, a["af"])))
            arms[s] = (sp, e, w); continue
        el, wr = ik(sp, tgt, UA, FA, -s)
        arms[s] = (sp, el, wr)
    g = []
    # -- legs
    for s, (hp_, kn, an) in legs.items():
        g.append(limb(hp_, kn, ST["lw"][0])); g.append(limb(kn, an, ST["lw"][1])); g.append(seam(kn, ST["lw"][0]-6))
        g.append(f'<ellipse cx="{f1(an[0]+s*8)}" cy="{f1(an[1]+14)}" rx="{ST["footrx"]}" ry="{ST["footry"]}" fill="{BASE}"/><ellipse cx="{f1(an[0]+s*8)}" cy="{f1(an[1]+18)}" rx="{ST["footrx"]}" ry="6" fill="{SHADE}" opacity=".5"/>')
    # -- torso
    sl, sr = shoulder[-1], shoulder[1]
    wl = rot((-wa, -110), lean*0.5); wr_ = rot((wa, -110), lean*0.5)
    g.append(f'<path d="M {pt(sl)} Q {pt(rot((0,-T-14),lean))} {pt(sr)} Q {pt(wr_)} {pt(wr_)} Q {f1(hp+4)} -40 {hp} 40 Q 0 66 {-hp} 40 Q {-hp-4} -40 {pt(wl)} Q {pt(wl)} {pt(sl)} Z" fill="url(#plastic)"/>')
    g.append(seam(rot((0, -108), lean*0.5), wa*2))
    # -- arms (bare)
    for s, (sp, el, wr) in arms.items():
        g.append(limb(sp, el, ST["aw"][0])); g.append(limb(el, wr, ST["aw"][1])); g.append(seam(el, ST["aw"][1]+2))
    # -- hands
    hands = {}
    for s, (sp, el, wr) in arms.items():
        dx, dy = wr[0]-el[0], wr[1]-el[1]; n = math.hypot(dx, dy) or 1; u = (dx/n, dy/n)
        tip = (wr[0]+u[0]*44, wr[1]+u[1]*44); hands[s] = (wr, u)
        if STYLE == "shop":
            g.append(limb(wr, tip, 18, BASE, False)); g.append(f'<circle cx="{f1(wr[0])}" cy="{f1(wr[1])}" r="11" fill="{BASE}"/>')
        else:
            for da in (-24, 0, 24):
                v = rot(u, da); g.append(limb(wr, (wr[0]+v[0]*34, wr[1]+v[1]*34), ST["hand"], BASE, False))
            g.append(f'<circle cx="{f1(wr[0])}" cy="{f1(wr[1])}" r="7" fill="{BASE}"/>')
    CL = len(g)
    # -- clothes
    C = ctx["colors"]
    def sleeves(color, wu=ST["slw"][0], wf=ST["slw"][1], cuff=None):
        o = ""
        for s, (sp, el, wr) in arms.items():
            o += limb(sp, el, wu, color, False) + limb(el, wr, wf, color, False)
            o += limb(add(el, ((wr[0]-el[0])*.12, (wr[1]-el[1])*.12)), wr, wf, color, False)
            if cuff: o += limb(add(wr, ((el[0]-wr[0])*.16, (el[1]-wr[1])*.16)), wr, wf+4, cuff, False)
        return o
    def trousers(color, short=False):
        o = ""
        for s, (hp_, kn, an) in legs.items():
            if short: o += limb(hp_, kn, 46, color, False) if False else limb(hp_, (hp_[0]+(kn[0]-hp_[0])*.7, hp_[1]+(kn[1]-hp_[1])*.7), ST["tws"], color, False)
            else: o += limb(hp_, kn, ST["tw"][0], color, False) + limb(kn, an, ST["tw"][1], color, False)
        return o
    def boots(color):
        o = ""
        for s, (hp_, kn, an) in legs.items():
            a = (an[0]+(kn[0]-an[0])*.55, an[1]+(kn[1]-an[1])*.55)
            o += limb(a, an, ST["bw"], color, False) + f'<ellipse cx="{f1(an[0]+s*8)}" cy="{f1(an[1]+14)}" rx="{ST["bx"]}" ry="{ST["bry"]}" fill="{color}"/>'
        return o
    hem_y = max(l[2][1] for l in legs.values())
    def body_poly(color, hemw, hemy, top=0):
        return f'<path d="M {pt(add(sl,(-8,-4)))} Q {pt(rot((0,-T-18),lean))} {pt(add(sr,(8,-4)))} L {f1(hp+hemw)} {hemy} Q 0 {hemy+30} {f1(-hp-hemw)} {hemy} Z" fill="{color}"/>'
    if outfit == "rain":
        g.append(trousers("#38465e")); g.append(boots("#2c5fa8")); g.append(sleeves("#f2c230", cuff="#dba91c"))
        g.append(body_poly("#f2c230", 36, 150))
        g.append(f'<path d="M 0 {-T-10} V 170" stroke="#a87c10" stroke-width="4" fill="none"/><g fill="#fff3c8"><circle cx="0" cy="{-T+70}" r="7"/><circle cx="0" cy="{-T+150}" r="7"/><circle cx="0" cy="{-T+230}" r="7"/></g><path d="M {-hp-34} 140 Q 0 172 {hp+34} 140" stroke="#e8e8e8" stroke-width="8" fill="none" stroke-linecap="round"/>')
    elif outfit == "cold":
        g.append(trousers("#2b3548")); g.append(boots("#5a3d28")); g.append(sleeves("#3f7a56", cuff="#f2e8d0"))
        g.append(body_poly("#3f7a56", 14, 56))
        g.append(f'<path d="M {-hp-14} -60 L {hp+14} -60 L {hp+14} -22 L {-hp-14} -22 Z" fill="#e0a43a"/><path d="M {-hp-14} -62 H {hp+14} M {-hp-14} -20 H {hp+14}" stroke="#f2e8d0" stroke-width="4"/>')
        g.append(f'<path d="M {pt(add(sl,(-4,0)))} Q {pt(rot((0,-T+30),lean))} {pt(add(sr,(4,0)))} L {pt(add(sr,(-14,18)))} Q {pt(rot((0,-T+60),lean))} {pt(add(sl,(14,18)))} Z" fill="#2f5a40"/>')
    elif outfit == "mild":
        g.append(trousers("#3b4a63")); g.append(boots("#4a3a2c")); g.append(sleeves("#e2a23a", cuff="#b97a1e"))
        g.append(body_poly("#e2a23a", 18, 80))
        g.append(f'<path d="M {-hp+4} 4 L {hp-4} 4 L {hp+8} 62 Q 0 72 {-hp-8} 62 Z" fill="#c98a27"/><path d="M {pt(add(sl,(0,0)))} Q {pt(rot((0,-T+34),lean))} {pt(add(sr,(0,0)))}" stroke="#8a5a12" stroke-width="22" fill="none" stroke-linecap="round"/>')
    else:  # summer
        if woman:
            g.append(body_poly("#f4b8cc", 70, hem_y-60 if False else 110))
            for dx, y in [(-20, -T+60), (18, -T+110), (-52, -40), (14, -10), (60, 40), (-20, 60), (84, 96), (-78, 90)]:
                g.append(f'<g transform="translate({dx} {y})" fill="#fff"><circle cy="-7" r="5"/><circle cx="7" r="5"/><circle cy="7" r="5"/><circle cx="-7" r="5"/><circle r="3.5" fill="#f2b632"/></g>')
        else:
            for s, (sp, el, wr) in arms.items():
                g.append(limb(sp, add(sp, ((el[0]-sp[0])*.45, (el[1]-sp[1])*.45)), 40, "#d94a3d", False))
            g.append(f'<path d="M {pt(add(sl,(-4,-2)))} Q {pt(rot((0,-T-14),lean))} {pt(add(sr,(4,-2)))} L {f1(wa+10)} -4 L {f1(-wa-10)} -4 Z" fill="#e8584a"/>')
            g.append(trousers("#3d5a80", short=True))
            g.append(f'<path d="M {-hp-2} 4 H {hp+2}" stroke="#fff" stroke-width="5" opacity=".4"/>')
    # -- head group
    hd = []
    hd.append(limb((0, 236), (0, 196), 24))
    hd.append('<path d="M 0 66 Q 40 66 38 128 Q 36 176 14 194 Q 0 202 -14 194 Q -36 176 -38 128 Q -40 66 0 66 Z" fill="url(#plastichead)"/>')
    hd.append(f'<path d="M -6 128 Q -9 150 -4 160 Q 0 164 5 160" fill="none" stroke="{SHADE}" stroke-width="3" stroke-linecap="round" opacity=".8"/><path d="M -30 116 Q -16 104 -4 112 M 4 112 Q 16 104 30 116" fill="none" stroke="{SHADE}" stroke-width="3" opacity=".5" stroke-linecap="round"/>')
    hd.append('<g filter="url(#soft)" fill="#1a1512" opacity=".55"><ellipse cx="-15" cy="128" rx="9" ry="6"/><ellipse cx="15" cy="128" rx="9" ry="6"/></g>')
    if not woman: hd.append('<path d="M 14 70 L 18 92 L 10 108 L 16 126 L 8 140" fill="none" stroke="#4a443b" stroke-width="2.6" stroke-linejoin="round" opacity=".9"/>')
    else: hd.append('<path d="M -9 176 Q 0 182 9 176 Q 0 172 -9 176 Z" fill="#b5665f" opacity=".75"/>')
    if woman: hd.append('<path d="M -42 150 Q -48 60 0 58 Q 48 60 42 150 Q 46 196 30 214 Q 34 150 22 100 Q 0 92 -22 104 Q -34 150 -30 214 Q -46 196 -42 150 Z" fill="#1f1a1d"/><path d="M -26 80 Q -6 66 18 74" stroke="#6c6470" stroke-width="5" stroke-linecap="round" fill="none" opacity=".7"/>')
    else: hd.append('<path d="M -39 118 Q -44 58 0 56 Q 44 58 39 118 Q 32 88 8 84 Q -24 82 -39 118 Z" fill="#26211f"/><path d="M -24 70 Q -4 62 16 68" stroke="#6c6470" stroke-width="5" stroke-linecap="round" fill="none" opacity=".7"/>')
    if "shades" in ctx["head_extra"]:
        hd.append('<g fill="#0d0d10" stroke="#000" stroke-width="2"><ellipse cx="-17" cy="126" rx="15" ry="10"/><ellipse cx="17" cy="126" rx="15" ry="10"/></g><path d="M -3 124 H 3 M -32 124 L -40 120 M 32 124 L 40 120" stroke="#000" stroke-width="3" fill="none"/><path d="M -26 121 l 8 -3 M 8 121 l 8 -3" stroke="#fff" stroke-width="2.5" opacity=".5"/>')
    if outfit == "rain":
        hd.append('<path d="M -44 100 Q -46 34 0 30 Q 46 34 44 100 Q 0 84 -44 100 Z" fill="#f2c230"/><path d="M -70 108 Q 0 70 70 108 Q 64 126 42 116 Q 0 90 -42 116 Q -64 126 -70 108 Z" fill="#d9a91c"/>')
    elif outfit == "cold":
        hd.append('<path d="M -42 108 Q -46 30 0 24 Q 46 30 42 108 Q 0 92 -42 108 Z" fill="#3e5ca8"/><path d="M -44 100 Q 0 84 44 100 L 46 128 Q 0 112 -46 128 Z" fill="#f0e8d0"/><circle cx="0" cy="16" r="20" fill="#eef1f8"/>')
    if STYLE == "alien":
        hd = [limb((0, 236), (0, 190), ST["neck"]),
              '<path d="M 0 22 C 74 22 84 108 54 152 C 38 178 14 196 0 196 C -14 196 -38 178 -54 152 C -84 108 -74 22 0 22 Z" fill="url(#plastichead)"/>',
              '<path d="M -50 60 Q -68 100 -44 140" stroke="#eaf3ee" stroke-width="8" stroke-linecap="round" fill="none" opacity=".45"/>',
              '<g fill="#04060a"><ellipse cx="-30" cy="126" rx="27" ry="15" transform="rotate(24 -30 126)"/><ellipse cx="30" cy="126" rx="27" ry="15" transform="rotate(-24 30 126)"/></g>',
              '<g fill="#fff" opacity=".85"><ellipse cx="-38" cy="119" rx="6" ry="3.5" transform="rotate(24 -38 119)"/><ellipse cx="22" cy="119" rx="6" ry="3.5" transform="rotate(-24 22 119)"/></g>',
              '<path d="M -4 158 h 2 M 3 158 h 2" stroke="#2c3833" stroke-width="3" stroke-linecap="round"/><path d="M -9 172 Q 0 175 9 172" stroke="#2c3833" stroke-width="2.5" fill="none" stroke-linecap="round"/>']
        if woman: hd.append('<path d="M -52 122 q -14 -4 -18 -14 M 52 122 q 14 -4 18 -14" stroke="#04060a" stroke-width="4" stroke-linecap="round" fill="none"/><circle cx="0" cy="36" r="7" fill="#f2b632"/>')
        if "shades" in ctx["head_extra"]:
            hd.append('<g fill="#0d0d10" stroke="#000" stroke-width="3" opacity=".95"><ellipse cx="-31" cy="126" rx="31" ry="19" transform="rotate(24 -31 126)"/><ellipse cx="31" cy="126" rx="31" ry="19" transform="rotate(-24 31 126)"/></g><path d="M -3 126 H 3" stroke="#000" stroke-width="4"/>')
        if ctx.get("xmas"):
            hd.append(SANTA)
        elif outfit == "rain":
            hd.append('<g transform="translate(0 96) scale(1.6) translate(0 -100)"><path d="M -44 100 Q -46 34 0 30 Q 46 34 44 100 Q 0 84 -44 100 Z" fill="#f2c230"/><path d="M -70 108 Q 0 70 70 108 Q 64 126 42 116 Q 0 90 -42 116 Q -64 126 -70 108 Z" fill="#d9a91c"/></g>')
        elif outfit == "cold":
            hd.append('<g transform="translate(0 56) scale(1.5) translate(0 -100)"><path d="M -42 108 Q -46 30 0 24 Q 46 30 42 108 Q 0 92 -42 108 Z" fill="#3e5ca8"/><path d="M -44 100 Q 0 84 44 100 L 46 128 Q 0 112 -46 128 Z" fill="#f0e8d0"/><circle cx="0" cy="16" r="20" fill="#eef1f8"/></g>')
    g.append(f'<g transform="translate({pt(neck_base)}) rotate({f1(lean+tilt)}) translate(0 -236)"><g class="hb hb-{gender}">'+"".join(hd)+'</g></g>')
    # -- props
    props = ""
    def hand_of(role): s = side_inner if role == "inner" else -side_inner; return s, hands[s]
    for pr in ctx["props"]:
        kind, role = pr.split(":")
        s, (wr, u) = hand_of(role)
        gx, gy = GROUND - py, 0
        if kind == "pole":
            foot = (wr[0] + s*(50 if role == "outer" else 8), (GROUND - py))
            props += f'<path d="M {pt(wr)} L {pt(foot)}" stroke="#222" stroke-width="7" stroke-linecap="round"/><path d="M {pt(wr)} L {pt(foot)}" stroke="#d94a3d" stroke-width="3" stroke-linecap="round"/><ellipse cx="{f1(foot[0]-s*3)}" cy="{f1(foot[1]-26)}" rx="16" ry="6" fill="none" stroke="#222" stroke-width="4"/>'
        elif kind == "racket":
            col = "#c0392b" if woman is False else "#2e6bc0"
            e = (wr[0]+u[0]*95, wr[1]+u[1]*95); c = (wr[0]+u[0]*170, wr[1]+u[1]*170); ang = math.degrees(math.atan2(u[1], u[0])) - 90
            props += f'<path d="M {pt(wr)} L {pt(e)}" stroke="#3e2a15" stroke-width="9" stroke-linecap="round"/><g transform="translate({pt(c)}) rotate({f1(ang)})"><ellipse rx="42" ry="58" fill="none" stroke="{col}" stroke-width="9"/><g stroke="#f4f4f4" stroke-width="2" opacity=".8"><path d="M 0 -56 V 56 M -22 -50 V 50 M 22 -50 V 50 M -40 -20 H 40 M -40 20 H 40"/></g></g>'
        elif kind == "snowball":
            props += f'<circle cx="{f1(wr[0])}" cy="{f1(wr[1]-10)}" r="30" fill="url(#snowg)" stroke="#8795AB" stroke-width="3"/>'
        elif kind == "lantern":
            props += (f'<circle cx="{f1(wr[0])}" cy="{f1(wr[1]+70)}" r="120" fill="url(#lanternglow)"/><path d="M {pt(wr)} L {f1(wr[0])} {f1(wr[1]+22)}" stroke="#222" stroke-width="4"/>'
                      f'<rect x="{f1(wr[0]-24)}" y="{f1(wr[1]+22)}" width="48" height="62" rx="8" fill="#ffe08a" stroke="#222" stroke-width="5"/><path d="M {f1(wr[0]-24)} {f1(wr[1]+22)} L {f1(wr[0])} {f1(wr[1]+6)} L {f1(wr[0]+24)} {f1(wr[1]+22)}" fill="none" stroke="#222" stroke-width="4"/>')
        elif kind == "ski":
            pass
    if "skis" in ctx["head_extra"]:
        for s, (hp_, kn, an) in legs.items():
            y = an[1] + 28
            props += (f'<path d="M {f1(an[0]-96)} {f1(y+10)} L {f1(an[0]+110)} {f1(y+10)} Q {f1(an[0]+150)} {f1(y+10)} {f1(an[0]+164)} {f1(y-12)} Q {f1(an[0]+138)} {f1(y)} {f1(an[0]+110)} {f1(y)} L {f1(an[0]-96)} {f1(y)} Z" fill="{"#2E6BC0" if s<0 else "#d94a3d"}" stroke="#101010" stroke-width="3"/>')
    return f'<g transform="translate({cx} {f1(py)})">'+"".join(g)+props+'</g>', arms, legs, py

# ---- scene ----------------------------------------------------------------------
SANTA = ('<path d="M -62 86 C -66 30 -12 4 34 12 C 76 20 102 58 112 100 C 90 72 64 58 46 62 C 58 74 62 82 62 86 Q 0 68 -62 86 Z" fill="#c8202a" stroke="#7d1119" stroke-width="2.5"/>'
         '<path d="M 30 18 C 70 26 94 58 104 92" fill="none" stroke="#e8505a" stroke-width="4" opacity=".6" stroke-linecap="round"/>'
         '<path d="M -70 86 Q 0 64 70 86 Q 76 100 64 102 Q 0 82 -64 102 Q -76 100 -70 86 Z" fill="#f6f3ec" stroke="#cfc8b8" stroke-width="2"/>'
         '<circle cx="112" cy="104" r="16" fill="#f6f3ec" stroke="#cfc8b8" stroke-width="2"/>')

def fireworks_svg():
    import random
    rnd = random.Random(7); o = ""
    bursts = [(170, 250, 120, "#ff5a6e"), (930, 210, 135, "#ffd34d"), (95, 520, 70, "#6fd3ff"), (1000, 500, 80, "#b37bff"), (300, 90, 60, "#7dffb0"), (800, 90, 55, "#ff9c4d")]
    for x, y, r, c in bursts:
        o += f'<circle cx="{x}" cy="{y}" r="{r*1.25}" fill="{c}" opacity=".10" filter="url(#soft)"/>'
        n = 18
        for i in range(n):
            a = 2*math.pi*i/n + rnd.random()*.12; r0, r1 = r*.35, r*(.85 + rnd.random()*.15)
            x0, y0, x1, y1 = x+r0*math.cos(a), y+r0*math.sin(a), x+r1*math.cos(a), y+r1*math.sin(a)
            o += f'<path d="M {f1(x0)} {f1(y0)} L {f1(x1)} {f1(y1)}" stroke="{c}" stroke-width="3" stroke-linecap="round" opacity=".85"/><circle cx="{f1(x1)}" cy="{f1(y1+r*.06)}" r="3.5" fill="#fff" opacity=".9"/>'
        o += f'<circle cx="{x}" cy="{y}" r="7" fill="#fff" opacity=".9"/>'
    for x, y in [(560, 330), (470, 250), (640, 270)]:
        o += f'<g stroke="#ffe9a0" stroke-width="2.5" stroke-linecap="round" opacity=".8"><path d="M {x-9} {y} h 18 M {x} {y-9} v 18 M {x-6} {y-6} l 12 12 M {x+6} {y-6} l -12 12"/></g>'
    return o

def head_bob_css():
    """Head sway around the neck: rare (every ~30-40 s), different period per figure so it looks irregular.
    First sway comes after >= 20 s. Respects prefers-reduced-motion."""
    seq = [0, -6, 5, -4, 3, -1.5, 0]
    css = ""
    for g, (period, start, dur) in {"male": (29, 21, 2.8), "female": (41, 27, 2.8)}.items():
        pts = [(0, 0), (start/period*100, 0)] + [((start + dur*i/(len(seq)-1))/period*100, a) for i, a in enumerate(seq)] + [(100, 0)]
        kf = "".join(f"{x:.2f}% {{transform:rotate({a}deg)}}" for x, a in pts)
        css += f"@keyframes bob-{g} {{{kf}}} .hb-{g} {{animation: bob-{g} {period}s ease-in-out infinite; transform-origin: 0px 236px}}"
    return f'<style>@media (prefers-reduced-motion: no-preference) {{{css}}}</style>'

def part(name):
    p = PARTS / f"{name}.svg"
    if not p.exists(): sys.exit(f"missing part: {name}")
    t = p.read_text(); vb = int(re.search(r'viewBox="0 0 (\d+) ', t).group(1))
    body = re.sub(r"^.*?<svg[^>]*>|</svg>\s*$", "", t, flags=re.S)
    body = re.sub(r"var\(--[\w-]+,\s*(#[0-9a-fA-F]{3,8})\)", r"\1", body)
    return f'<g transform="scale({W/vb} 1)">{body}</g>'

def build(activity, outfit, xmas=False):
    a = CFG["activities"][activity]
    ctx_base = {"mid_y": 252 + 0}
    pose = POSES["activities"].get(activity, {})
    docs = {}
    for gender in ("male", "female"):
        props = [p for p in a.get(f"{gender}_props", [])]
        ctx = {"mid_y": 250 + 0, "colors": {}, "props": props, "head_extra": a.get(f"{gender}_head", []), "xmas": xmas}
        # place mid_y relative to pelvis: hands joined at about shoulder+250 => compute after py via closure
        docs[gender] = (gender, ctx)
    # first pass to get pelvis y (hold target is in world coords: use a fixed world height)
    out_svg = {}
    for gender, (g_, ctx) in docs.items():
        ctx["mid_y"] = 560  # world y of the joined hands
        svg, arms, legs, py = build_doll(gender, outfit, activity, pose.get(gender, {}), ctx)
        out_svg[gender] = svg
    tint = a.get("light", "cool")
    beam = {"cool": "#a8ffd8", "warm": "#ffe3a0"}[tint]
    wall = {"cool": ("#050a09", "#132320"), "warm": ("#0d0a07", "#2a1f14")}[tint]
    defs = (f'<defs><linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{wall[0]}"/><stop offset="1" stop-color="{wall[1]}"/></linearGradient>'
        '<linearGradient id="plastic" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#eef3ea"/><stop offset=".55" stop-color="#d3d9cb"/><stop offset="1" stop-color="#8c978c"/></linearGradient>'
        '<radialGradient id="plastichead" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#f4f8ee"/><stop offset=".6" stop-color="#d3d9cb"/><stop offset="1" stop-color="#7f8a7f"/></radialGradient>'
        f'<linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{beam}" stop-opacity=".30"/><stop offset="1" stop-color="{beam}" stop-opacity="0"/></linearGradient>'
        '<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2825"/><stop offset="1" stop-color="#0a0f0e"/></linearGradient>'
        '<radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".85"/></radialGradient>'
        '<radialGradient id="snowg" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#B7C6DA"/></radialGradient>'
        '<radialGradient id="lanternglow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe9a0" stop-opacity=".85"/><stop offset="1" stop-color="#ffe9a0" stop-opacity="0"/></radialGradient>'
        '<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>'
        '<filter id="shadow" x="-30%" y="-10%" width="160%" height="130%"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0"/><feGaussianBlur stdDeviation="7"/></filter>'
        '<filter id="fog" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="26"/></filter>'
        f'<clipPath id="floorclip"><rect y="{GROUND}" width="{W}" height="{H-GROUND}"/></clipPath></defs>')
    defs += head_bob_css()
    figs = out_svg["female"] + out_svg["male"]
    if STYLE == "alien":
        return alien_scene(a, outfit, figs, defs, tint, beam)
    back = "".join(part(n) for n in ["snow-ground"] if outfit == "cold") 
    sky = "".join(part(n) for n in a.get("back", []))
    wallsvg = (f'<rect width="{W}" height="{H}" fill="url(#wall)"/>{sky}'
               f'<path d="M 330 0 L 450 0 L 560 {GROUND-2} L 200 {GROUND-2} Z" fill="url(#beam)"/><path d="M 640 0 L 740 0 L 880 {GROUND-2} L 600 {GROUND-2} Z" fill="url(#beam)" opacity=".6"/>'
               f'<g transform="translate(150 28) skewX(-28)" filter="url(#shadow)" opacity=".4">{figs}</g>'
               f'<rect y="{GROUND}" width="{W}" height="{H-GROUND}" fill="url(#floor)"/>{back}')
    floorprops = "".join(part(n) for n in a.get("floor", []))
    refl = f'<g clip-path="url(#floorclip)" opacity=".12"><g transform="translate(0 {2*GROUND} ) scale(1 -1)">{figs}</g></g>'
    fog = '<g filter="url(#fog)" fill="#b9d8cc" opacity=".2"><ellipse cx="260" cy="852" rx="300" ry="26"/><ellipse cx="820" cy="860" rx="320" ry="30"/><ellipse cx="545" cy="882" rx="420" ry="24"/></g>'
    front = "".join(part(n) for n in a.get("front", []))
    extra = ""
    if "umbrella" in a.get("scene_props", []):
        extra = ('<g><path d="M 545 120 L 545 540" stroke="#222" stroke-width="7"/><path d="M 330 230 Q 330 60 545 60 Q 760 60 760 230 Q 710 205 652 230 Q 598 205 545 230 Q 492 205 438 230 Q 384 205 330 230 Z" fill="#7a1f2b" stroke="#2a0a10" stroke-width="5" stroke-linejoin="round"/><path d="M 545 60 L 438 230 M 545 60 L 652 230" stroke="#2a0a10" stroke-width="3" opacity=".6"/></g>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{defs}{wallsvg}{floorprops}{refl}{extra}{figs}{fog}{front}'
           f'<rect width="{W}" height="{H}" fill="url(#vig)"/><rect x="12" y="12" width="{W-24}" height="{H-24}" fill="none" stroke="#2c3a37" stroke-width="10"/></svg>')
    return svg

def alien_scene(a, outfit, figs, defs, tint, beam):
    for o, n in (('#eef3ea','#cfdad3'),('#d3d9cb','#a8b8b0'),('#8c978c','#5d6f67'),('#f4f8ee','#d7e2db'),('#7f8a7f','#52625b')): defs = defs.replace(o, n)
    sky = "".join(part(n) for n in a.get("back", [])) + (fireworks_svg() if a.get("fireworks") else "")
    floorprops = "".join(part(n) for n in a.get("floor", []))
    front = "".join(part(n) for n in a.get("front", []))
    stars = "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff" opacity=".8"/>' for x, y, r in [(70,60,2),(190,120,1.5),(330,40,2),(470,90,1.5),(600,50,2),(780,70,1.5),(900,130,2),(1020,60,1.5),(130,230,1.5),(990,250,2),(60,380,1.5),(1040,420,1.5)])
    back = "".join(part(n) for n in ["snow-ground"] if outfit == "cold")
    ufo = (f'<g><path d="M 395 150 L 695 150 L 860 {GROUND} L 230 {GROUND} Z" fill="url(#ubeam)"/>'
           '<ellipse cx="545" cy="112" rx="170" ry="38" fill="#4b5560" stroke="#1a1f24" stroke-width="5"/><path d="M 455 100 Q 545 24 635 100 Z" fill="#9fd8c9" stroke="#1a1f24" stroke-width="5" opacity=".9"/>'
           '<path d="M 380 118 Q 545 160 710 118 Q 545 142 380 118 Z" fill="#2b323a"/><g fill="#d8ffa8">' + "".join(f'<circle cx="{x}" cy="118" r="7"/>' for x in (420, 470, 520, 570, 620, 670)) + '</g></g>')
    grad = ('<defs><linearGradient id="ubeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8ffa8" stop-opacity=".55"/><stop offset="1" stop-color="#b6ff9a" stop-opacity=".08"/></linearGradient>'
            '<linearGradient id="nsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#04060f"/><stop offset="1" stop-color="#0f2430"/></linearGradient>'
            '<linearGradient id="field" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16301f"/><stop offset="1" stop-color="#07120c"/></linearGradient></defs>')
    hills = f'<path d="M 0 {GROUND-30} Q 200 {GROUND-110} 420 {GROUND-50} Q 650 {GROUND-130} 860 {GROUND-60} Q 980 {GROUND-100} 1090 {GROUND-40} L 1090 {GROUND} L 0 {GROUND} Z" fill="#0b1a14"/>'
    field = f'<rect y="{GROUND}" width="{W}" height="{H-GROUND}" fill="url(#field)"/><g stroke="#2b4d37" stroke-width="2" opacity=".6"><path d="M 0 860 H 1090 M 0 880 H 1090"/></g>'
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{defs}{grad}<rect width="{W}" height="{H}" fill="url(#nsky)"/>{stars}{sky}{hills}{ufo}{field}{back}{floorprops}'
           f'{figs}{front}<rect width="{W}" height="{H}" fill="url(#vig)"/></svg>')
    return svg

if __name__ == "__main__":
    png = "--png" in sys.argv
    jobs = [(a, o, False) for a, o in combos()] + ([(a, o, True) for a, o in combos() if a != "fireworks"] if STYLE == "alien" else [])
    for act, outfit, xmas in jobs:
        svg = build(act, outfit, xmas)
        ids = re.findall(r'\bid="([^"]+)"', svg); dup = sorted({i for i in ids if ids.count(i) > 1})
        if dup: sys.exit(f"duplicate ids in {act}--{outfit}: {dup[:5]}")
        sfx = "--xmas" if xmas else ""
        f = out / f"{act}--{outfit}{sfx}.svg"; f.write_text(svg)
        if png: subprocess.run(["rsvg-convert", "-o", str(f.with_suffix(".png")), str(f)], check=True)
        print("built", f.name, len(svg)//1024, "KB")
