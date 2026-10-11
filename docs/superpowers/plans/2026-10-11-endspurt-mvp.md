# Endspurt-MVP (Gamejam, 2026-10-11) — Plan

> **Für Ausführende:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline, es ist ein Ein-Tages-Sprint). Schritte mit Checkboxen. Pure Logik test-first, danach `npm test` + `npm run smoke`, dann pushen (Push auf `main` deployt nach alchemist.msmr.co).

**Ziel:** Heute ein spielbares, in sich geschlossenes Spiel: Level 1 + 2 (Gold) vollständig, Level 3 (Geist fangen) als kurzer Abschluss, bedient mit Quest-Controllern und kontextbezogenen Handwerkzeugen aus einem Regal, mit drei Schwierigkeitsgraden, die Zeit- und Temperaturfenster wirklich verändern.

**Architektur in einem Satz:** Spielregeln werden aus `CFG` + Schwierigkeit zu einem `rules`-Objekt im State (statt `CFG` direkt zu lesen); der Controller trägt genau ein Handwerkzeug, das über den analogen Trigger ein Hauptwerkzeug „bedient"; die Hauptwerkzeuge liegen links, die Handwerkzeuge rechts im Regal; Level 3 benutzt die vorhandenen Pfützen (Salz) als Kreis.

**Tech Stack:** three.js, Vite, node:test, Puppeteer-Smoke. Icons: Font Awesome Free (SVG-Pfade, direkt zu Voxeln gerastert, kein Bild-Umweg).

**Quelle:** Vorgaben von Uli im Chat vom 2026-10-11 (4 Punkte + Level 3 + Vorschläge); Vorarbeit: `docs/superpowers/specs/2026-10-10-settings-console-design.md` (Stufe 1 gebaut, `ad13e1d`).

## Annahmen und offene Punkte (kurz bestätigen, sonst gilt die Annahme)
1. **„Tippschalter 2×2 vox"**: 2×2 Voxel = 1,5 cm ist unter dem Tracking-Jitter eines Controllers. Annahme: Wert steht in `CONSOLE.buttons.size` (in Voxeln), Standard **4×4 Voxel (3 cm)**; auf 2 stellbar, wenn du es wirklich so willst.
2. **Controller statt Hände**: Hand-Tracking-Code bleibt im Repo als Rückfall, wird heute nicht weiter gepflegt und nicht gelöscht (Zeit). Spiel und Konsole werden nur mit Controllern und Maus getestet.
3. **Trigger analog**: Ergebnis des `?trigger`-Tests (alchemist.msmr.co/?trigger) entscheidet, wie fein die Zange schließt. Fallback: Schwelle (>0,5 = zu).
4. **Level 3 = Geist fangen, ohne echte Wand** (Wandkalibrierung ist heute nicht machbar): der Geist spielt auf dem Tisch. Katzen-Finale als **kleine Variante** (Task 5b, ohne Morph, ohne Wand/Boden), streichbar; ohne 5b endet Level 3 mit einem Abschlussbild.
5. **Font Awesome Free**: Icons sind CC BY 4.0, ein Namensnennungs-Satz kommt in die Statuszeile/README.

## Reihenfolge, Zeitbudget und Schnitt-Linie
| # | Block | Schätzung | Wenn die Zeit knapp wird |
|---|---|---|---|
| 1 | Tisch 1,6 × 0,8 m | 0,5 h | Pflicht |
| 2 | Tippschalter (Theme, Hintergrund, Schwierigkeit) | 1,5 h | Pflicht |
| 3 | Schwierigkeit wirkt auf Regeln | 1,5 h | Pflicht |
| 4 | Controller + Handwerkzeuge (Zange, Löffel, Rührstab) | 4 h | Pflicht, größtes Risiko |
| 5 | Level 3 (Geist) | 3 h | vereinfachen: ohne Kork, Fang = Phiole über Kreis |
| 5b | Katzen-Finale (klein) | 2 h | streichen: Abschlussbild nach dem Geist |
| 6 | Regal (Fächer) | 2 h | **zuerst streichen**: Werkzeuge liegen frei auf dem Tisch (Platz je Fach als Startposition) |
| 7 | Politur, Hinweise, itch/Server-Test | rest | |

