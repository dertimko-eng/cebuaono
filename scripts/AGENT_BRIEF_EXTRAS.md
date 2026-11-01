# Auftrag: Eselsbrücken, Bilder und Geschichte für Unit NN

Projektordner: C:\Users\User\Dropbox\Cebuano App. Du schreibst **genau zwei Dateien**:
`content/extras/unit_NN.json` und `content/stories/story_NN.json` (NN = deine Unit-Nummer, zweistellig).
Lies zuerst `CONTENT_SPEC.md` Abschnitte 10 und 11 (Format) und 7 (Sprachregeln).

## Teil A: Eselsbrücken und Bilder (`content/extras/unit_NN.json`)

Die Wörter deiner Unit mit Aussprache-Umschrift bekommst du mit:
`node scripts/list_words.mjs NN`  (Spalten: lesson | ceb | Umschrift | de | pos | note)

Für **jedes** Wort ein Eintrag `{"mnemonic": "...", "img": "🥭" oder null}`. Der Schlüssel ist `ceb` zeichengenau.

### Was eine gute Eselsbrücke ausmacht (der Lerner ist Deutscher, Lehrer, visuell)
1. **Klang-Anker**: Ein deutsches (notfalls englisches) Wort oder Wortpaar, das so klingt wie die Umschrift oder ihr Anfang. Den klangähnlichen Teil in GROSSBUCHSTABEN schreiben.
2. **Konkretes Bild**: Eine kurze, möglichst absurde oder witzige Szene, in der der Klang-Anker und die **Bedeutung** zusammen vorkommen. Die Bedeutung muss im Satz wörtlich stehen.
3. **Kurz**: ein Satz, 30–160 Zeichen. Keine Erklärung, keine Grammatik.
4. **Selbsttest**: Würde jemand, der das Cebuano-Wort nach drei Tagen wieder liest, über den Klang-Anker auf die Bedeutung kommen? Wenn nein: neu schreiben. „Klingt irgendwie wie …“ ohne Bild ist verboten.
5. Funktionswörter (ug, sa, ang, nga, ba, ka …) und Pronomen bekommen eine **Gebrauchs-Brücke** mit Beispiel statt einer Bildszene, z. B. `ug = und: „Tubig UG kape“ – UGh, und noch ein Kaffee.`
6. Bei spanischen Lehnwörtern den spanischen/deutschen Bezug nutzen (gusto = Gusto, mesa/lamesa = Tisch wie in „Mensa“, syento = Cent/hundert).
7. Lerner-Kontext darf vorkommen: Lehrer (Bio/Chemie), Apotheke, Ehefrau Langga aus Cebu, Tochter Inday, Holzwerkstatt, E-Bike, Kochen, Sauerland.

Gute Beispiele:
- tubig (Wasser): `tu-BIG: „TU BIG“ – trink BIG, trink viel Wasser.`
- kaon (essen): `ka-ON: KAU AN! Zähne an und essen.`
- bugnaw (kalt): `bug-NAU: Der BUG sagt „NAU!“ und bibbert – es ist kalt.`
- init (heiß): `I-NIT: „IN IT“ ist es heiß – wie in der Sauna.`
- balay (Haus): `ba-LAI: Papa (BA) LEIht sich ein Haus – das balay.`
- gwapa (hübsch): `GWAPA = spanisch guapa: „Guapa!“ ruft man einer hübschen Frau nach.`
- salamat (danke): `ßa-LA-mat: Nach dem SALAT am Tisch sagst du danke.`

Schlechte Beispiele (so nicht): „balay klingt wie Ballett“ (kein Bild, keine Bedeutung), „tubig – merke: Wasser“ (keine Brücke), Sätze über 160 Zeichen.

### Bild (`img`)
Genau **ein** Emoji, wenn die Bedeutung konkret und das Emoji eindeutig ist: Dinge, Tiere, Essen, Personen/Rollen, Körperteile, Wetter, Orte, Fahrzeuge, klare Tätigkeiten (schlafen 😴, kochen 🍳, schwimmen 🏊). Bei Zahlen die Ziffer als Emoji ist **nicht** erlaubt (ergibt 2 Grapheme), nimm `null`. Für Partikeln, Pronomen, abstrakte Adjektive und Adverbien: `null`. Lieber `null` als ein Emoji, das man falsch deuten könnte.

## Teil B: Geschichte (`content/stories/story_NN.json`)

Ein Comic-Dialog zu deiner Unit, freigeschaltet nach `after` = `uNN_l06`. **Nur Wörter bis einschließlich dieser Lektion** (plus Namen aus `content/names.json`). Alle erlaubten Wörter: `node scripts/list_words.mjs upto uNN_l06`. Verb-Affixe (mo-, nag-, gi-, -on, -a …) erkennt der Validator, solange die Wurzel bekannt ist.

Figuren (Charakter bitte spürbar machen):
- `tim`: der Deutsche, lernt tapfer, tritt in Fettnäpfchen, nimmt es mit Humor.
- `langga`: seine Frau aus Cebu, schlagfertig, korrigiert liebevoll, lacht viel.
- `inday`: die kleine Tochter, mischt Deutsch und Cebuano, stellt die besten Fragen.
- `lola`: Oma in Cebu, meist per Videoanruf, hat zu allem eine Meinung, besonders zum Essen.
- `dodong`: Manong Dodong – Nachbar, Jeepney-Fahrer, Marktverkäufer, je nach Szene; redet schnell, bringt Alltagsfloskeln.
- `agila`: der Adler, Erzähler/Kommentator; darf 1–2 Zeilen haben (Cebuano + de), nicht mehr.

Regeln: 8–12 Zeilen, jede 1–2 kurze Sätze; Alltag, witzig, mit Pointe am Ende (`punchline`, Deutsch); Thema passend zur Unit (Unit 3 Essen/Markt, Unit 10 Jeepney …); eine `scene` aus der erlaubten Liste; 3–4 Verständnisfragen auf Deutsch, deren Antwort sich aus dem Dialog ergibt; Ablenker plausibel. Cebuano-Standard: ug, gyud, Bindestrich bei Glottis. Übersetzungen `de` natürlich und nicht wörtlich.

## Prüfen
`node scripts/validate_content.mjs NN` muss **0 Fehler** melden (Warnungen zu fehlenden Dateien anderer Art ignorieren). Fehler beheben, erneut prüfen. Keine anderen Dateien ändern. Am Ende kurz berichten: Zahl der Wörter, Zahl der Emojis, Titel der Geschichte, Besonderheiten.
