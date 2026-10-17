# 4096

Eine schlanke, installierbare und offlinefähige Browser-PWA: gleiche Zahlen zusammenschieben, kombinieren und **4096** erreichen.

## Spielen

Das Repository ist selbst der Webroot. Für lokale Entwicklung genügt ein statischer Server, zum Beispiel:

```bash
python3 -m http.server 8080
```

Danach `http://localhost:8080` öffnen. `localhost` ist ein sicherer Browserkontext und erlaubt damit auch Service Worker/PWA-Tests.

Steuerung:
- Desktop: Pfeiltasten oder WASD
- Touch: auf dem Spielfeld wischen
- Rückgängig: Button oder `Strg/⌘+Z`; verfügbar ist genau der letzte gültige Zug
- `Neues Spiel` startet jederzeit eine frische Runde

Spielstand, letzter Undo-Snapshot und Bestwert werden lokal im Browser gespeichert, wenn Storage verfügbar ist. Ist Browser-Storage gesperrt oder beschädigt, bleibt das Spiel mit einem frischen flüchtigen Zustand spielbar. Es gibt keine Anmeldung, Tracker oder externen Laufzeitressourcen.

## Tests

Es gibt keine npm-Runtime-Dependencies. Benötigt wird Node.js 20 oder neuer.

```bash
npm test
npm run check
```

`npm run check` prüft JavaScript-Syntax, Move-/Merge-/Win-/Game-over-Logik, Undo/Persistenz, Pointer- und Fokusregeln, Motion-/Responsive-Verträge, Service-Worker-Fallbacks sowie Webroot-/PWA-Installationsdaten. Derselbe Check läuft in GitHub Actions.

## PWA / Offline

`manifest.webmanifest` beschreibt die installierbare App mit expliziten 192/512-PNGs, separatem Maskable-Icon, SVG-Fallback und Apple-Touch-Icon. `sw.js` legt den vollständigen App-Shell nach dem ersten erfolgreichen Laden lokal ab. Solange Netzwerk verfügbar ist, werden Navigation und lokale Shell-Assets network-first geladen und erfolgreiche Antworten aktualisieren den Cache sofort; bei Netzfehlern oder fehlerhaften Serverantworten fällt die App auf den zuletzt gültigen Cache zurück. Damit hängt ein normaler Produkt-Deploy nicht von einem manuellen Cache-Namens-Bump ab. Explizite Cache-Versionen bleiben für strukturelle Cache-Wechsel erhalten und alte Versionen werden beim Aktivieren bereinigt.

Die Connection-Zeile unterscheidet Vorbereitung, echte Offline-Bereitschaft und Fehler. Erst `Online · offline bereit` bestätigt, dass der Service Worker bereit ist; `Offline · Reload nicht abgesichert` bedeutet, dass die aktuelle Seite zwar weiterlaufen kann, ein Reload aber nicht als offlinefähig bestätigt ist.

Für einen manuellen Offline-Smoke-Test:
1. Seite online laden und warten, bis `Online · offline bereit` angezeigt wird.
2. In Browser-DevTools auf Offline wechseln oder Netzwerk trennen.
3. Seite neu laden und eine Runde spielen; der Status soll `Offline · spielbereit` zeigen.
4. Netzwerk wieder aktivieren und prüfen, dass ein neuer Deploy bereits beim nächsten Online-Load übernommen wird.

## Architektur

- `game.js` – pure, browser- und Node-kompatible Spielregeln
- `storage.js` – validierte, fehlertolerante Local-Storage-Grenze
- `connectivity.js` – pure Ableitung des Online-/Offline-Bereitschaftsstatus
- `dialog.js` – pure Fokus-Wrap-Regel für modale Endzustände
- `pointer.js` – pure Guards für primäre Pointer-/Touch-Gesten
- `app.js` – Browserzustand, Rendering, Eingabe, Motion-Trigger und Installationsintegration
- `index.html` / `styles.css` – direkt auslieferbare Oberfläche, Responsive- und Reduced-Motion-Verträge
- `sw.js` / `manifest.webmanifest` / `icon*.{svg,png}` / `apple-touch-icon.png` – PWA-, Installations- und Offline-Shell
- `*.test.js` – dependency-freie Node-Regressionen und statische Webroot-Verträge

Die Trennung hält Kernlogik, Persistenz, Eingaberegeln und Offlinepfad deterministisch testbar und lässt das Deployment ohne Buildschritt auskommen.

## Deployment

`main` soll direkt als Webroot des Ziel-Webservers ausgeliefert werden. Es ist kein Kopieren aus `dist/` und kein Buildschritt erforderlich. Der Server sollte mindestens korrekte MIME-Typen liefern; HTTPS ist außerhalb von `localhost` für Service Worker und Installation erforderlich.

Aktuelle Entwicklungssteuerung: Issue #1 (Master), #3 (fortlaufender Delivery-Loop) und #4 (finaler Hardening-/Acceptance-Pass).
