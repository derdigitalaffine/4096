# 4096 + Sudoku + Dr. Mario + Super Mario Land

Dieses Repository ist direkt der Webroot für vier lokale, offlinefähige Browser-Spiele ohne Runtime-Abhängigkeiten, Anmeldung oder Tracker:

- **4096** unter `/` – gleiche Zahlen zusammenschieben und 4096 erreichen.
- **Sudoku** unter `/sudoku/` – mobile-first 9×9-Sudoku mit Leicht/Mittel/Schwer, Notizen, Undo, Timer und lokaler Fortsetzung.
- **Dr. Mario** unter `/dr-mario/` – mobile-first Kapselpuzzle mit drei Farben, Viren, Vierer-Matches, Kaskaden und lokaler Fortsetzung.
- **Super Mario Land** unter `/super-mario-land/` – eigenständige Browser-Hommage als seitlich scrollendes Jump ’n’ Run mit eigener Canvas-Pixelgrafik und drei aufeinanderfolgenden Leveln.

Alle Laufzeitressourcen liegen im Repository. Für Super Mario Land werden keine fremden Spielgrafiken oder externen Assets geladen.

## Lokal starten

Für lokale Entwicklung genügt ein statischer Server, zum Beispiel:

```bash
python3 -m http.server 8080
```

Danach `http://localhost:8080` öffnen. `localhost` ist ein sicherer Browserkontext und erlaubt Service-Worker-/PWA-Tests. Die Spielnavigation verbindet alle vier Pfade innerhalb desselben Webroots.

### 4096-Steuerung

- Desktop: Pfeiltasten oder WASD
- Touch: auf dem Spielfeld wischen
- Rückgängig: Button oder `Strg/⌘+Z`; verfügbar ist genau der letzte gültige Zug
- `Neues Spiel` startet jederzeit eine frische Runde

Spielstand, letzter Undo-Snapshot und Bestwert werden lokal gespeichert, wenn Browser-Storage verfügbar ist.

### Sudoku-Steuerung

- Touch/Maus: Feld wählen, danach eine Zahl 1–9 tippen
- Tastatur: Pfeiltasten zum Navigieren, `1`–`9` zum Eintragen
- `N`: Notizenmodus umschalten
- `Entf`/`Backspace`: aktuelles Feld leeren
- `Strg/⌘+Z`: letzte Änderung rückgängig machen
- Schwierigkeitsstufen: Leicht, Mittel, Schwer; je zwei geprüfte Aufgaben

Sudoku speichert Aufgabe, Einträge, Notizen, Auswahl, Fehlerzahl und Timer lokal und stellt einen gültigen Spielstand nach Reload wieder her. Beschädigter oder nicht kompatibler Storage fällt auf eine frische Aufgabe zurück.

### Dr.-Mario-Steuerung

- Pfeil links/rechts oder `A`/`D`: Kapsel bewegen
- Pfeil hoch oder `W`: Kapsel drehen
- Pfeil runter oder `S`: schneller fallen
- `Leertaste` oder `Enter`: Kapsel sofort ablegen
- Touch: dieselben Aktionen über die großen Steuerbuttons
- Vier oder mehr gleichfarbige Felder horizontal oder vertikal werden entfernt; alle Viren müssen verschwinden

Dr. Mario speichert Flasche, aktive und nächste Kapsel, Punkte und Viruszahl lokal. Beschädigter Storage wird verworfen und durch eine neue Runde ersetzt. Auf kleinen Smartphone-Displays wird die spielbare Oberfläche in einen dynamischen Viewport verdichtet, damit Flasche und Touch-Steuerung ohne vertikalen Scroll-Zwang erreichbar bleiben.

### Super-Mario-Land-Steuerung

- Links/rechts: Pfeiltasten oder `A`/`D`
- Springen: Pfeil hoch, `W` oder Leertaste
- `R`: neue Runde
- Touch: separate Tasten für links, rechts und springen
- Gegner von oben treffen, Münzen sammeln, Lücken überspringen und in jedem Level die Fahne erreichen

