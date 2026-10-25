# Tromu Spielewelt

Dieses Repository ist direkt der Webroot für die **Tromu Spielewelt**: eine lokale, installierbare und offlinefähige Browser-Spielesammlung ohne Runtime-Abhängigkeiten, Anmeldung oder Tracker.

Aktuell registriert sind fünfzehn kanonische Spiele:

- **4096** unter `/4096/` – Zahlen zusammenschieben und 4096 erreichen.
- **Sudoku** unter `/sudoku/` – mobile-first 9×9-Sudoku mit Notizen, Undo, Timer und lokaler Fortsetzung.
- **Dr. Tromu** unter `/dr-tromu/` – Kapselpuzzle mit Viren, Vierer-Matches, Kaskaden und lokaler Fortsetzung.
- **Super Tromu Land** unter `/super-tromu-land/` – Jump ’n’ Run mit vier Welten und zwölf eigenen Stages.
- **Super Tromu Land 2** unter `/super-tromu-land-2/` – eigenständiges Top-down-Handheld-Adventure mit Klingen-Kampf und kompletter Morgenkern-Einführungsquest.
- **Tromu Snake** unter `/snake/` – Score-Arcade mit Classic-, Speed- und Maze-Modus.
- **Tromu Sokoban** unter `/sokoban/` – zehn Push-Puzzle mit Mehrfach-Undo und lokalen Bestwerten.
- **Tromu Breakout** unter `/breakout/` – fünf Arcade-Level mit Paddle, Power-ups und lokalem Bestwert.
- **Tromu Minesweeper** unter `/minesweeper/` – zugängliches Minenrätsel mit sicherem ersten Reveal und lokalen Bestzeiten.
- **Tromu FreeCell** unter `/freecell/` – Solitaire mit reproduzierbaren Deals, Mehrfach-Undo und lokaler Fortsetzung.
- **Tromu Maze-Chase** unter `/maze-chase/` – Labyrinth-Arcade mit Sammelzielen und deterministischen Gegnerprofilen.
- **Tromu Space Shooter** unter `/space-shooter/` – Top-down-Arcade mit deterministischen Wellen und lokalen Power-ups.
- **Tromu Duell** unter `/duell/` – lokale Hot-Seat-Partien in Vier gewinnt und Reversi.
- **TROMU // ECHOLOOP** unter `/echoloop/` – deterministische Zeitloop-Puzzle mit aufgezeichneten eigenen Echos.
- **TROMU // STRATA** unter `/strata/` – Thinky-Puzzle aus zwei verschiebbaren Realitätsschichten und Paritätsmaterie.

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
- Beschreibungstext für die Welcome-Page
- optionale `legacyRoutes`
- `shell`: Dateien und Routen des Offline-Vertrags

`home.js` rendert die Spielkarten direkt aus `GAMES`. `game-nav.js` erzeugt auf jeder kanonischen Spielseite den gemeinsamen Rückweg zur Spielewelt und bindet die lokale Mantine-kompatible Designschicht ein. Registry-Routen werden relativ zum tatsächlichen Webroot aufgelöst, damit die Spielewelt sowohl am Domain-Root als auch unter einem Deployment-Prefix funktioniert.

### Neues Spiel hinzufügen

1. Spielverzeichnis mit lokalem `index.html`, CSS und JavaScript anlegen.
2. Einen Eintrag in `games.js` ergänzen und dessen `shell` vollständig deklarieren.
3. Auf der Spielseite `data-game-id="…"`, einen `data-game-nav`-Container und `../game-nav.js` verwenden.
4. Die Registry-Shell in `APP_SHELL` von `sw.js` aufnehmen und die Cache-Version erhöhen.
5. Pure Spielregeln mit Node-Tests und Browser-/Mobile-/Offline-Verhalten mit einem passenden Smoke absichern.

`games.test.js` und `pwa.test.js` prüfen IDs, Routen, Registry-Navigation, vorhandene Shell-Dateien und den Service-Worker-Precache. `game-navigation-smoke.mjs` iteriert die Registry statt eine feste Spielanzahl anzunehmen.

## PWA / Offline