Schnitt-Linie wie in `CLAUDE.md`: Pfad 1 (Gold) bleibt vollständig, vorne anfangen, hinten streichen.

---

## Task 1: Tisch 1,6 × 0,8 m
**Dateien:** `src/config/layout.js` (`table: { w: 1.6, d: 0.8 … }`), `test/*` die 2 × 1 annehmen, `test/smoke.mjs` (Kamera in Schritt 11).
- [ ] `table.w = 1.6`, `table.d = 0.8`; `tableBounds` folgt automatisch. Prüfen: Dish (x 0.24, z 0.11), Matchbox, Vial-/Rod-Ruheplatz, Statuspanel (`fromBack`) liegen innerhalb; `minZ = -0.6`, `maxZ = 0.2` → Dish/Vial bei z ≈ 0.08–0.11 bleiben drin.
- [ ] Physik-Tisch (`createPhysics({ table })`) und `maxX`-Abhängiges (Konsole) folgen aus `tableBounds`; Test `console.test.js` (Controls auf dem Tisch, nicht überlappend) muss grün bleiben.
- [ ] `npm test`, `npm run smoke`, Commit.

## Task 2: Tippschalter statt Kippschalter/Drehschalter
**Ziel:** Jede Einstellung ist eine Reihe nebeneinanderliegender Schaltflächen. Passiv = dunkelgrün, aktiv = leuchtend (grün/gelb); über jedem Schalter ein Icon aus Voxeln.

| Reihe | Optionen (nebeneinander) | Icons (FA Free) |
|---|---|---|
| Look | dunkel, hell | `faMoon`, `faSun` |
| Hintergrund | Labor, Werkbank, Stall | `faFlask`, `faHammer`, `faHorse` |
| Schwierigkeit | leicht, normal, schwer | `faFaceSmile`, `faFaceMeh`, `faSkull` |

