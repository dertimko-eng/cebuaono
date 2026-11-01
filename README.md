# Cebuano lernen – PWA für das iPhone

Eine Duolingo-artige App, mit der du Cebuano (Bisaya) von null bis A2 lernst: 12 Units à 6 Lektionen,
Vokabeltrainer mit Spaced Repetition, Statistik-Tab, Überraschungssätze für deine Frau. Alles läuft
lokal im Browser, optional mit Dropbox-Sync. Kein Build-Schritt, kein Backend, kein App Store.

## Ordnerstruktur

```
index.html              Einstieg
manifest.webmanifest    PWA-Manifest
sw.js                   Service Worker (Offline-Cache) – CACHE_VERSION bei Inhaltsänderungen erhöhen
css/app.css             Styles (Dark Mode folgt dem System)
js/                     App-Code (ES-Module, kein Build)
  app.js                Router, Start, Lernpfad, Wörter, Für meine Frau, Einstellungen
  lesson.js             Lektions-Player
  trainer.js            Vokabeltrainer
  progress.js, stats.js, charts.js   Fortschritt & Statistik aus dem Ereignis-Log
  answer.js             isAnswerAcceptable() – gnädige Bewertung (Lektion + Trainer)
  srs.js                Spaced Repetition (Stufen 0–5, Intervalle 1/3/7/14/30 Tage)
  store.js, db.js       Datenhaltung in IndexedDB
  dropbox.js, sync.js   Dropbox OAuth (PKCE) und Sync
  lexicon.js            Wort-Erkennung (auch vom Validator genutzt)
  config.js             Dropbox-App-Key eintragen
content/
  glossary.json         Zentrales Glossar (ein Wort = eine Übersetzung)
  names.json            Erlaubte Eigennamen/Lehnwörter
  index.json            Liste der Units
  units/unit_NN.json    Lektionsinhalte (die App ist nur ein Player dieser Dateien)
scripts/
  validate_content.mjs  Prüft alle Inhalte (Schema, bekannte Wörter, Wiederholung, Orthografie)
  serve.mjs             Lokaler Testserver
  make_icons.mjs        Erzeugt die PNG-Icons
CONTENT_SPEC.md         Verbindliches Inhaltsformat
SPRACHLICH_PRUEFEN.md   Stellen, die eine Muttersprachlerin prüfen sollte
scripts/AGENT_BRIEF.md  Arbeitsanweisung, mit der die Units geschrieben wurden (für Unit 13 wiederverwendbar)
```

## 1. Lokal starten

Node (≥ 18) ist installiert, Python nicht – deshalb der Node-Server:

```bash
node scripts/serve.mjs 8765
```

Dann `http://localhost:8765/` im Browser öffnen. Alternativ, falls Python vorhanden: `python -m http.server 8765`.

Inhalte prüfen:

```bash
node scripts/validate_content.mjs
```

(`node scripts/validate_content.mjs 3` prüft nur Unit 3.)

## 2. Auf GitHub Pages veröffentlichen

1. Auf github.com ein neues Repository anlegen (z. B. `cebuano`, privat oder öffentlich – GitHub Pages
   braucht bei kostenlosen Konten ein **öffentliches** Repo, bei GitHub Pro geht auch privat).
2. Im Projektordner:
   ```bash
   git remote add origin https://github.com/DEIN-NAME/cebuano.git
   ```
   ```bash
   git push -u origin main
   ```
3. Im Repo: **Settings → Pages → Build and deployment → Source: „Deploy from a branch“, Branch: `main`, Ordner: `/ (root)` → Save.**
4. Nach ein bis zwei Minuten ist die App unter `https://DEIN-NAME.github.io/cebuano/` erreichbar.
5. Bei jeder späteren Änderung: committen und `git push` – fertig. Wenn sich Inhalte geändert haben,
   vorher in `sw.js` die `CACHE_VERSION` erhöhen, damit das iPhone die neuen Dateien lädt.

Jeder andere statische Host (Netlify, eigener Server) funktioniert genauso: Ordner hochladen, fertig.
Wichtig ist nur **HTTPS** (für Service Worker und Dropbox).

## 3. Auf dem iPhone installieren

1. Die URL in **Safari** öffnen (nicht Chrome).
2. Teilen-Symbol (Quadrat mit Pfeil) → **„Zum Home-Bildschirm“** → Hinzufügen.
3. Die App vom Home-Bildschirm starten. Sie läuft jetzt im Vollbild und – nach dem ersten Öffnen – auch offline.

## 4. Dropbox-Sync einrichten

Die App sichert `progress.json` und `events.json` in einem eigenen Dropbox-App-Ordner
(`Dropbox/Apps/<App-Name>/`). Es wird nur der App-Key benötigt, kein Secret (OAuth 2 mit PKCE).

### Dropbox-App anlegen
1. https://www.dropbox.com/developers/apps → **Create app**.
2. „Scoped access“ → **„App folder“** → Name z. B. `Cebuano Lern-App` → Create.
3. Reiter **Permissions**: `files.content.write` und `files.content.read` anhaken → Submit.
4. Reiter **Settings**:
   - **App key** kopieren.
   - Bei **Redirect URIs** eintragen (jeweils „Add“):
     - `https://DEIN-NAME.github.io/cebuano/index.html`
     - `http://localhost:8765/index.html` (zum lokalen Testen)
   - „Allow public clients (Implicit Grant & PKCE)“ muss auf **Allow** stehen.
5. Den App-Key in `js/config.js` eintragen:
   ```js
   DROPBOX_APP_KEY: "abcd1234efgh",
   ```
   Committen und pushen.