`manifest.webmanifest` beschreibt die installierbare **Tromu Spielewelt** als Root-PWA. `sw.js` precacht Welcome-Page, Registry-/Navigationsmodule, die registrierten Spiel-Shells, die gemeinsame Designschicht und die unterstützten Legacy-Aliase. Die aktuelle Shell-Version ist **`4096-shell-v29`**.

Navigationen werden network-first geladen und erfolgreiche Antworten aktualisieren den Cache. Offline wird zuerst die passende gecachte Navigation verwendet; extensionlose bekannte Unterseiten können auf ihre gecachte Slash-Route umgeleitet werden. Der Root-Fallback bleibt die Welcome-Page.

Für einen manuellen Offline-Smoke:

1. `/` online laden und auf `Online · offline bereit` warten.
2. Die kanonischen Spielpfade einmal öffnen.
3. Netzwerk in DevTools auf Offline setzen und neu laden.
4. Prüfen, dass die aktive Oberfläche mit `Offline · spielbereit` startet.
5. Offline über den gemeinsamen Rückweg wieder zur Spielewelt navigieren.

## Steuerung und Spielstand

### 4096

Pfeiltasten oder WASD, auf Touch wischen. `Strg/⌘+Z` macht einen Undo-Schritt. Spielstand, Undo-Snapshot und Bestwert werden lokal gespeichert.

### Sudoku

Feld wählen und Zahl 1–9 eingeben. Pfeiltasten navigieren, `N` schaltet Notizen um, `Entf`/`Backspace` löscht und `Strg/⌘+Z` macht rückgängig. Aufgabe, Einträge, Notizen, Fehlerzahl und Timer werden lokal fortgesetzt.

### Dr. Tromu

Pfeile oder `A`/`D` bewegen die Kapsel, Pfeil hoch oder `W` dreht sie, Pfeil runter oder `S` beschleunigt und Leertaste/Enter legt sofort ab. Touch nutzt große Buttons. Spielzustand und nächste Kapsel werden lokal gespeichert und beschädigter Storage wird sicher verworfen.

### Super Tromu Land

Pfeile oder `A`/`D` bewegen, Pfeil hoch/`W`/Leertaste springt, `X` oder `K` wirft den Blumenball, `R` startet neu. Die Kampagne umfasst vier Welten mit zwölf Stages inklusive Auto-Scroll-Finalen.

### Super Tromu Land 2

Super Tromu Land 2 ist ein separates Top-down-Adventure-System mit eigener Welt und eigener Vierfarb-Handheld-Pixelgrafik. Es übernimmt keine Karten, Figuren, Namen, Dialoge oder Assets anderer Spiele.

- Pfeiltasten oder WASD bewegen Tromu rasterbasiert in vier Richtungen.
- `E`/Enter beziehungsweise **A · Aktion** interagiert mit Figuren, Truhen, Toren, Runen und Altären.
- `X`/`K`/Leertaste beziehungsweise **B · Klinge** greift nach Erhalt der Trainingsklinge in Blickrichtung an.
- `N` beziehungsweise **Neu** startet ein frisches Abenteuer.
- Touch besitzt ein großes D-Pad sowie getrennte Aktion-/Klingen-Tasten.

Die vollständige Einführungsquest **Der Morgenkern** führt durch alle Kernmechaniken: in Lindenquell mit Hüterin Mira sprechen → Trainingsklinge aus der Werkstatt holen → am Moosweg drei Blattlinge besiegen → bei Pfadwächter Karo das Hain-Siegel erhalten → den Tauhain-Schrein öffnen → drei Runen aktivieren → den Schreinwächter besiegen → Morgenkern bergen → zu Mira zurückkehren und die Quest abschließen.

Questphase, Gebiet/Position, Blickrichtung, Herzen, Inventar, Gegnerzustände, aktivierte Runen und der Morgenkern werden lokal gespeichert. Beschädigter oder gesperrter Storage fällt sicher auf ein neues Abenteuer zurück.

### Tromu Snake

Pfeiltasten/WASD oder Touch-D-Pad. `P` pausiert, `R` startet neu. Classic, Speed und Maze besitzen getrennte lokale Bestwerte.

