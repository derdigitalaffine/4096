# Tromu Spielewelt

Dieses Repository ist direkt der Webroot für die **Tromu Spielewelt**: eine lokale, installierbare und offlinefähige Browser-Spielesammlung ohne Runtime-Abhängigkeiten, Anmeldung oder Tracker.

Aktuell registriert sind:

- **4096** unter `/4096/` – Zahlen zusammenschieben und 4096 erreichen.
- **Sudoku** unter `/sudoku/` – mobile-first 9×9-Sudoku mit drei Schwierigkeitsstufen, Notizen, Undo, Timer und lokaler Fortsetzung.
- **Dr. Tromu** unter `/dr-tromu/` – Kapselpuzzle mit Viren, Vierer-Matches, Kaskaden und lokaler Fortsetzung.
- **Super Tromu Land** unter `/super-tromu-land/` – seitlich scrollendes Jump ’n’ Run mit vier Welten und zwölf eigenen Stages von `1-1` bis `4-3`.
- **Tromu Snake** unter `/snake/` – schnelles Score-Arcade mit Classic-, Speed- und Maze-Modus, Pickups, Combos und lokalen Highscores.
- **Tromu Sokoban** unter `/sokoban/` – zehn eigene Push-Puzzle mit Mehrfach-Undo, Level-Fortschritt und Bestwerten für Züge/Schübe.
- **Tromu Breakout** unter `/breakout/` – fünf kurze Arcade-Level mit Paddle, drei Power-ups, Leben und lokalem Bestwert.
- **Tromu Minesweeper** unter `/minesweeper/` – zugängliches Minenrätsel mit drei Stufen, sicherem ersten Reveal, Flag-Modus und lokalen Bestzeiten.
- **Tromu FreeCell** unter `/freecell/` – klassisches Solitaire mit reproduzierbaren Deals, Mehrfach-Undo und lokaler Fortsetzung.

Frühere Pfade `/dr-mario/` und `/super-mario-land/` bleiben als nicht beworbene Kompatibilitätsalias erhalten. Alle regulären Produktlinks verwenden die Tromu-Namen.

## Lokal starten

Es gibt keinen Buildschritt. Ein statischer Server genügt:

```bash
python3 -m http.server 8080
```

Danach `http://localhost:8080` öffnen. `localhost` ist ein sicherer Browserkontext und erlaubt Service-Worker-/PWA-Tests.

## Zentrale Spieleregistrierung

`games.js` ist die zentrale Quelle für die gemeinsam benötigten Metadaten jedes Spiels:

- stabile `id`
- sichtbarer `name`
- kanonische `route`
- kurzer Beschreibungstext für die Welcome-Page
- optionale `legacyRoutes`
- `shell`: die Dateien und Routen, die für den Offline-Vertrag des Spiels erforderlich sind

`home.js` rendert die Spielkarten der Welcome-Page direkt aus `GAMES`. `game-nav.js` erzeugt auf jeder kanonischen Spielseite aus derselben Registry den Rückweg zur Spielewelt sowie die Links zu allen anderen registrierten Spielen. Registry-Routen werden relativ zum tatsächlichen Webroot aufgelöst, damit die Spielewelt sowohl am Domain-Root als auch unter einem Deployment-Prefix funktioniert.

### Neues Spiel hinzufügen

Für einen weiteren Direct-Webroot-Spielpfad gilt dieser Vertrag:

1. Spielverzeichnis mit lokalem `index.html`, CSS und JavaScript anlegen.
2. Einen Eintrag in `games.js` ergänzen und dessen `shell` vollständig deklarieren.
3. Auf der kanonischen Spielseite `data-game-id="…"`, einen `data-game-nav`-Container und `../game-nav.js` verwenden.
4. Die im Registry-`shell` deklarierten Dateien in `APP_SHELL` von `sw.js` aufnehmen und bei Shell-Änderungen die Cache-Version erhöhen.
5. Spielregeln mit Node-Tests und Browser-/Mobile-/Offline-Verhalten mit einem passenden Smoke absichern.

