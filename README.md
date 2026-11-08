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
  pronounce.js          Aussprache-Umschrift (regelbasiert, deutsche Lesegewohnheit)
  art.js                Adler-Maskottchen, Unit-Abzeichen, Konfetti (alles Inline-SVG)
  config.js             Dropbox-App-Key eintragen
content/
  glossary.json         Zentrales Glossar (ein Wort = eine Übersetzung)
  names.json            Erlaubte Eigennamen/Lehnwörter
  index.json            Liste der Units
  units/unit_NN.json    Lektionsinhalte (die App ist nur ein Player dieser Dateien)
scripts/
  validate_content.mjs  Prüft alle Inhalte (Schema, bekannte Wörter, Wiederholung, Orthografie)
  serve.mjs             Lokaler Testserver
  icons.html            Rendert die PNG-Icons aus dem Adler (Server mit --icons starten)
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
- **Zurücksetzen**: Einstellungen → „Fortschritt zurücksetzen“ löscht den lokalen Stand und, wenn verbunden, auch die
  beiden Dateien in Dropbox. Vorher exportieren, wenn du unsicher bist.

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
- **Wochenrückblick**: beim ersten Öffnen an einem Montag, jederzeit unter Mehr → Wochenrückblick.
- **Komfort**: „Weiß ich nicht“ zeigt die Lösung (zählt als Fehler), Enter/Leertaste geht nach dem Feedback weiter, bei Fehlern werden die beteiligten Wörter erklärt, am Lektionsende geht es direkt in die nächste Lektion. Wiederholte Lektionen lassen sich ohne Vokabel-Intro starten. Mehr → Grammatik sammelt alle Grammatik-Notizen, in der Wörterliste öffnet ein Tipp auf ein Wort Details und „Jetzt üben“. Einstellungen: große Schrift, „Nach Updates suchen“. Bei einer neuen Version erscheint oben ein Banner „Neu laden“ – die App lädt nie von selbst mitten in einer Lektion neu.
- **Grafik**: Das Maskottchen ist ein Philippinenadler (passt zu beiden Ländern). Er begrüßt auf der Startseite mit einem Spruch je nach Lage, jubelt bei richtigen Antworten und am Lektionsende (mit Konfetti ab 70 %), tröstet bei Fehlern. Jede Unit hat ein Abzeichen auf dem Pfad, das nach Abschluss golden wird. Alles ist Inline-SVG ohne Bilddateien; wer Bewegung reduziert (iOS „Bewegung reduzieren“), bekommt keine Animationen. Icons neu rendern: `node scripts/serve.mjs 8765 --icons`, dann `http://localhost:8765/scripts/icons.html` öffnen.
- **Bilder und Eselsbrücken**: Jedes Wort hat eine deutsche Eselsbrücke (Klang-Anker in Großbuchstaben + Bild der Bedeutung), konkrete Wörter zusätzlich ein Emoji-Bild. Beides steht im Vokabel-Intro und im Wort-Detail. Aus Wörtern mit Bild erzeugt die App automatisch Übungen „Bild → Wort“ (bis zu 2 pro Lektion, im Trainer und in der Blitzrunde). Quelle: `content/extras/unit_NN.json`, per `node scripts/merge_extras.mjs` ins Glossar übernommen.
- **Geschichten**: Eine Comic-Geschichte pro Unit (`content/stories/story_NN.json`) mit festen Figuren (Tim, Langga, Inday, Lola, Manong Dodong, Agila), Szenenbild, Übersetzung auf Tipp, 3–4 Verständnisfragen und Pointe. Freigeschaltet nach Lektion 6 der Unit, 15 XP. Nur Wörter bis zu dieser Lektion (Validator).
- **Blitzrunde**: 60 Sekunden, Auswahlfragen aus gelernten Wörtern, ab drei richtigen in Folge doppelte Punkte, Rekord wird gespeichert, Punkte = XP. Start auf der Startseite.
- **Wusstest du?**: 36 Kulturkästen (`content/culture.json`, drei pro Unit), einer nach jeder Lektion, alle unter Mehr → Wusstest du?.
- **Einsteigerfreundlich**: Vokabel-Intro zeigt nur Wort, Bild, Übersetzung und Aussprache; Eselsbrücke und Hinweis auf Tipp, Grammatik aufklappbar. Abschluss: erst XP und Satz für Langga, dann „Weiter“, Kulturkasten zugeklappt darunter. Feedback wechselt („Sakto!“, „Maayo!“), zählt Serien ab 3, Fehler heißen „Noch nicht – kommt gleich nochmal“. Touch-Ziele mind. 44 px, Zoom erlaubt, Bewegung reduzieren wird überall respektiert, richtig/falsch zusätzlich mit ✓/✗.
- **Streak-Freezes**: Ein Freeze überbrückt einen verpassten Tag von selbst (beim nächsten Start, mit Hinweis). Einen gibt es zum Start, danach alle 7 Streak-Tage einen neuen, höchstens 2 auf Vorrat. Gespeichert als Events (streak_freeze earn/use), also mit Dropbox synchron. Den Streak halten auch: Mini-Runde (5 Wörter, Startseite), Trainer, Blitzrunde, eine Geschichte oder 5 beantwortete Übungen.
- **Sätze** (eigener Tab): Themen-Sammlungen ganzer Sätze in `content/phrases.json` (Für Langga, Familie, Schule & Arbeit, Alltag zu Hause, Höflich & herzlich, Gefühle & Smalltalk). Lesen mit Aussprache, Übersetzung, wörtlicher Übersetzung und Hinweis; Üben in Runden mit 6 Sätzen (Kacheln bauen, Bedeutung wählen, Lückenwort). Lernstand je Satz aus dem Event-Log (ab 3 Punkten „sicher“), getrennt vom Wort-SRS. Eine Runde hält den Streak (Event `phrase_round`) und gibt 10 XP.
- **Verwechsler** (Mehr → Verwechsler): Pronomen-Tabelle (lang/kurz/-ng/n-), wir mit dir vs. ohne dich, Kurzformen koy/kog/tika, hier-da-dort (i/a/o), dili/wala, na/pa, si/ni/kang/sa/ug – mit Eselsbrücken und Übung per Tipp.
- **Erster Start**: Vier Tour-Seiten mit Agila, jederzeit unter Mehr → Kurze Tour.
- **Aussprache**: Unter jedem Cebuano-Wort und -Satz steht kursiv eine Umschrift für deutsche Leser (ßa-la-mat, ba-ba-je, i-kau, kan'on). Sie wird regelbasiert aus der Schreibung erzeugt (Cebuano ist lautgetreu), Legende unter Mehr → Aussprache lesen. Die Betonung ist nicht markiert, weil sie sich nicht aus der Schreibung ergibt. Korrekturen (auch Betonung) kommen als Feld `pron` ins Glossar, siehe CONTENT_SPEC.md und die Prüfliste in SPRACHLICH_PRUEFEN.md.
- **SRS-Details**: pro Wort höchstens ein Stufenaufstieg pro Tag (eine Lektion fragt ein Wort mehrfach), überschüssige Punkte bleiben für den nächsten Tag; bei Wörtern bis 3 Buchstaben (ko/ka, si/ni) gibt es keine Tippfehler-Toleranz.

## 8. Bekannte Einschränkungen

- Kein Audio (es gibt keine brauchbare Cebuano-Stimme).
- Benachrichtigungen sind bewusst weggelassen (bei iOS-PWAs unzuverlässig).
- Der Service Worker läuft nur über HTTPS oder `localhost`; in manchen eingebetteten Browsern (z. B. App-Vorschauen)
  wird er blockiert – die App funktioniert dann trotzdem, nur nicht offline.