### Tromu Sokoban

Pfeiltasten/WASD oder Touch-D-Pad. `Strg/⌘+Z` macht beliebig viele Züge rückgängig, `R` startet das Level neu. Fortschritt und Bestwerte für Schübe/Züge werden lokal gespeichert.

### Tromu Breakout

Pfeile oder `A`/`D` bewegen das Paddle, Leertaste startet, `P` pausiert, `R` startet neu. Touch unterstützt große Ziele und direktes Ziehen. Der Highscore wird lokal gespeichert.

### Tromu Minesweeper

Tap/Enter deckt auf, `F` schaltet Flaggen, Pfeiltasten bewegen den roving Fokus und `R` startet neu. Der erste Reveal ist sicher; Bestzeiten werden pro Schwierigkeitsstufe gespeichert.

### Tromu FreeCell

Karten/Folgen auswählen und ein gültiges Ziel wählen; Touch, Maus und Tastatur sind vollständig unterstützt. `Strg/⌘+Z` hat Mehrfach-Undo, `N` lädt den nächsten Deal und `R` denselben Deal neu. Deal und Statistik werden robust lokal gespeichert.

### Tromu Maze-Chase

Pfeiltasten/WASD oder Touch-D-Pad. `P` pausiert, `R` startet neu. Richtungs-Buffering, deterministische Gegnerprofile und Power-Zellen bilden den Arcade-Loop; der Bestwert bleibt lokal.

### Tromu Space Shooter

Pfeiltasten/WASD beziehungsweise D-Pad/Drag bewegen, Leertaste oder **FEUER** schießt, `P` pausiert und `R` startet neu. Drei deterministische Wellen und drei Power-ups werden durch robusten lokalen Highscore ergänzt.

### Tromu Duell

Lokaler Hot-Seat für zwei Personen. Vier gewinnt und Reversi unterstützen Touch/Maus sowie Tastatur mit roving Fokus. Siege und Remis werden pro Modus lokal gezählt.

### TROMU // ECHOLOOP

Pfeiltasten/WASD wählen die Bewegung für den nächsten Tick; Leertaste wartet, `P` pausiert und `R` startet neu. Jeder feste Loop wird aufgezeichnet und in folgenden Loops als physisches Echo deterministisch wiederholt. Freischaltung und beste Loop-Zahl bleiben lokal.

### TROMU // STRATA

Die resultierende Welt folgt einer einzigen Regel: **Materie existiert genau dort, wo eine ungerade Zahl von Schichten belegt ist.** Zwei überlagerte Wände löschen sich daher aus.

- Pfeiltasten/WASD bewegen die Figur.
- `1`/`2` wählen Schicht A oder B.
- `Shift` + Pfeiltaste verschiebt die aktive komplette Schicht zyklisch um ein Rasterfeld.
- Touch besitzt getrennte D-Pads für Figur und Schicht, damit beide Aktionen nicht verwechselt werden.
- `Strg/⌘+Z` macht unbegrenzt rückgängig; `Strg/⌘+Shift+Z` wiederholt.
- `R` beziehungsweise **Restart** startet das aktuelle Puzzle sofort neu.
- Alle zehn MVP-Puzzle sind frei anwählbar; gelöste Puzzle sowie beste Aktions- und Shift-Werte werden lokal gespeichert.

Schicht A wird zusätzlich durch Linienmuster/`╱`, Schicht B durch Punktmuster/`•` dargestellt; Überlagerungen sind deshalb nicht ausschließlich farbcodiert. Das MVP enthält bewusst keine Rotation, Fixpunkte, dritte Schicht oder Meta-Progression.

## Tests

Es gibt keine npm-Runtime-Abhängigkeiten. Für Node-Checks wird Node.js 20 oder neuer benötigt:

```bash
npm test
npm run check
```

`npm run check` prüft Syntax, Registry-/PWA-Verträge und alle Spielregressionen. Die echten Browser-Smokes benötigen Node.js 22+ und Chrome/Chromium (`CHROME_BIN` kann gesetzt werden):

```bash
npm run smoke
```