### In der App verbinden
- **Im Safari-Tab**: Einstellungen → „Mit Dropbox verbinden“ → bei Dropbox erlauben → du landest
  automatisch wieder in der App („Mit Dropbox verbunden“).
- **Als Home-Bildschirm-App (standalone)**: iOS öffnet Dropbox in einem separaten Browserfenster und
  würde den Rückweg in Safari statt in der App beenden – Safari und die installierte App haben getrennte
  Speicher. Deshalb bietet die App hier den **Code-Weg**: „Mit Dropbox verbinden“ → Dropbox zeigt nach dem
  Erlauben einen Code → Code kopieren → zurück in die App → Code einfügen → „Code bestätigen“.
  Dieser Weg funktioniert unabhängig davon, in welchem Fenster Dropbox geöffnet wurde.
- Danach: automatischer Sync beim Start und nach jeder Lektion/Trainer-Runde, Status „Zuletzt synchronisiert“
  und Button „Jetzt synchronisieren“ in den Einstellungen.
- Zweites Gerät: einfach dort ebenfalls verbinden. Beim Start werden die Stände zusammengeführt
  (neuere Einträge gewinnen, das Ereignis-Log wird vereinigt und nie überschrieben).

Hinweis zum Testen des Redirects im Standalone-Modus: Der Redirect-Fall konnte beim Bauen nur am Desktop
(Safari/Chrome-Verhalten) geprüft werden, nicht auf einem echten iPhone. Falls die automatische Rückleitung
auf deinem iPhone wider Erwarten doch in der App ankommt, kannst du auch dort „Mit Dropbox verbinden“ im
Safari-Tab nutzen; der Code-Weg bleibt als sichere Variante.

## 5. Fortschritt sichern und wiederherstellen

- **Dropbox** (empfohlen): siehe oben. iOS löscht Website-Daten einer PWA nach 7 Tagen ohne Nutzung –
  mit Dropbox-Sync ist das abgefangen, beim nächsten Start wird alles wieder heruntergeladen.
- **Datei**: Einstellungen → „Exportieren“ erzeugt `cebuano-fortschritt-DATUM.json` (in iOS landet sie unter
  Dateien/Downloads). „Importieren“ führt eine solche Datei mit dem lokalen Stand zusammen.
- **Zurücksetzen**: Einstellungen → „Lokalen Fortschritt zurücksetzen“ (Dropbox bleibt unverändert, bis du
  erneut synchronisierst – vorher dort die beiden Dateien löschen, wenn du wirklich bei null anfangen willst).

## 6. Wie füge ich später Unit 13 hinzu?

1. Neue Wörter in `content/glossary.json` anlegen, jeweils mit `"lesson": "u13_l01"` … `"u13_l06"`
   (6–10 Wörter pro Lektion). Regeln: `CONTENT_SPEC.md` Abschnitt 2.
2. `content/units/unit_13.json` nach dem Muster von `unit_12.json` schreiben (6 Lektionen, je 12–18 Übungen,
   Grammatik-Notiz, Überraschungssatz). Schema: `CONTENT_SPEC.md` Abschnitte 3–4.
3. `"unit_13"` in `content/index.json` ergänzen.
4. `node scripts/validate_content.mjs 13` ausführen, bis `0 Fehler` – der Validator meldet unbekannte Wörter,
   fehlende Felder, zu wenig Wiederholung usw.
5. In `sw.js` die `CACHE_VERSION` erhöhen (z. B. `v2`), committen, pushen. Die App zeigt Unit 13 am Ende des Pfads.

## 7. Lernmechanik in Kürze

- **Lektion**: Vokabeln + Grammatik-Notiz, dann 12–18 Übungen. Fehler werden ans Ende gehängt. Jederzeit
  unterbrechbar (✕), der Stand bleibt gespeichert. Am Ende XP, Trefferquote und der Überraschungssatz.
- **SRS**: jedes Wort hat eine Stufe 0–5 (neu → lernend → gefestigt → gemeistert). Richtige Antwort = Stufe hoch
  (Tippen/Satz bauen = voller Schritt, Auswahl = halber Schritt), Fehler = zurück auf Stufe 1, fällig morgen.
- **Trainer**: zuerst fällige Wörter, dann Wörter mit Fehlern der letzten 7 Tage, dann die mit der schlechtesten
  Quote. Einfach (auswählen) oder Schwer (tippen, zählt doppelt).
- **Gnädige Bewertung** (Lektion und Trainer): Groß/Klein, Akzente, Bindestriche und Satzzeichen egal,
  og = ug, jud = gyud, kleine Tippfehler (Levenshtein ≤ 1 bzw. ≤ 2 ab 6 Buchstaben) zählen als „fast richtig“.
- **Fortschritt**: alles wird aus dem Ereignis-Log berechnet (jede Antwort = ein Eintrag mit Zeit, Wörtern,
  Typ, richtig/falsch, Dauer). Neue Auswertungen lassen sich später ergänzen, ohne Daten zu verlieren.
- **Wochenrückblick**: beim ersten Öffnen an einem Montag.

## 8. Bekannte Einschränkungen

- Kein Audio (es gibt keine brauchbare Cebuano-Stimme).
- Benachrichtigungen sind bewusst weggelassen (bei iOS-PWAs unzuverlässig).
- Der Service Worker läuft nur über HTTPS oder `localhost`; in manchen eingebetteten Browsern (z. B. App-Vorschauen)
  wird er blockiert – die App funktioniert dann trotzdem, nur nicht offline.