`games.test.js` und `pwa.test.js` prüfen IDs, Routen, Registry-Navigation, vorhandene Shell-Dateien und die Übereinstimmung mit dem Service-Worker-Precache. `game-navigation-smoke.mjs` iteriert die Registry, statt eine feste Spielanzahl anzunehmen.

## PWA / Offline

`manifest.webmanifest` beschreibt die installierbare **Tromu Spielewelt** als Root-PWA. `sw.js` precacht Welcome-Page, Registry-/Navigationsmodule, die registrierten Spiel-Shells und die weiterhin unterstützten Legacy-Aliase. Die aktuelle Shell-Version ist **`4096-shell-v23`**.

Navigationen werden network-first geladen und erfolgreiche Antworten aktualisieren den Cache. Offline wird zuerst die passende gecachte Navigation verwendet; extensionlose bekannte Unterseiten können auf ihre gecachte Slash-Route umgeleitet werden. Der Root-Fallback bleibt die Welcome-Page.

Für einen manuellen Offline-Smoke:

1. `/` online laden und auf `Online · offline bereit` warten.
2. Die kanonischen Spielpfade einmal öffnen.
3. Netzwerk in DevTools auf Offline setzen und neu laden.
4. Prüfen, dass die aktive Oberfläche mit `Offline · spielbereit` startet.
5. Offline über die gemeinsame Navigation zwischen den registrierten Spielen wechseln.

## Steuerung und Spielstand

### 4096

- Pfeiltasten oder WASD; auf Touch wischen
- `Strg/⌘+Z` oder Button für genau einen Undo-Schritt
- Spielstand, Undo-Snapshot und Bestwert werden lokal gespeichert

### Sudoku

- Feld wählen, Zahl 1–9 eingeben
- Pfeiltasten navigieren, `N` schaltet Notizen um
- `Entf`/`Backspace` löscht, `Strg/⌘+Z` macht rückgängig
- Aufgabe, Einträge, Notizen, Fehlerzahl und Timer werden lokal fortgesetzt

### Dr. Tromu

- Links/rechts: Pfeile oder `A`/`D`
- Drehen: Pfeil hoch oder `W`
- schneller fallen: Pfeil runter oder `S`
- sofort ablegen: Leertaste oder Enter
- Touch-Steuerung über große Buttons

Dr. Tromu speichert Flasche, aktive und nächste Kapsel, Punkte und Viruszahl lokal. Beschädigter oder inkompatibler Storage wird verworfen und durch eine valide neue Runde ersetzt.

### Super Tromu Land

- Links/rechts: Pfeiltasten oder `A`/`D`
- Springen: Pfeil hoch, `W` oder Leertaste
- Blumenball: `X` oder `K`; auf Touch über **Ball**
- `R`: neue Runde

Die Kampagne umfasst vier Welten mit je drei Stages. In `1-3` ist das Rohr vor der mittleren Lücke auf 80 Pixel abgesenkt. `2-3` und `4-3` sind Auto-Scroll-Finale. Pilz und Blume liefern Treffer-Schutz beziehungsweise Ball-Angriff; Punkte, Leben und Power-up-Zustand werden beim Stagewechsel weitergegeben.

### Tromu Snake

- Pfeiltasten oder WASD; auf Touch über das Vier-Richtungs-D-Pad
- `P`: Pause/Weiter
- `R`: neue Runde
- **Classic**: konstantes Grundtempo ohne Hindernisse
- **Speed**: höheres Starttempo und weitere Beschleunigung nach Pickups
- **Maze**: eigenes Hindernisfeld bei mittlerem Tempo
- schnelle Pickups innerhalb des Combo-Fensters erhöhen den Multiplikator bis `×5`

Bestwerte werden getrennt für Classic, Speed und Maze lokal gespeichert. Beschädigter oder gesperrter Storage blockiert den Spielstart nicht.

### Tromu Sokoban

- Pfeiltasten oder WASD; auf Touch über das Vier-Richtungs-D-Pad
- `Strg/⌘+Z` oder **Undo** macht beliebig viele gültige Züge rückgängig
- `R` oder **Restart** startet das aktuelle Level neu
- die Levelauswahl zeigt alle bereits freigeschalteten Stufen
- zehn eigene Levels steigern Kistenanzahl, Engstellen und erforderliche Push-Reihenfolge schrittweise