Unter anderem werden geprüft:

- Welcome-Page, Manifest und Service-Worker online/offline
- Registry-Spielkarten, gemeinsame Navigation und Deployment unter Webroot-Prefix
- 360×640-Mobile-Fit, Touchziele und Tastaturpfade der Spiele
- Persistenz-/Recovery-Pfade und Offline-Reloads
- Super-Tromu-Land-2-Touch-/Tastatursteuerung, Queststart, Klingenfund, vollständiger Morgenkern-Questbogen, Reload-Fortsetzung, Storage-Recovery und Offline-Reload
- ECHOLOOPs tickgenaue Echo-Replays
- STRATAs 7×7-Komposition, getrennte Touch-Steuerung, Layer-Shift, Spielerbewegung, Undo/Redo, Lösung, Storage-Recovery und Offline-Reload
- STRATA-Node-Regressionen für Parität 0–4, deterministische Referenzlösungen aller zehn Puzzle, Rand-Wrap, Open/Close-Konsequenz und exakte History-Rekonstruktion

In GitHub Actions sind `npm run check` und `npm run smoke` die Pflichtpfade.

## Architektur

### Gemeinsame Spielewelt-Schicht

- `games.js` – zentrale Registry für Spielmetadaten, Routen, Legacy-Aliase und Offline-Shell-Verträge
- `game-nav.js` / `mantine-theme.css` – gemeinsame Navigation und lokale UI-Grundschicht
- `index.html` / `home.js` / `home.css` – Welcome-Page und dynamische Spielkarten
- `sw.js` / `manifest.webmanifest` / Icons – gemeinsame Offline-/Installationsschicht
- `games.test.js` / `pwa.test.js` – Registry-, Webroot- und Precache-Verträge
- `browser-smoke.mjs`, `welcome-mobile-smoke.mjs`, `game-navigation-smoke.mjs`, `subpath-navigation-smoke.mjs`, `offline-routing-smoke.mjs` – katalogweite Browser-Acceptance

### Spiele

Jedes Spiel bleibt ohne Bundler direkt aus seinem Webroot-Pfad ausführbar. Spiel-spezifische Regeln, Persistenz und Browser-Smokes bleiben beim jeweiligen Spiel; nur katalogweite Metadaten, Navigation, Designbasis und Offline-Schicht liegen zentral.

Super Tromu Land 2 folgt diesem Muster als eigenständige Adventure-Engine:

- `super-tromu-land-2/world.js` – drei verbundene 16×12-Gebiete mit eigenen NPCs, Objekten, Gegnern, Portalen und Hindernissen
- `super-tromu-land-2/game.js` – pure Bewegung, Kollisionen, Interaktion, Kampf, Herzen, Questgates und deterministische Gegnerzüge
- `super-tromu-land-2/storage.js` – fehlertolerante lokale Fortsetzung des gesamten Introquest-Zustands
- `super-tromu-land-2/app.js` – 256×192-Canvas-Rendering, Touch-/Tastatursteuerung, HUD und Service-Worker-Anbindung
- `super-tromu-land-2/browser-smoke.mjs` – echte 360×640-, Quest-, Persistenz- und Offline-Acceptance

STRATA folgt demselben Muster:

- `strata/levels.js` – zehn handgebaute Puzzle samt Lernziel und verifizierter Referenzlösung
- `strata/game.js` – pure Paritätskomposition, Spielerbewegung, Schichtverschiebung und Undo/Redo
- `strata/storage.js` – fehlertoleranter lokaler Fortschritt und Bestwerte
- `strata/app.js` – DOM-Rendering, Touch-/Tastatursteuerung, Status und Service-Worker-Anbindung
- `strata/browser-smoke.mjs` – echte 360×640-/Offline-Acceptance

## Deployment

`main` wird direkt als Webroot ausgeliefert. Es gibt kein `dist/` und keinen Buildschritt. Der Webserver muss registrierte Verzeichnis-URLs auf deren `index.html` auflösen und korrekte MIME-Typen liefern. Außerhalb von `localhost` ist HTTPS für Service Worker und Installation erforderlich.