Eine Runde startet mit drei Leben und umfasst **drei unterschiedliche Level**: `Grüner Pfad`, `Höhenweg` und `Festungslauf`. Jedes Level besitzt eine eigene Plattform-, Lücken-, Münz- und Gegneranordnung. Beim Erreichen der Fahne werden Punkte und verbleibende Leben ins nächste Level übernommen; erst die Fahne im dritten Level beendet die Gesamtrunde erfolgreich. Das HUD zeigt jederzeit `Level x/3` und den Fortschritt im aktuellen Abschnitt. Münzen und besiegte Gegner erhöhen den Punktestand; der beste Punktestand wird lokal gespeichert. Die Spielfigur, Gegner und Landschaft werden zur Laufzeit mit Canvas-Geometrie gezeichnet.

## Tests

Es gibt keine npm-Runtime-Abhängigkeiten. Für die normalen Checks wird Node.js 20 oder neuer benötigt.

```bash
npm test
npm run check
```

`npm run check` prüft die Syntax aller vier Spiele sowie alle Node-Regressionen. Dazu gehören unter anderem 4096-Move-/Merge-/Win-/Persistenzregeln, Sudoku-Einheiten/Kandidaten/Konflikte, Dr.-Mario-Matches/Rotation/Schwerkraft/Sieg, Super-Mario-Land-Bewegung/Sprung/Kollision/Münzen/Gegner sowie Mehrlevel-Übergänge, Zustandsübernahme und finaler Sieg. Hinzu kommen Accessibility-, Responsive-, Service-Worker- und Webroot-Verträge.

Zusätzlich gibt es echte Browser-Smoke-Tests. Dafür werden Node.js 22+ und ein lokales Chrome/Chromium benötigt (`CHROME_BIN` kann explizit gesetzt werden):

```bash
npm run smoke
```

Der Pflicht-Smoke startet lokale Webroots und prüft reale Browserpfade in Headless Chrome:

- der gemeinsame Mehrseiten-Smoke deckt 4096 online bis Service-Worker-Bereitschaft und Manifest-Parsing, Sudoku-Eingabe/Persistenz, echten Sudoku-Offline-Reload und Offline-Navigation zurück zu 4096 ab;
- der Dr.-Mario-Smoke prüft einen 360×640-Mobile-Viewport ohne Scroll-Zwang, Service-Worker-Bereitschaft, die vollständige 8×16-Flasche, Save-Restore nach echtem Offline-Reload und kanonische Unterseiten-Navigation;
- der Super-Mario-Land-Smoke lädt den Pfad auf 360×640, bestätigt die sichtbare `1/3`-Levelanzeige, führt die Regelkette von Level 1 über Level 2 bis zum finalen Sieg in Level 3 im Browser aus, bewegt die Figur per Tastatureingabe und verifiziert anschließend einen echten Offline-Reload unter Service-Worker-Kontrolle.

In GitHub Actions laufen `npm run check` und `npm run smoke` als Pflichtpfade.

## PWA / Offline

`manifest.webmanifest` beschreibt die installierbare Root-PWA. `sw.js` precacht die kritischen Dateien **aller vier** Spiele. Navigationen werden pro Request getrennt gecacht, damit Unterseiten niemals den Root-Fallback von 4096 überschreiben. Extensionlose Unterseiten-URLs werden offline nur dann auf die kanonische Slash-Route umgeleitet, wenn diese Route im Cache vorhanden ist. Solange Netzwerk verfügbar ist, werden Navigation und lokale Assets network-first geladen und erfolgreiche Antworten aktualisieren ihren Cacheeintrag; bei Netzfehlern oder fehlerhaften Serverantworten fällt die App auf den passenden Cache zurück.

Die Verbindungszeile unterscheidet Vorbereitung, echte Offline-Bereitschaft und Fehler. Erst `Online · offline bereit` bestätigt, dass der Service Worker bereit ist; offline bestätigt `Offline · spielbereit`, dass ein Reload aus der lokalen Shell möglich ist.

