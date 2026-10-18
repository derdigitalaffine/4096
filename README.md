# 4096 + Sudoku + Dr. Mario

Dieses Repository ist direkt der Webroot für drei lokale, offlinefähige Browser-Spiele ohne Runtime-Dependencies, Anmeldung oder Tracker:

- **4096** unter `/` – gleiche Zahlen zusammenschieben und 4096 erreichen.
- **Sudoku** unter `/sudoku/` – mobile-first 9×9-Sudoku mit Leicht/Mittel/Schwer, Notizen, Undo, Timer und lokaler Fortsetzung.
- **Dr. Mario** unter `/dr-mario/` – mobile-first Kapselpuzzle mit drei Farben, Viren, Vierer-Matches, Kaskaden und lokaler Fortsetzung.

## Lokal starten

Für lokale Entwicklung genügt ein statischer Server, zum Beispiel:

```bash
python3 -m http.server 8080
```

Danach `http://localhost:8080` öffnen. `localhost` ist ein sicherer Browserkontext und erlaubt Service Worker/PWA-Tests. Von 4096 führen die Buttons **Sudoku** und **Dr. Mario** zu den Unterseiten; beide Spielseiten bieten Navigation zurück in den gemeinsamen Webroot.

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

Dr. Mario speichert Flasche, aktive und nächste Kapsel, Score und Viruszahl lokal. Beschädigter Storage wird verworfen und durch eine neue Runde ersetzt.

## Tests

Es gibt keine npm-Runtime-Dependencies. Für die normalen Checks wird Node.js 20 oder neuer benötigt.

```bash
npm test
npm run check
```

`npm run check` prüft die Syntax aller drei Spiele sowie alle Node-Regressionen. Dazu gehören unter anderem 4096-Move-/Merge-/Win-/Persistenzregeln, Sudoku-Einheiten/Kandidaten/Konflikte, Dr.-Mario-Matches/Rotation/Schwerkraft/Sieg, Accessibility-/Responsive-Verträge und Service-Worker-/Webroot-Verträge.

Zusätzlich gibt es echte Browser-Smoke-Tests. Dafür werden Node.js 22+ und ein lokales Chrome/Chromium benötigt (`CHROME_BIN` kann explizit gesetzt werden):

```bash
npm run smoke
```

Der Pflicht-Smoke startet lokale Webroots und prüft in Headless Chrome reale Browserpfade. Der gemeinsame Mehrseiten-Smoke deckt 4096 online bis Service-Worker-Bereitschaft und Manifest-Parsing, Sudoku online mit Eingabe/Persistenz, anschließend echten Sudoku-Offline-Reload, eine Offline-Query-Navigation und die Offline-Navigation zurück zu 4096 ab. Zusätzlich lädt ein fokussierter Dr.-Mario-Smoke `/dr-mario/` in echtem Chrome und bestätigt Service-Worker-Bereitschaft sowie die vollständig gerenderte 8×16-Flasche mit 128 Zellen. In GitHub Actions laufen `npm run check` und `npm run smoke` als Pflichtpfade.

## PWA / Offline

`manifest.webmanifest` beschreibt die installierbare Root-PWA. `sw.js` precacht die kritischen Dateien **aller drei** Spiele. Navigationen werden pro Request getrennt gecacht, damit Unterseiten niemals den Root-Fallback von 4096 überschreiben. Solange Netzwerk verfügbar ist, werden Navigation und lokale Assets network-first geladen und erfolgreiche Antworten aktualisieren ihren Cacheeintrag; bei Netzfehlern oder fehlerhaften Serverantworten fällt die App auf den passenden Cache zurück.

Die Connection-Zeile unterscheidet Vorbereitung, echte Offline-Bereitschaft und Fehler. Erst `Online · offline bereit` bestätigt, dass der Service Worker bereit ist; offline bestätigt `Offline · spielbereit`, dass ein Reload aus dem lokalen Shell möglich ist.

Für einen manuellen Mehrseiten-Offline-Smoke:

1. Root online laden und auf `Online · offline bereit` warten.
2. Sudoku und Dr. Mario öffnen und prüfen, dass auch dort `Online · offline bereit` steht.
3. Netzwerk in DevTools auf Offline setzen und die aktive Unterseite neu laden.
4. Prüfen, dass deren vollständige Spieloberfläche mit `Offline · spielbereit` startet.
5. Offline zwischen `/`, `/sudoku/` und `/dr-mario/` navigieren.

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
- `dr-mario/browser-smoke.mjs` – fokussierter echter Chrome-Smoke für Rendering und Service-Worker-Bereitschaft

### Gemeinsame PWA-/Qualitätsschicht

- `sw.js` / `manifest.webmanifest` / Icons – gemeinsame Offline-/Installationsschicht
- `browser-smoke.mjs` – dependency-freier Headless-Chrome-Acceptance-Smoke via DevTools-Protokoll
- `*.test.js` – dependency-freie Node-Regressionen und statische Webroot-Verträge

## Deployment

`main` wird direkt als Webroot ausgeliefert. Es gibt keinen Buildschritt und kein `dist/`. Der Webserver muss Verzeichnis-URLs wie `/sudoku/` und `/dr-mario/` auf deren `index.html` auflösen und korrekte MIME-Typen liefern. Außerhalb von `localhost` ist HTTPS für Service Worker und Installation erforderlich.