Fortsetzung, Freischaltung und Bestwerte werden lokal gespeichert. Pro Level gewinnt zuerst die geringere Zahl an Schüben, bei Gleichstand die geringere Zahl an Zügen. Beschädigter oder gesperrter Storage fällt sicher auf Level 1 zurück.

### Tromu Breakout

- Links/rechts: Pfeiltasten oder `A`/`D`
- Leertaste oder **Start** setzt den Ball in Bewegung
- `P` oder **Pause** hält die Physik an; `R` oder **Restart** startet eine neue Runde
- Touch funktioniert über große Links/Rechts-Ziele sowie direktes Ziehen des Paddles im Canvas
- fünf eigene kurze Level enthalten normale Blöcke sowie **W** (breiteres Paddle), **S** (langsamer Ball) und **M** (Multiball)

Punkte und Leben laufen über Levelgrenzen weiter. Der lokale Bestwert wird fortlaufend gespeichert; beschädigter oder gesperrter Storage fällt sicher auf `0` zurück.

### Tromu Minesweeper

- Tap/Enter deckt die fokussierte Zelle auf; der erste Reveal und seine Nachbarn sind garantiert minenfrei
- **Modus: Flagge** oder `F` setzt beziehungsweise entfernt eine Flagge ohne versteckten Long-Press-Zwang
- Pfeiltasten bewegen einen sichtbaren roving Fokus über das Raster; `R` startet die Runde neu
- **Leicht**: 8×8 mit 10 Minen, **Mittel**: 9×9 mit 16 Minen, **Schwer**: 10×10 mit 24 Minen
- Nullfelder breiten sich automatisch aus; Zellzustände verwenden Symbole/Zahlen und Screenreader-Labels statt nur Farbe

Bestzeiten werden pro Schwierigkeitsstufe lokal gespeichert. Beschädigter oder gesperrter Storage fällt sicher auf leere Bestzeiten zurück.

### Tromu FreeCell

- Karte oder gültige absteigende Rot/Schwarz-Folge auswählen und danach FreeCell, Foundation oder Kartenreihe als Ziel wählen
- Touch und Maus verwenden dieselben großen Zielbereiche; auf Desktop können Karten zusätzlich gezogen werden
- vollständige Tastaturbedienung über Tab/Shift+Tab und Enter; `Strg/⌘+Z` macht beliebig viele gespeicherte Züge rückgängig
- `N` startet den nächsten reproduzierbaren Deal, `R` startet denselben Deal neu; ein Seed kann direkt geladen werden
- klassische Vier-FreeCell-/Vier-Foundation-Regeln und Supermoves entsprechend freier Zellen und leerer Hilfsspalten

Aktueller Deal inklusive Undo-Historie sowie lokale Versuche/Siege werden fehlertolerant gespeichert. Beschädigter oder gesperrter Storage blockiert den Spielstart nicht; derselbe Seed erzeugt immer denselben Deal.

## Tests

Es gibt keine npm-Runtime-Abhängigkeiten. Für Node-Checks wird Node.js 20 oder neuer benötigt:

```bash
npm test
npm run check
```

`npm run check` prüft Syntax, Registry-/PWA-Verträge und alle Spielregressionen.

Die echten Browser-Smokes benötigen Node.js 22+ und Chrome/Chromium (`CHROME_BIN` kann gesetzt werden):

```bash
npm run smoke
```

Dabei werden unter anderem geprüft:

