# Tromu Spielewelt

Dieses Repository ist direkt der Webroot für die **Tromu Spielewelt**: eine lokale, installierbare und offlinefähige PWA mit vier Browser-Spielen – ohne Runtime-Abhängigkeiten, Anmeldung oder Tracker.

- **Welcome-Page** unter `/` – Pixel-Game-Landingpage mit Spieleauswahl sowie Android-/iOS-Installationshinweisen.
- **4096** unter `/4096/` – gleiche Zahlen zusammenschieben und 4096 erreichen.
- **Sudoku** unter `/sudoku/` – mobile-first 9×9-Sudoku mit Leicht/Mittel/Schwer, Notizen, Undo, Timer und lokaler Fortsetzung.
- **Dr. Mario** unter `/dr-mario/` – mobile-first Kapselpuzzle mit drei Farben, Viren, Vierer-Matches, Kaskaden und lokaler Fortsetzung.
- **Super Mario Land** unter `/super-mario-land/` – eigenständige Browser-Hommage als seitlich scrollendes Jump ’n’ Run mit eigener Canvas-Pixelgrafik, vier Welten und zwölf neuen Stages von `1-1` bis `4-3` sowie Pilz-/Blumen-Power-ups aus `?`-Blöcken.

Alle Laufzeitressourcen liegen im Repository. Es werden keine fremden Spielgrafiken, Tracker oder externen Runtime-Assets geladen.

## Lokal starten

Für lokale Entwicklung genügt ein statischer Server, zum Beispiel:

```bash
python3 -m http.server 8080
```

Danach `http://localhost:8080` öffnen. `localhost` ist ein sicherer Browserkontext und erlaubt Service-Worker-/PWA-Tests. Die Welcome-Page verbindet alle vier Spielpfade innerhalb desselben Webroots.

## PWA installieren

Die Root-Seite erklärt die Installation direkt im Produkt:

- **Android / Chrome:** Browsermenü `⋮` öffnen und **App installieren** beziehungsweise **Zum Startbildschirm hinzufügen** wählen.
- **iOS / iPadOS / Safari:** **Teilen** öffnen, **Zum Home-Bildschirm** wählen und mit **Hinzufügen** bestätigen.

Wenn der Browser `beforeinstallprompt` unterstützt, bietet die Welcome-Page zusätzlich einen direkten Button **Spielewelt installieren** an. Nach vollständig aufgebautem App-Shell-Cache zeigt der Status `Online · offline bereit`; offline bestätigt `Offline · spielbereit` die lokale Startfähigkeit.

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

Dr. Mario speichert Flasche, aktive und nächste Kapsel, Punkte und Viruszahl lokal. Beschädigter oder inkompatibler Storage wird im echten Browser-Smoke geprüft, verworfen und durch eine neue valide Runde ersetzt. Auf kleinen Smartphone-Displays wird die spielbare Oberfläche in einen dynamischen Viewport verdichtet, damit Flasche und Touch-Steuerung ohne vertikalen Scroll-Zwang erreichbar bleiben.

### Super-Mario-Land-Steuerung und Kampagne

- Links/rechts: Pfeiltasten oder `A`/`D`
- Springen: Pfeil hoch, `W` oder Leertaste
- Blumenball: `X` oder `K`; auf Touch über die Taste **Ball**
- `R`: neue Runde
- Gegner von oben treffen, Münzen sammeln, `?`-Blöcke von unten aktivieren, Lücken überspringen und in jeder Stage die Fahne erreichen

Eine Runde startet mit drei Leben und umfasst **vier Welten mit je drei Stages**, linear von `1-1` bis `4-3`. Die Browserfassung übernimmt damit den Rhythmus einer 4×3-Kampagne, zeichnet aber **keine historischen Nintendo-Level nach**: Alle Plattformen, Röhren-/Blockpassagen, Gruben, Gegnerstaffelungen und Hintergründe sind neue lokale Geometrien.

Die Welten unterscheiden sich sichtbar und spielerisch:

- **Welt 1:** Wüste und Ruinen – `Dünenpfad`, `Pyramidenstufen`, `Tempeltor`.
- **Welt 2:** Küste und Strömung – `Küstenpfad`, `Riffbrücken`, `Strömungslauf`.
- **Welt 3:** Stein, Höhle und Festung – `Steinland`, `Höhlenstieg`, `Golemfestung`.
- **Welt 4:** Bambus, Berg und Himmel – `Bambushain`, `Bergtempel`, `Wolkensturm`.

