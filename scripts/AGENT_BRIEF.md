# Auftrag: Unit NN der Cebuano-Lern-App schreiben

Du schreibst **genau eine Datei**: `content/units/unit_NN.json` (NN = deine Unit-Nummer, zweistellig).
Projektordner: C:\Users\User\Dropbox\Cebuano App

## Zuerst lesen
1. `CONTENT_SPEC.md` – verbindliches Format, Übungstypen, Regeln (Abschnitte 3, 4, 6, 7, 8).
2. `content/units/unit_01.json` – fertiges Beispiel, genau so soll deine Datei aussehen.
3. `content/glossary.json` – die Wörter deiner Unit stehen dort mit `"lesson": "uNN_lMM"`. Hole sie dir z. B. mit
   `node -e "const g=require('./content/glossary.json');for(const e of g.entries)if(e.lesson.startsWith('uNN'))console.log(e.lesson,'|',e.ceb,'|',e.de,'|',e.pos,'|',e.note||'')"`
   Die `vocab`-Liste jeder Lektion muss **genau** diese Wörter enthalten (ceb und de zeichengenau aus dem Glossar kopieren; `note` darfst du übernehmen).
4. Alle schon eingeführten Wörter (frühere Lektionen) darfst du frei verwenden – der Validator sagt dir, wenn ein Wort noch unbekannt ist.

## Regeln in Kürze
- 6 Lektionen, IDs uNN_l01 … uNN_l06, `level` laut Spec-Tabelle (Units 1–4 A0, 5–8 A1, 9–12 A2).
- Pro Lektion: vocab = die Glossar-Wörter dieser Lektion (6–10), **eine** Grammatik-Notiz (max. 5 Sätze, Deutsch, alltagsnah, mit Beispielen), 12–18 Übungen aus **mindestens 5 verschiedenen Typen**, höchstens 2 `grammar_note`, ein `surprise`-Satz für die Ehefrau (liebevoll, witzig oder nützlich; `when` erklärt, wann er passt).
- Übungen dürfen nur Wörter verwenden, die bis zu dieser Lektion eingeführt sind (plus Eigennamen aus `content/names.json`). Verb-Formen mit Affixen (mo-, nag-, gi-, -on, -a …) erkennt der Validator automatisch, solange die Wurzel bekannt ist.
- Mindestens 30 % der in den Übungen verwendeten Glossar-Wörter müssen aus früheren Lektionen stammen – also fleißig wiederholen.
- Jedes neue Wort soll in mindestens einer Übung vorkommen.
- Standard-Cebuano: `ug` (nie og), `gyud` (nie jud), Bindestrich bei Glottis (`kanus-a`, `tan-aw`). Ein Wort = eine Übersetzung (nimm immer die Glossar-Übersetzung).
- Sätze aus dem Leben des Lerners: Lehrer für Biologie und Chemie an einer Gesamtschule, früher Apotheke, Frau ist Cebuano-Muttersprachlerin aus Cebu, kleine Tochter (Anrede: Inday), Holzwerkstatt/Möbel bauen, E-Bike, kochen, Sauerland, Reisen auf die Philippinen zur Familie. Keine „Der Apfel ist rot“-Sätze.
- Die deutschen Übersetzungen natürlich formulieren; Multiple-Choice-Ablenker plausibel, aber eindeutig falsch.
- `word_bank`: 2–3 Ablenker-Kacheln, keine Satzzeichen in Kacheln. `fill_blank`: genau ein `___`, 3 Optionen, `translation` Pflicht. `true_false`: bei `false` ein `correction`. `match_pairs`: genau 5 Paare.
- Beim `type_answer` darf `accepted` nur Alternativen mit bekannten Wörtern enthalten.

## Vorgehen
1. Datei schreiben.
2. `node scripts/validate_content.mjs NN` ausführen. **Jeden Fehler beheben** (Satz umformulieren oder anderes bekanntes Wort nehmen) – nie die Regeln lockern, nie `glossary.json`, `CONTENT_SPEC.md`, `names.json` oder den Validator ändern. Wiederholen bis `0 Fehler`. Warnungen möglichst auch beheben.
3. Nichts committen (das macht der Hauptprozess).

## Abschlussbericht (kurz)
- Bestätigung „Unit NN: 0 Fehler, X Warnungen“ mit der Validator-Ausgabe.
- Liste von 3–8 Stellen, bei denen du sprachlich unsicher bist (Wort/Satz + warum) – diese Liste wird später einer Muttersprachlerin vorgelegt.
- Falls dir ein Wort fehlte, das die Lektion dringend gebraucht hätte: nennen (nicht selbst ergänzen).