- Welcome-Page, Manifest und Service-Worker-Bereitschaft online/offline
- Anzahl und Darstellung der Registry-Spielkarten auf 360×640
- gemeinsame Navigation aller registrierten kanonischen Spielseiten auf 360×640
- Touchzielgrößen, sichtbarer Tastaturfokus und Offline-Aktivierung per Enter
- Deployment unter einem Webroot-Prefix inklusive Offline-Navigation
- 4096- und Sudoku-Persistenz
- Dr.-Tromu-Mobile-Fit, Offline-Reload und Storage-Recovery
- Super-Tromu-Land-Kampagne, Power-ups, Auto-Scroll, Touch/Tastatur und Offline-Reload
- Tromu-Snake-Mobile-Fit, Classic/Speed/Maze, Touch/Tastatur, Highscore-Recovery und Offline-Reload
- Tromu-Sokoban-Mobile-Fit, Tastatur/Touch, Mehrfach-Undo, Progress/Bestwerte, Storage-Recovery und Offline-Reload
- Tromu-Breakout-Mobile-Fit, Tastatur/Touch-Drag, Pause, Bestwert-Recovery und Offline-Reload
- Tromu-Minesweeper-Mobile-Fit, sicherer erster Touch, Flag-Modus, Tastaturfokus, Bestzeit-Recovery und Offline-Reload
- Tromu-FreeCell-Mobile-Fit, Touch/Maus/Tastatur, Mehrfach-Undo, reproduzierbare Fortsetzung, Storage-Recovery und Offline-Reload

In GitHub Actions sind `npm run check` und `npm run smoke` die Pflichtpfade.

## Architektur

### Gemeinsame Spielewelt-Schicht

- `games.js` – zentrale Registry für Spielmetadaten, Routen, Legacy-Aliase und Offline-Shell-Verträge
- `game-nav.js` – gemeinsame, aus der Registry erzeugte Navigation
- `index.html` / `home.js` / `home.css` – Welcome-Page und dynamische Spielkarten
- `sw.js` / `manifest.webmanifest` / Icons – gemeinsame Offline-/Installationsschicht
- `games.test.js` / `pwa.test.js` – Registry-, Webroot- und Precache-Verträge
- `browser-smoke.mjs` – Welcome-/Mehrseiten-Acceptance
- `welcome-mobile-smoke.mjs` – echter 360×640-Audit der Welcome-Page
- `game-navigation-smoke.mjs` – registry-basierte Navigation, Touchziele, Fokus und Offline-Enter-Zyklus
- `subpath-navigation-smoke.mjs` – Webroot-Prefix-Navigation online/offline
- `offline-routing-smoke.mjs` – Offline-No-Slash-Acceptance für kritische Spielrouten

### Spiele

- 4096: `4096/index.html` plus Root-Module `game.js`, `app.js`, `storage.js`, `connectivity.js`, `dialog.js`, `pointer.js`, `styles.css`
- Sudoku: `sudoku/`
- Dr. Tromu: `dr-tromu/`
- Super Tromu Land: `super-tromu-land/`
- Tromu Snake: `snake/` mit purem `game.js`, fehlertolerantem `storage.js`, Browserzustand in `app.js` und eigenem Mobile-/Offline-Smoke
- Tromu Sokoban: `sokoban/` mit zehn Levels in `levels.js`, purem `game.js`, validiertem `storage.js`, Browserzustand in `app.js` und eigenem Mobile-/Offline-Smoke
- Tromu Breakout: `breakout/` mit fünf Levels in `levels.js`, purer Kollision/Physik in `game.js`, robustem Bestwert-Storage, Canvas-Browserzustand und eigenem Mobile-/Offline-Smoke
- Tromu Minesweeper: `minesweeper/` mit seed-deterministischer Platzierung, puren Reveal-/Flag-Regeln, robusten Bestzeiten, zugänglichem DOM-Raster und eigenem Mobile-/Offline-Smoke
- Tromu FreeCell: `freecell/` mit seed-deterministischem Deal, puren Zug-/Supermove-/Undo-Regeln, validierter Fortsetzung/Statistik, zugänglicher DOM-Kartendarstellung und eigenem Mobile-/Offline-Smoke

Jedes Spiel bleibt ohne Bundler direkt aus seinem Webroot-Pfad ausführbar. Spiel-spezifische Regeln und Browser-Smokes bleiben beim jeweiligen Spiel; nur katalogweite Metadaten und Navigation liegen zentral.

## Deployment

`main` wird direkt als Webroot ausgeliefert. Es gibt kein `dist/` und keinen Buildschritt. Der Webserver muss registrierte Verzeichnis-URLs auf deren `index.html` auflösen und korrekte MIME-Typen liefern. Außerhalb von `localhost` ist HTTPS für Service Worker und Installation erforderlich.
