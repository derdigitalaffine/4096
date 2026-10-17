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

Spielstand, letzter Undo-Snapshot und Bestwert werden lokal im Browser gespeichert. Es gibt keine Anmeldung, Tracker oder externen Laufzeitressourcen.

## Tests

Es gibt keine npm-Runtime-Dependencies. Benötigt wird Node.js 20 oder neuer.

```bash
npm test
npm run check
```

`npm run check` prüft JavaScript-Syntax, die Move-/Merge-/Win-/Game-over-Logik sowie den Webroot-/PWA-Vertrag. Derselbe Check läuft in GitHub Actions.

## PWA / Offline

`manifest.webmanifest` beschreibt die installierbare App. `sw.js` cached den vollständigen App-Shell nach dem ersten erfolgreichen Laden und ermöglicht danach Offline-Reloads. Cache-Versionen sind explizit benannt; beim Aktivieren einer neuen Service-Worker-Version werden alte App-Shell-Caches entfernt.

Für einen manuellen Offline-Smoke-Test:
1. Seite online laden und einmal neu laden, damit der Service Worker sicher kontrolliert.
2. In Browser-DevTools auf Offline wechseln oder Netzwerk trennen.
3. Seite neu laden und eine Runde spielen.
4. Netzwerk wieder aktivieren und prüfen, dass ein neuer Deploy nach Reload übernommen wird.

## Architektur

- `game.js` – pure, browser- und Node-kompatible Spielregeln
- `app.js` – Browserzustand, Rendering, Keyboard/Pointer, Persistenz und Installationsstatus
- `index.html` / `styles.css` – direkt auslieferbare Oberfläche
- `sw.js` / `manifest.webmanifest` / `icon.svg` – PWA- und Offline-Shell
- `*.test.js` – dependency-freie Node-Tests

Die Trennung hält die Kernlogik deterministisch testbar und lässt das Deployment ohne Buildschritt auskommen.

## Deployment

`main` soll direkt als Webroot des Ziel-Webservers ausgeliefert werden. Es ist kein Kopieren aus `dist/` und kein Buildschritt erforderlich. Der Server sollte mindestens korrekte MIME-Typen liefern; HTTPS ist außerhalb von `localhost` für Service Worker und Installation erforderlich.

Aktuelle Entwicklungssteuerung: Issue #1 (Master), #3 (fortlaufender Delivery-Loop), aktuell Round 1 in #6.
