# Spooky väder

Två små grå gubbar (Greys, man och kvinna) under en UFO som klär sig och gör något efter vädret i Sverige. Statisk sida för GitHub Pages. Skyltdocke-varianten finns kvar: `python3 scripts/build-dolls.py --shop` (bygger till `dolls/dist-shop`).

## Flöde
SMHI SNOW1gv1 → `weather/classify.mjs` (temp, nederbörd, vind, himmel, dag/natt) → `weather/rules.json` (första träffen vinner) → scen `docs/scenes/<aktivitet>--<kläder>.svg`.

## Struktur
- `dolls/` – dockorna: `poses.json` (ledvinklar per aktivitet), `scenes.json` (rekvisita och bakgrund). `scripts/build-dolls.py` ritar skelett, kläder och scener.
- `moody/` – äldre troll-version (behålls som referens).
- `scripts/build-dolls.py` – bygger alla scener som reglerna kan nå (`--png` ger förhandsbilder). Väder-overlays återanvänds från `moody/parts/*-wide.svg`.
- `scripts/build-site.mjs` – sätter ihop `docs/` från `site/`, `weather/` och scenerna.
- `weather/` – klassificering, regler, svenska texter, SMHI-klient och tester.

## Kommandon
```
npm run build   # scener + docs/
npm test        # alla 960 väderkombinationer ska ge en scen som finns
```
GitHub Pages: Settings → Pages → Deploy from branch → `main` / `/docs`.

## Lägga till en aktivitet
1. Lägg en pose i `dolls/poses.json` och rekvisita/bakgrund i `dolls/scenes.json`. 3. Lägg regel i `weather/rules.json` och text i `weather/texts.sv.json`. 4. `npm run build && npm test`.

## Designregler
- Figurerna är alltid fullt klädda, även vid solbad (solglasögon, t-shirt och shorts/sommarklänning, handduk). Ingen badkläder eller bar överkropp.

## Säsong (jul och nyår)
Styrs av `seasons` i `weather/rules.json` (svensk lokal tid, Europe/Stockholm):
- **Julmössor:** 1–24 dec. Scenerna `<aktivitet>--<kläder>--xmas.svg` byts in automatiskt.
- **Nyårsfyrverkeri:** 31 dec 23:30 till 1 jan 01:30. Aktiviteten `fireworks` ersätter vädrets aktivitet (kläderna följer fortfarande vädret).
- Förhandsgranska på sajten med `?datum=2026-12-31T23:45:00+01:00` i URL:en.
- Julmössorna finns bara i Greys-stilen (`--shop` bygger dem inte).

## Animation
Gubbarna gungar på huvudet ibland (CSS i varje SVG, ingen JavaScript). Mannen var 29:e sekund och kvinnan var 41:a, första gungningen efter 21 respektive 27 s, så det ser oregelbundet ut. Regn, snö, löv, dimma, UFO-svävning och åskblixtar rör sig också. Allt avstängt vid `prefers-reduced-motion`.

## Månen
`weather/moon.mjs` räknar ut månfasen ur datumet (ingen nätverksanrop, ungefär ±½ dygn) och sajten ritar månen med rätt fas ovanpå scenen uppe till vänster. Den göms vid solbad (solen) och nyårsfyrverkeri. Förhandsgranska med `?datum=`.

## Lager och moln
Varje scen byggs som tre filer: `<scen>.svg` (helbild, används av tester), `<scen>.bg.svg` (himmel, UFO, kullar) och `<scen>.fg.svg` (gubbar, mark, regn/snö, dimma). Sajten lägger månen (`weather/moon.mjs`) och molnen (`weather/clouds.mjs`) *mellan* bakgrund och förgrund, så molnen driver bakom gubbarna och kan skymma månen. Molnen följer SMHI:s molnighet: klart = inga, halvklart = några, mulet = molntäcke. Åskscenen har egna stormmoln.