Die jeweils dritte Stage ist dichter als Weltfinale gebaut. `2-3` und `4-3` sind besondere **Auto-Scroll-Stages**, die die Figur automatisch vorwärtstreiben und damit die Sonderlevel-Idee der Vorlage in die vorhandene Jump-’n’-Run-Engine übertragen, ohne deren Fahrzeug-Level zu kopieren.

Jede Stage enthält einen Pilz- und einen Blumen-`?`-Block. Der **Pilz** schützt vor dem nächsten Gegnertreffer, ohne ein Leben zu verlieren. Die **Blume** ist die stärkere Stufe und schaltet einen lokalen Ball-Angriff frei, der Gegner besiegen kann; ein Treffer stuft zunächst auf Pilz zurück. Beim Erreichen einer Fahne werden Punkte, verbleibende Leben und der aktuelle Power-up-Zustand in die nächste Stage übernommen. Bei Lebensverlust fällt die Figur auf den kleinen Zustand zurück. Erst das Ziel in `4-3` beendet die Gesamtrunde erfolgreich.

## Tests

Es gibt keine npm-Runtime-Abhängigkeiten. Für die normalen Checks wird Node.js 20 oder neuer benötigt.

```bash
npm test
npm run check
```

`npm run check` prüft die Syntax der Welcome-Page und aller vier Spiele sowie alle Node-Regressionen. Dazu gehören 4096-, Sudoku-, Dr.-Mario- und Super-Mario-Land-Regeln inklusive 4×3-Stage-Struktur, `?`-Block-Aktivierung, Pilzschutz, Blumenangriff, Auto-Scroll in `2-3`/`4-3` und Power-up-/Lebensübernahme über Weltgrenzen sowie Accessibility-, Responsive-, Service-Worker-, Storage-Recovery- und Webroot-Verträge.

Zusätzlich gibt es echte Browser-Smoke-Tests. Dafür werden Node.js 22+ und ein lokales Chrome/Chromium benötigt (`CHROME_BIN` kann explizit gesetzt werden):

```bash
npm run smoke
```

Der Pflicht-Smoke startet lokale Webroots und prüft reale Browserpfade in Headless Chrome:

- der gemeinsame Mehrseiten-Smoke lädt die Tromu-Welcome-Page online, bestätigt Service-Worker-Bereitschaft, Manifest und Installationshinweise, öffnet `/4096/`, prüft Sudoku-Eingabe/Persistenz und navigiert anschließend offline durch die gecachten Spielpfade;
- der Welcome-Mobile-Smoke prüft die neue Rootseite auf 360×640 ohne horizontalen Overflow und mit erreichbarer Spiele-/Installationssektion;
- der Navigations-Smoke prüft alle vier Spielseiten auf 360×640, Touchzielgrößen, Tab-Fokus und Offline-Aktivierung per Enter;
- der Dr.-Mario-Smoke prüft 360×640-Mobile-Fit, Service-Worker-Bereitschaft, Save-Restore nach echtem Offline-Reload und kanonische Unterseiten-Navigation;
- `dr-mario/storage-recovery-smoke.mjs` verifiziert in echtem Chrome, dass syntaktisch kaputtes und strukturell inkompatibles `localStorage` durch eine frische valide Runde ersetzt wird;
- der Super-Mario-Land-Smoke prüft 360×640 ohne Scroll-Zwang, das `1-1 · 1/12`-HUD, alle zwölf Stage-IDs, Weltübergänge, `2-3`/`4-3` als Auto-Scroll-Stages, Pilz-/Blumen-Regelpfade, Tastatureingabe und Offline-Reload.

In GitHub Actions laufen `npm run check` und `npm run smoke` als Pflichtpfade.

## PWA / Offline

`manifest.webmanifest` beschreibt die installierbare **Tromu Spielewelt** als Root-PWA. `sw.js` precacht die Welcome-Page, den 4096-Unterpfad und die kritischen Dateien aller vier Spiele. Die aktuelle Shell-Version ist `4096-shell-v15`, damit bestehende Installationen die neue Super-Mario-Land-Kampagne zuverlässig erhalten. Navigationen werden pro Request getrennt gecacht. Extensionlose Unterseiten-URLs werden offline nur dann auf die kanonische Slash-Route umgeleitet, wenn diese Route im Cache vorhanden ist.