**Dateien:** `src/config/console.js` (Reihen als Daten: `rows: [{ key, options: [{ value, icon }] }]`, Farben `buttonPassive` dunkelgrün, `buttonActive` leuchtend, `buttons.size` in Voxeln), `src/game/console.js` (`controls()` aus `rows` erzeugen; Hebel entfällt), `src/view/console.js` (Schalter + Icon darüber; Hebel-Code entfernen), `src/icons.js` (neu, siehe unten), `src/runtime/console.js` (Press: `settings.set(row.key, option.value)`), `src/settings.js` (unverändert, `difficulty` existiert), `test/console.test.js`.
- [ ] **Icons ohne Bild-Umweg:** `npm i @fortawesome/free-solid-svg-icons`; `src/icons.js`: `iconBitmap(faIcon, n = 7)` rastert den SVG-Pfad (`icon.icon[4]`, Viewbox `icon.icon[0] x icon.icon[1]`) mit `Path2D` auf ein n×n-Canvas, Schwelle bei 50 % Deckung → `string[]` im gleichen Format wie `CONSOLE.icons`. Test (pure, ohne DOM): Rasterung mit einer eigenen Mini-Pfad-Funktion hinter einem `fill(path) -> alphaGrid`-Parameter; im Browser `Path2D`.
- [ ] `controls()` liefert pro Option ein Control `{ id: 'difficulty:hard', row, value, x, z, halfX, halfZ }`; Reihen laufen von vorn nach hinten am rechten Rand, Optionen nach links. Tests: keine Überlappung, alle auf dem Tisch (0,8 tief reicht für 3 Reihen × 3 cm + Lücken).
- [ ] `view`: je Option ein Körper in der Tasche; aktiv = `buttonActive` und 2 Voxel eingedrückt, passiv = `buttonPassive`; Icon als flaches Voxelmesh 2 Voxel hinter dem Schalter auf dem Tisch („darüber" = Richtung Tischmitte/hinten).
- [ ] Smoke: Klick auf „hell", „Werkbank", „schwer" → `__game.settings` stimmt, Reload behält.
- [ ] Commit.

## Task 3: Schwierigkeit wirkt auf Regeln (logisch)
**Prinzip:** je schwerer, desto enger/kürzer; je leichter, desto verzeihender. Kein Schalter ändert Regeln, die der Spieler nicht erkennen kann (alles ist an den Ringen/Fenstern sichtbar).

| Regel (`CFG`) | leicht | normal | schwer |
|---|---|---|---|
| Dosierfenster Quecksilber `DOSE_MIN..MAX` | 0,55–1,45 | 0,7–1,3 | 0,85–1,15 |
| Schwefelfenster `SULFUR_MIN..MAX` | 0,25–0,85 | 0,35–0,75 | 0,45–0,65 |
| Temperaturfenster: `BURN` (Anbrennen) | 0,98 | 0,95 | 0,90 |
| `BURN_HOLD` (Zeit bis es verbrennt) | 4 s | 2,5 s | 1,5 s |
| `HEAT_RATE` (wie schnell heiß) | 0,12 → langsamer ist leichter: 0,09 | 0,12 | 0,16 |
| `STIR_NEEDED` Rührzeit | 2 s | 3 s | 4,5 s |
| `LUMP_HOLD` bis es klumpt | 14 s | 10 s | 6 s |
| Streichholz `STRIKE_SPEED..MAX` | 0,7–4 | 1,0–3,0 | 1,3–2,4 |
| Zangen-Schwelle Bruch `breakSpeed` Phiole | 3,0 | 2,2 | 1,6 |
| Ersatz-Phiolen (Regal, Task 6) | 1 | 0 | 0 |

**Dateien:** `src/config/game.js` (nur Normalwerte bleiben in `CFG`), `src/config/difficulty.js` (neu: je Stufe nur die abweichenden Werte, deep-frozen), `src/game/rules.js` (neu, pure: `rulesFor(difficulty) -> frozen CFG-Kopie`), `src/game/sim.js` + `src/game/levels/*.js` + `pouring.js`/`scoring.js` (`CFG.X` → `state.rules.X`, Level-Funktionen bekommen den State oder `rules`), `src/runtime/runner.js` (`reset()` baut `createState(rulesFor(settings.difficulty))`), `src/main.js` (Änderung der Schwierigkeit löst Neustart aus: ein Fenster-Wechsel mitten im Level wäre unfair), `test/rules.test.js`.
- [ ] Test zuerst: `rulesFor('normal')` ist gleich `CFG`; für jede Stufe sind Fenster geordnet (`MIN < MAX`, `MELT < CRITICAL < BURN <= 1`), leicht ist in jeder Größe verzeihender als normal, normal als schwer (Fensterbreite, Haltezeit).
- [ ] `grep -rn "CFG\." src/game src/runtime src/view` abarbeiten; die `config.test.js`-Ordnungstests für alle drei Stufen laufen lassen.
- [ ] Gauge-Ringe (`effects.updateGauge`) lesen das Fenster aus `rules`, damit das sichtbare Fenster mit dem echten übereinstimmt.
- [ ] Smoke: Schwierigkeit wechseln startet neu und `state.rules.DOSE_MAX` ändert sich.
- [ ] Commit.

## Task 4: Controller + Handwerkzeuge
**Konzept:** Der Controller wird zum **Griff**; am Griff steckt genau ein **Handwerkzeug** (sichtbar, mit eigenem Voxelmodell). Der **analoge Trigger** (0–1) „bedient" es kontextabhängig. Der **Grip-Knopf** nimmt ein Handwerkzeug aus dem Regal / legt es zurück (Task 6; bis dahin: Tasten 1–3 bzw. Standard „Zange" am rechten, „Löffel" am linken Controller).

| Handwerkzeug | bedient | Trigger (analog) | Gummi/Rutschen |
|---|---|---|---|
| **Zange mit Gummibelag** | Phiole, Nugget, Streichholz | 0 = offen, Schließweg → Backen greifen; ab Schwelle hält sie, Haltekraft wächst mit dem Wert (Gummi → rutscht erst bei niedrigem Wert) | Haltekraft = `holdStrength(trigger)` (existiert in `tracking.js`) |
| **Löffel mit langem Stiel** | Schwefel aus der Schale, später Salz | Trigger loslassen = Löffel waagerecht (hält), Trigger drücken = kippt ihn über der Mündung (Menge nach Kippwinkel) | – |
| **Rührstab** | Rühren im Tiegel | keiner nötig (Bewegung im Tiegel zählt, vorhandene `stirring.js`) | – |
| **Streuer** (Level 3) | Salzkreis | Trigger = Durchfluss | – |

**Wiederverwenden statt neu bauen:** die Werkzeug-Physik (`runtime/tools.js`, `physics.js`: Feder-Griff mit Kraftgrenze, Bruch) bleibt. Der Controller-Pfad ersetzt nur *wer* greift: `hand.pinch`/`hand.squeeze` kommen schon aus `buttons[0/1].value` (`vr.js`). Neu ist, dass das Handwerkzeug den Greifpunkt (Zangenspitze statt Handfläche/Pinch-Punkt) und die Aktion (Trigger) vorgibt.

**Dateien:** `src/config/handtools.js` (neu: je Handwerkzeug Spitzenversatz am Controller, Reichweite, Schwellen), `src/handtools.js` (neu, pure: `jawClosure(trigger)`, `spoonTilt(trigger)`, `canGrab(tool, tip)`), `src/runtime/handtools.js` (neu: pro Controller das getragene Handwerkzeug, Greifen/Loslassen, Löffel füllen/kippen), `src/assets.js` (Modelle Zange, Löffel, Streuer aus Code, ~12–20 Voxel lang), `src/runtime/hands.js` (Controller-Pfad ruft Handwerkzeug auf, Hand-Pinch/Fist entfällt für Controller), `src/runtime/mouse.js` (Maus emuliert: Linksklick = Trigger voll, Mausrad = Triggerwert, Tasten 1–3 = Handwerkzeug), `test/handtools.test.js`.
- [ ] Test zuerst (pure): `jawClosure` monoton 0..1 mit Totzone; `canGrab` nur wenn Backenspitze innerhalb `grabRadius` des Werkzeugs; Löffel: Schwefelmenge pro Eintauchen = `CFG.GRAINS_PER_PINCH * CFG.GRAIN`, Kippwinkel → Abgaberate stetig; Zange hält ab Schwelle, lässt unter Hysterese los.
- [ ] Vorhandene Reichweiten (`INPUT.reach`) für die Schale/Streichholzschachtel gelten nun für die **Löffelspitze** bzw. **Zangenspitze**, nicht mehr für den Pinch-Punkt.
- [ ] Haptik: Greifen = kurzer Puls, Gummi-Rutschen = leises Dauerpuls (Werte aus `INPUT.haptics`).
- [ ] Phiole bricht weiterhin durch Aufprall (`breakSpeed` nach Schwierigkeit); „Zerquetschen" entfällt (Zange quetscht nicht), Config-Eintrag `crush` bleibt `null`.
- [ ] Smoke (Maus-Emulation): Zange greift die Phiole, hebt sie, kippt sie → Quecksilber fließt; Löffel nimmt Schwefel und gibt ihn über dem Tiegel ab; beides erreicht Level 2.
- [ ] **Auf dem Headset prüfen (nicht automatisierbar):** Controller-Versätze (`INPUT.controller.tipZ`), Zangen-Trigger-Gefühl, Löffel-Kippen. Panel zeigt `p`/`g` je Controller.
- [ ] Commit.

## Task 5: Level 3 — Geist fangen (Tisch-Variante)
**Warum so:** Nutzt, was schon da ist: Pfützen-System für das Salz, Kerze, Vorbild-Level-Daten. Keine Wand, kein neuer Physik-Code.

**Ablauf (Spieler):**
1. Kerze anzünden (Streichholz, Zange) – wie Level 1.
2. **Kräuter** aus einer zweiten Schale mit dem Löffel auf die Kerze legen → **Rauch** steigt auf (Voxelpartikel, wiederverwendet: Gas = aufsteigende Würfel) → der **Geist** wird als durchscheinender Voxelkörper sichtbar (Rauch-Intensität > Schwelle).
3. Mit dem **Streuer** einen **geschlossenen Salzkreis** (Ø ca. 12–15 cm) auf den Tisch streuen. Der **Gold-Nugget** (Ergebnis aus Level 2) kommt als Köder in die Mitte. Der Geist schwebt zum Köder, solange der Kreis **geschlossen** ist, bleibt er im Kreis; bei Lücke flieht er (Ring zurück auf offen).
4. **Phiole** (leer, aus dem Regal) mit der Zange über den Kreis stülpen und 1,5 s halten → **Geist gefangen** → weiter mit Task 5b (Katze); ohne 5b: Abschlussbild („Der Geist ist in der Flasche").

**Fehlschläge (sind Zeilen, keine Sperren):** Lücke im Kreis → Geist entweicht (Rauch wieder nötig); Kerze aus → Geist verblasst; **Katzengold als Köder** → Geist ignoriert ihn und wandert zum Rand; zu viel Salz verschwendet (Streuer leer, Ersatz aus Schale nachfüllen).

**Dateien:**
- `src/game/levels/level3.js`: Daten wie Level 1/2: `scene: { tools: ['vial', 'spoon', 'shaker'], props: ['herbs', 'saltDish'] }`, `reactions` (Rauch, Geist sichtbar, Kreis geschlossen, gefangen), `complete`, `status`, `gauge` (Rauchanzeige).
- `src/game/ring.js` (neu, pure, **test-first**): `ringClosed(cells, center, radius)`: Flood-Fill von außen über die Salzzellen der Pfütze (`puddles.js`, Zellgröße = Voxel); **geschlossen**, wenn der Innenraum um den Köder nicht von außen erreichbar ist. Tests: voller Kreis → true; Lücke von 1 Zelle → false; Doppelkreis; Kreis ohne Köder innen → false.
- `src/game/ghost.js` (neu, pure): Zustandsautomat `hidden → visible → bait → trapped | fled`, Rauch-Pegel steigt mit Kräuter-Brennen, fällt ohne Kerze.
- `src/game/sim.js`: `createState` bekommt `smoke`, `ghost`; `step` ruft `stepGhost`.
- `src/runtime/ghost.js`, `src/view/ghost.js`: Geist als Voxelmesh (Code-Modell ~16–21 Voxel hoch, Silhouette: Laken-Geist, Augen 1 Voxel), schwebt mit Sinus, Rauchpartikel als `InstancedMesh`.
- `src/props.js`/`src/assets.js`: Kräuterschale, Salzschale, Streuer, Kork (optional).
- `src/config/game.js` + `config/difficulty.js`: `SMOKE_RATE`, `GHOST_VISIBLE`, `RING_RADIUS_MIN/MAX`, `TRAP_HOLD`; leicht = größere Lücken-Toleranz (1 Zelle), schwer = keine.
- `src/game/levels/index.js`: `LEVELS = [level1, level2, level3]`; Level-Übergang Level 2 → 3, sobald das Gold als Nugget genommen wurde (existiert, `advanceLevel`).
- [ ] `test/ring.test.js`, `test/ghost.test.js`, `test/levels.test.js` erweitern (Level 3 hat `scene`, `complete`, jede Zeile hat `when/hold/apply`).
- [ ] Smoke: Level 3 per Test-Hook erreichen, Kreis per `puddles.add` schließen, Geist wird `trapped`.
- [ ] Commit.

## Task 5b: Katzen-Finale (klein, streichbar)
**Konzept bleibt:** Das Gold wird zu den Augen, der gefangene Geist macht die Katze lebendig. Ohne Morph, ohne Boden: alles auf dem Tisch.
1. Nach dem Fang liegt auf dem Tisch eine **Katzenfigur aus Stroh** (Voxelmodell ~16–21 Voxel, kalt/grau-gelb). Der **Gold-Nugget** aus dem Kreis wird mit der Zange auf die Augen-Stelle gelegt (Radiustest, `eyes: true`; Katzengold → Katze schielt und läuft später im Kreis).
2. **Phiole öffnen** (Kork ab oder Phiole über der Katze kippen, Trigger-Kippen wie beim Gießen): der Geist zieht als Rauchpartikel in die Katze.
3. Wechsel `straw → alive`: Modellwechsel + 2–4-Bild-Laufzyklus (Teile wackeln per Code), die Katze läuft zum **Kissen** am Tischrand → Abschlussbild.
- **Dateien:** `src/game/levels/level3.js` (zweite Phase: Zeilen `eyes`, `release`, `alive`, `complete`), `src/game/cat.js` (pure, test-first: Zustand `straw → eyes → ghosted → alive | squint`, Pfad zum Kissen), `src/assets.js` (Katze straw/alive/Lauf-Frames, Kissen), `src/view/cat.js`, `src/runtime/cat.js`.
- [ ] Test zuerst: Katze wird nur lebendig mit Gold-Augen **und** gefangenem Geist; Katzengold gibt `squint`; Reihenfolge der Schritte egal, solange beide Bedingungen vor `alive` gelten.
- [ ] Smoke: per Test-Hook `trapped` setzen, Augen platzieren, Phiole öffnen → `alive`, Katze erreicht das Kissen.
- [ ] Commit.

## Task 6: Regal mit Fächern
**Layout:** Regal hinten am Tisch (über der Hinterkante), 1,6 m breit: **linke Hälfte Hauptwerkzeuge** (Phiole, Tiegel-Ersatz/Phiole 2, Streichholzschachtel, Schalen), **rechte Hälfte Handwerkzeuge** (Zange, Löffel, Rührstab, Streuer), je ein Fach mit Umriss.
- [ ] `src/config/layout.js`: `shelf: { y, depth, split: 0 (Mitte), slots: [{ id, side: 'main' | 'hand', x, y }] }`.
- [ ] `src/game/shelf.js` (pure, test-first): `slotFor(id)`, `nearestSlot(point, free)`, Slot belegt/frei, Ersatzanzahl nach Schwierigkeit (Task 3).
- [ ] `src/view/shelf.js`: Brett + Fächer (Umriss als flacher Voxelrahmen); `runtime/handtools.js`: **Grip-Knopf** am Fach nimmt das Handwerkzeug auf, in der Nähe eines freien Fachs losgelassen setzt es zurück.
- [ ] Hauptwerkzeuge lassen sich mit der Zange wieder ins Fach stellen (Aufräumen); Ersatzphiole liegt im Fach „Phiole 2" (leicht = 1, sonst 0).
- [ ] `nearThing`/Konsole: Regal ist keine Kalibrierfläche.
- [ ] **Wenn die Zeit knapp ist:** Fächer nur als Startpositionen und Zeichnung, kein Zurücklegen; Handwerkzeug-Wechsel per Grip „zyklisch" (Zange → Löffel → Rührstab).
- [ ] Commit.

## Task 7: Politur und Abgabe
- [ ] Hinweis-Symbole statt Text (`CLAUDE.md`: Text ist bei 0,75 cm unlesbar): Schwefel-/Salz-/Rauch-Symbole an den Ringen.
- [ ] Ein Durchlauf pro Schwierigkeit auf dem Headset, Zeit pro Level messen, `difficulty.js` nachziehen.
- [ ] Namensnennung Font Awesome, itch.io-Iframe-Test (`xr-spatial-tracking`), `npm test` + `npm run smoke`, Push, auf alchemist.msmr.co durchspielen.

## Review Focus (Eingaben, die der Spieler trifft und die keine Aufgabe ausdrücklich nennt)
- Zange wird **mitten im Pour** losgelassen: Phiole fällt und bricht (leicht verzeihender), Mercury verteilt sich; kein Absturz, Level bleibt lösbar (Ersatz oder Neustart). → Test in `handtools.test.js`.
- **Beide Controller** greifen dasselbe Werkzeug: das zweite Greifen wird ignoriert, nicht verdoppelt.
- **Schwierigkeit wechseln** mitten im Level: Neustart mit neuen Regeln, Gauge zeigt neue Fenster. → `rules.test.js`.
- **Salzkreis mit Lücke** schließt sich nie „halb": Flood-Fill-Test (1 Zelle Lücke diagonal!).
- **Level 3 ohne Gold** (Level 2 verlassen ohne Nugget geht nicht; Level 3 per Neustart startet Level 1, nicht 3).

## Gameplay-Vorschläge (nach dem MVP oder wenn Zeit bleibt)
1. **Ein Bewertungsbild am Ende jedes Levels:** Goldbarren-Anzahl 1–3 aus der Qualität (`goldQuality`), sichtbar auf dem Panel und als Barren im Regal. Billig, gibt Wiederspielwert.
2. **Hitze als Fertigkeit:** Brenner mit regelbarer Flamme (Trigger der Zange am Gasrad); heizt schneller/langsamer, Schwierigkeit verändert Trägheit.
3. **Zeitdruck durch die Kerze:** die Kerze brennt ab (60–120 s je Schwierigkeit); Streichhölzer begrenzt (existiert: `MATCHES`). Schwer = kürzere Kerze.
4. **Zufalls-Rezept pro Durchlauf:** das Dosierfenster verschiebt sich leicht (Mercury 0,8–1,2 oder 1,0–1,4), ein Pergament-Symbol am Regal zeigt es. Macht Wiederholungen spannend.
5. **Geist als Gegenspieler:** im Level 3 stört er (schubst Salz, löscht die Kerze); Salzkreis ist die Antwort. Nur wenn Level 3 früh fertig wird.
6. **Katzen-Morph** statt Modellwechsel (Strohfigur → Katze per Voxel-Morph), wenn Task 5b früh fertig ist.

## Werkzeug-Vorschläge
- **Handwerkzeuge (am Controller):** Zange mit Gummibelag (Phiole, Nugget, Streichholz), Löffel mit langem Stiel (Schwefel, Salz, Kräuter), Rührstab (Tiegel), **Streuer** (Salzkreis), **Pinzette** (kleine Dinge, Präzision: Bewegungsskalierung 0,3, gehört zu Level 3-Köder), **Löschhütchen** (Kerze ausmachen, ersetzt „Pinch am Docht"), **Kork** (Phiole schließen).
- **Hauptwerkzeuge (im Regal links):** Phiole (Quecksilber), Ersatzphiole, Streichholzschachtel, Schwefelschale, Kräuterschale, Salzschale, Tiegel auf Ständer mit Kerze.
- **Später:** Mörser (zermahlen: Trigger drücken + Kreisbewegung), Eiskristall (kühlen), Blasebalg (Wind: Controller-Schwung).

## Selbst-Review
- **Abdeckung:** (1) Tippschalter 2×2 → Task 2 (mit Annahme 4×4, Icons FA direkt) und Tisch 1,6×0,8 → Task 1; (2) Controller/Handwerkzeuge/Zange/Löffel → Task 4; (3) Schwierigkeit → Task 3 (Zeit-, Temperatur-, Dosierfenster); (4) Regal links Haupt/rechts Hand → Task 6; Level 3 → Task 5; Vorschläge → Abschnitte oben.
- **Namenskonsistenz:** `rulesFor`/`state.rules` (Task 3) werden in Task 5/6 gelesen; `controls()` aus `rows` (Task 2) ersetzt den Hebel; `holdStrength` stammt aus `tracking.js` (existiert).
- **Nicht verifiziert (Headset):** Trigger-Auflösung, Zangen- und Löffelgefühl, Schalter-Größe, Rauch-/Geist-Performance auf Quest. Alles Tuning-Zahlen liegt in `config/`.