Für einen manuellen Mehrseiten-Offline-Smoke:

1. Root online laden und auf `Online · offline bereit` warten.
2. Sudoku, Dr. Mario und Super Mario Land einmal online öffnen und jeweils die Offline-Bereitschaft abwarten.
3. Netzwerk in DevTools auf Offline setzen und die aktive Unterseite neu laden.
4. Prüfen, dass deren vollständige Spieloberfläche mit `Offline · spielbereit` startet.
5. Offline zwischen `/`, `/sudoku/`, `/dr-mario/` und `/super-mario-land/` navigieren.

## Architektur

### 4096

- `game.js` – pure Spielregeln
- `storage.js` – validierte, fehlertolerante Local-Storage-Grenze
- `connectivity.js` – pure Ableitung des Online-/Offline-Status
- `dialog.js` – Fokus-Wrap-Regel für modale Endzustände
- `pointer.js` – Guards für Pointer-/Touch-Gesten
- `app.js` – Browserzustand, Rendering und Eingabe
- `index.html` / `styles.css` – Root-Oberfläche

### Sudoku

- `sudoku/game.js` – pure Sudoku-Regeln, sechs geprüfte Aufgaben und Hilfsfunktionen
- `sudoku/app.js` – Browserzustand, Persistenz, Notizen, Undo, Timer, Keyboard/Touch
- `sudoku/index.html` / `sudoku/styles.css` – mobile-first Oberfläche und semantisches 9×9-Grid
- `sudoku/*.test.js` – Aufgaben-Eindeutigkeit, Regel- und UI-Verträge

### Dr. Mario

- `dr-mario/game.js` – pure Kapsel-, Match-, Virus-, Schwerkraft- und Sieglogik
- `dr-mario/app.js` – Browserzustand, Auto-Drop, Persistenz, Keyboard/Touch und Offline-Status
- `dr-mario/index.html` / `dr-mario/styles.css` – responsive 8×16-Flasche und mobile Steuerung
- `dr-mario/*.test.js` – Kernregeln sowie UI-/Offline-Verträge
- `dr-mario/browser-smoke.mjs` – echter Chrome-Smoke für Mobile-Fit, Rendering, Service-Worker-Bereitschaft, Offline-Reload und Save-Restore

### Super Mario Land

- `super-mario-land/game.js` – drei Leveldefinitionen plus pure Bewegungs-, Sprung-, Kollisions-, Münz-, Gegner-, Lebens-, Levelwechsel- und Zielregeln
- `super-mario-land/app.js` – Canvas-Rendering, levelabhängige Kamera/Hintergründe, HUD, Touch/Tastatur, Bestwert und Offline-Status
- `super-mario-land/index.html` / `super-mario-land/styles.css` – mobile-first Spieloberfläche mit eigener Pixelästhetik und kompakter Mehrlevel-Anzeige
- `super-mario-land/*.test.js` – Spielregeln, Levelübergänge und UI-/PWA-Verträge
- `super-mario-land/browser-smoke.mjs` – echter Chrome-Smoke für Mehrlevel-Regelkette, Eingabe und Offline-Reload

### Gemeinsame PWA-/Qualitätsschicht

- `sw.js` / `manifest.webmanifest` / Icons – gemeinsame Offline-/Installationsschicht
- `browser-smoke.mjs` – dependency-freier Mehrseiten-Acceptance-Smoke via DevTools-Protokoll
- `*.test.js` – dependency-freie Node-Regressionen und statische Webroot-Verträge

## Deployment

`main` wird direkt als Webroot ausgeliefert. Es gibt keinen Buildschritt und kein `dist/`. Der Webserver muss Verzeichnis-URLs wie `/sudoku/`, `/dr-mario/` und `/super-mario-land/` auf deren `index.html` auflösen und korrekte MIME-Typen liefern. Außerhalb von `localhost` ist HTTPS für Service Worker und Installation erforderlich.