Solange Netzwerk verfügbar ist, werden Navigation und lokale Assets network-first geladen und erfolgreiche Antworten aktualisieren ihren Cacheeintrag; bei Netzfehlern oder fehlerhaften Serverantworten fällt die App auf den passenden Cache zurück. Der Root-Fallback ist die Welcome-Page und nicht das 4096-Spielfeld.

Für einen manuellen Mehrseiten-Offline-Smoke:

1. `/` online laden und auf `Online · offline bereit` warten.
2. `/4096/`, `/sudoku/`, `/dr-mario/` und `/super-mario-land/` einmal online öffnen.
3. Netzwerk in DevTools auf Offline setzen und eine aktive Seite neu laden.
4. Prüfen, dass die jeweilige Oberfläche mit `Offline · spielbereit` startet.
5. Offline zwischen Welcome-Page und allen vier Spielpfaden navigieren.

## Architektur

### Tromu Welcome-Page

- `index.html` – Root-Landingpage mit Spieleauswahl und Android-/iOS-PWA-Hinweisen
- `home.css` – eigenständige responsive Pixel-Game-Ästhetik
- `home.js` – Installationsprompt, Service-Worker-Bereitschaft und Verbindungsstatus
- `home.test.js` – Landingpage-, Installations- und Pixel-Design-Verträge

### 4096

- `4096/index.html` – Spieloberfläche unter eigenem Unterpfad
- `game.js` – pure Spielregeln
- `storage.js` – validierte, fehlertolerante Local-Storage-Grenze
- `connectivity.js` – pure Ableitung des Online-/Offline-Status
- `dialog.js` – Fokus-Wrap-Regel für modale Endzustände
- `pointer.js` – Guards für Pointer-/Touch-Gesten
- `app.js` – Browserzustand, Rendering, Eingabe und gemeinsame Service-Worker-Anbindung
- `styles.css` – 4096-Spielgestaltung

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
- `dr-mario/browser-smoke.mjs` / `dr-mario/storage-recovery-smoke.mjs` – echte Chrome-Smokes für Mobile-Fit, Offline-/Save-Restore und kaputten Storage

### Super Mario Land

- `super-mario-land/game.js` – zwölf Stage-Definitionen in vier Welten plus pure Bewegungs-, Kollisions-, Lebens-, `?`-Block-, Pilz-/Blumen-, Projektil-, Auto-Scroll-, Stagewechsel- und Zielregeln
- `super-mario-land/app.js` – Canvas-Rendering für Weltmotive, Stages/Power-ups, Kamera, HUD, Touch/Tastatur, Bestwert und Offline-Status
- `super-mario-land/index.html` / `super-mario-land/styles.css` – mobile-first Spieloberfläche mit vier Touch-Aktionen
- `super-mario-land/*.test.js` – Kampagnenstruktur, Spielregeln, Power-ups, Weltübergänge und UI-/PWA-Verträge
- `super-mario-land/browser-smoke.mjs` – echter Chrome-Smoke für Mobile-Fit, 4×3-Kampagne, Power-ups, Welt-/Stage-Regelkette, Eingabe und Offline-Reload

### Gemeinsame PWA-/Qualitätsschicht

- `sw.js` / `manifest.webmanifest` / Icons – gemeinsame Offline-/Installationsschicht
- `browser-smoke.mjs` – dependency-freier Welcome-/Mehrseiten-Acceptance-Smoke via DevTools-Protokoll
- `welcome-mobile-smoke.mjs` – echter 360×640-Audit der Welcome-Page
- `offline-routing-smoke.mjs` – Offline-No-Slash-Acceptance für Spielrouten
- `game-navigation-smoke.mjs` – Vier-Spiel-Navigation, Touchziele, Fokus und Offline-Enter-Aktivierung
- `*.test.js` – dependency-freie Node-Regressionen und statische Webroot-Verträge

## Deployment

`main` wird direkt als Webroot ausgeliefert. Es gibt keinen Buildschritt und kein `dist/`. Der Webserver muss Verzeichnis-URLs wie `/4096/`, `/sudoku/`, `/dr-mario/` und `/super-mario-land/` auf deren `index.html` auflösen und korrekte MIME-Typen liefern. Außerhalb von `localhost` ist HTTPS für Service Worker und Installation erforderlich.
