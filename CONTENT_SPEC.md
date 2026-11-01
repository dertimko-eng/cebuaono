# CONTENT_SPEC – Inhaltsformat der Cebuano-App

Dieses Dokument ist die verbindliche Referenz für alle Lerninhalte. Die App ist nur ein
„Player“ für die JSON-Dateien in `content/`. Jede Änderung oder Erweiterung (z. B. Unit 13)
muss diesem Format folgen und `node scripts/validate_content.mjs` ohne Fehler bestehen.

---

## 1. Dateien

| Datei | Zweck |
|---|---|
| `content/index.json` | Liste der Units in Reihenfolge (`{"units": ["unit_01", … ]}`) |
| `content/glossary.json` | Zentrales Glossar: jedes Wort genau einmal, mit Lektion der Einführung |
| `content/names.json` | Eigennamen und Lehnwörter, die ohne Glossar-Eintrag erlaubt sind |
| `content/units/unit_NN.json` | Eine Unit mit genau 6 Lektionen |
| `scripts/validate_content.mjs` | Prüft alles Obenstehende (Node ≥ 18, keine Abhängigkeiten) |

Alle Dateien sind UTF-8, Einrückung 2 Leerzeichen.

---

## 2. Glossar (`content/glossary.json`)

```json
{
  "entries": [
    {
      "ceb": "Maayong buntag",
      "de": "Guten Morgen",
      "pos": "phrase",
      "lesson": "u01_l01",
      "note": "wörtlich: guter Morgen",
      "forms": ["maayong buntag"]
    }
  ]
}
```

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `ceb` | ja | Cebuano-Form (bei Verben die **Wurzel**, z. B. `kaon`, nicht `mokaon`). Schlüssel des Eintrags, muss eindeutig sein. |
| `de` | ja | **Die eine** deutsche Übersetzung, die im ganzen Kurs verwendet wird. Mehrere Bedeutungen mit `;` trennen, aber die erste ist die Hauptbedeutung. |
| `pos` | ja | `noun`, `verb`, `adj`, `adv`, `pron`, `particle`, `number`, `phrase`, `question`, `prep`, `conj`, `name` |
| `lesson` | ja | Lektions-ID, in der das Wort eingeführt wird (`uNN_lMM`) |
| `note` | nein | Wörtliche Bedeutung, Gebrauchshinweis, Aussprache (z. B. Betonung, Glottis) |
| `forms` | nein | Zusätzliche Schreib-/Flexionsformen, die der Validator als „bekannt“ akzeptiert (z. B. `["kog"]` für `ko` + `ug`). Verb-Affixe müssen **nicht** gelistet werden, siehe 6.3. |
| `pron` | nein | Aussprache-Umschrift, die die regelbasierte Umschrift der App ersetzt. Deutsche Lesart, Silben mit `-`, betonte Silbe in GROSSBUCHSTABEN, Stimmabsatz als `'` (z. B. `"ßa-LA-mat"`, `"kan'ON"`). Nur setzen, wenn die automatische Umschrift falsch ist oder die Betonung bekannt ist. |
| `tags` | nein | Freie Schlagwörter (`"family"`, `"food"`, …) für Ablenker-Auswahl im Trainer |

Regeln:
- **Ein Wort = eine feste Übersetzung.** Synonyme werden nicht eingeführt, wenn es ein Wort schon gibt
  (z. B. nur `pud` für „auch“, nicht zusätzlich `sad`/`usab`).
- Homographen mit verschiedener Bedeutung (z. B. `wala` „nicht vorhanden“ und `wala` „links“) werden
  als **ein** Eintrag mit beiden Bedeutungen in `de` geführt und in `note` erklärt.
- Jedes Wort erscheint genau in der `vocab`-Liste der Lektion, die in `lesson` steht (siehe 3.2).

---

## 3. Unit-Datei (`content/units/unit_NN.json`)

```json
{
  "unit": 1,
  "title": "Hallo & Vorstellen",
  "level": "A0",
  "lessons": [ … genau 6 Lektionen … ]
}
```

`level` ist das geschätzte Niveau **nach** Abschluss der Unit: Units 1–4 `A0`, Units 5–8 `A1`, Units 9–12 `A2`.

### 3.1 Lektion

```json
{
  "id": "u01_l01",
  "title": "Begrüßung",
  "vocab": [
    {"ceb": "Maayong buntag", "de": "Guten Morgen", "note": "wörtlich: guter Morgen"}
  ],
  "grammar": {"title": "Maayong + Tageszeit", "text": "…"},
  "exercises": [ … ],
  "surprise": {"ceb": "Gimingaw ko nimo.", "de": "Ich vermisse dich.", "when": "Wenn sie unterwegs ist"}
}
```

| Feld | Regel |
|---|---|
| `id` | `uNN_lMM`, NN = Unit (01–12), MM = Lektion (01–06) |
| `title` | Deutsch, kurz |
| `vocab` | 6–10 Einträge. `ceb` und `de` müssen **exakt** dem Glossar entsprechen. Höchstens **ein** Eintrag darf `"outlook": true` tragen: ein Ausblick-Wort, das im Glossar einer späteren Lektion zugeordnet ist. Alle anderen müssen im Glossar genau diese Lektion als `lesson` haben. |
| `grammar` | Pflicht. `text` höchstens 5 Sätze, Deutsch, alltagsnah, jeder Fachbegriff mit Beispiel. Zeilenumbrüche mit `\n` erlaubt. |
| `exercises` | 12–18 Übungen (ohne `grammar_note`), mindestens **5 verschiedene** Typen. Höchstens 2 `grammar_note`. |
| `surprise` | Pflicht. Ein Satz für die Ehefrau: `ceb`, `de`, `when` (wann er passt). Darf bis zu 2 Wörter enthalten, die noch nicht eingeführt wurden (es ist ein Geschenk, keine Übung). |

### 3.2 Wortschatz-Regeln pro Lektion
1. Übungen dürfen nur Wörter verwenden, die in **dieser oder einer früheren Lektion** eingeführt wurden
   (Reihenfolge: u01_l01 < u01_l02 < … < u12_l06), plus das Ausblick-Wort, plus `names.json`.
2. **Wiederholung:** Von allen verschiedenen Glossar-Wörtern, die in den Übungen vorkommen, müssen
   mindestens **30 %** aus früheren Lektionen stammen (gilt nicht für u01_l01).
3. Grammatik: pro Lektion nur **ein** Muster, mit festen Beispielsätzen, die auch in den Übungen vorkommen.

---

## 4. Übungstypen

Jede Übung hat `type`. Optional bei jedem Typ: `"vocab": ["kaon", "isda"]` – welche Glossar-Wörter die
Übung trainiert (für SRS und Statistik). Fehlt es, erkennt die App die Wörter automatisch aus dem Cebuano-Text.

### `multiple_choice`
```json
{"type": "multiple_choice", "prompt": "Maayong buntag", "direction": "ceb_de",
 "options": ["Guten Morgen", "Gute Nacht", "Danke", "Tschüss"], "answer": 0}
```
- `direction`: `ceb_de` (Prompt Cebuano, Optionen Deutsch) oder `de_ceb`.
- Genau 4 `options`, `answer` = Index der richtigen (0–3). Keine doppelten Optionen.

### `word_bank`
```json
{"type": "word_bank", "prompt": "Ich bin Lehrer.", "direction": "de_ceb",
 "tokens": ["Maestro", "ko", "nurse", "siya"], "answer": ["Maestro", "ko"],
 "accepted": ["Magtutudlo ko"]}
```
- `direction` optional, Standard `de_ceb` (Prompt Deutsch, Kacheln Cebuano). Bei `ceb_de` ist der Prompt
  Cebuano und die Kacheln Deutsch.
- `answer` ist die richtige Reihenfolge; jedes Element muss in `tokens` vorkommen (bei Duplikaten
  entsprechend oft). `tokens` enthält 2–3 **Ablenker** zusätzlich. Satzzeichen gehören nicht in Kacheln.
- `accepted`: alternative ganze Sätze (Strings), die als richtig zählen, wenn der Nutzer sie aus den
  Kacheln bauen kann.

### `fill_blank`
```json
{"type": "fill_blank", "prompt": "Maayong ___, Mama!", "translation": "Guten Morgen, Mama!",
 "options": ["buntag", "gabii", "salamat"], "answer": 0}
```
- Genau ein `___` im Prompt, genau 3 `options`, `answer` = Index.
- `translation` (Deutsch) ist Pflicht, damit die Lücke eindeutig ist.

### `type_answer`
```json
{"type": "type_answer", "prompt": "Danke", "answer": "Salamat", "accepted": ["Daghang salamat"]}
```
- Prompt Deutsch, `answer` Cebuano. `accepted` optional.
- Bewertung mit `isAnswerAcceptable()` (siehe 5). Bei Sätzen gilt die Toleranz pro Wort, Reihenfolge muss stimmen.

### `match_pairs`
```json
{"type": "match_pairs", "pairs": [
  {"ceb": "Salamat", "de": "Danke"}, {"ceb": "Oo", "de": "Ja"}, {"ceb": "Dili", "de": "Nein"},
  {"ceb": "Palihug", "de": "Bitte"}, {"ceb": "Sige", "de": "Okay"}]}
```
- Genau 5 Paare, keine doppelten `ceb` oder `de`.

### `true_false`
```json
{"type": "true_false", "statement": "Maayong gabii", "translation": "Guten Morgen",
 "answer": false, "correction": "Gute Nacht / Guten Abend"}
```
- `answer: true` wenn `translation` stimmt. Bei `false` ist `correction` (die richtige Übersetzung) Pflicht.

### `grammar_note`
```json
{"type": "grammar_note", "title": "ko = ich", "text": "…"}
```
- Reine Erklärkarte, zählt nicht als Übung, gibt keine XP, kein Fehler möglich.

---

## 5. Gnädige Bewertung (`isAnswerAcceptable`)

Eine zentrale Funktion in `js/answer.js`, verwendet von Lektion **und** Vokabeltrainer:

1. Normalisieren: Kleinschreibung; Akzente/Diakritika entfernen (`á`→`a`); Bindestriche und Apostrophe
   entfernen (`kanus-a` → `kanusa`); `og` → `ug`, `jud` → `gyud`, `ngano` = `nganu`; Satzzeichen am
   Ende und mehrfache Leerzeichen entfernen.
2. Exakte Übereinstimmung mit `answer` oder einem Eintrag aus `accepted` → **richtig**.
3. Sonst pro Wort (gleiche Wortanzahl, gleiche Reihenfolge) Levenshtein-Distanz:
   ≤ 1 bei Wörtern bis 5 Buchstaben, ≤ 2 ab 6 Buchstaben → **„fast richtig“** (zählt als richtig,
   App zeigt „Fast – richtig wäre: …“).
4. Sonst **falsch**.

Rückgabe: `{ok: boolean, near: boolean, expected: string}`.

---

## 6. Validator-Regeln (`scripts/validate_content.mjs`)

Aufruf: `node scripts/validate_content.mjs` (alle Units) oder `node scripts/validate_content.mjs 3` (nur Unit 3).
Exit-Code 1 bei Fehlern. Warnungen brechen nicht ab.

### 6.1 Struktur
- Unit-Nummer passt zum Dateinamen, genau 6 Lektionen, IDs lückenlos.
- Alle Pflichtfelder vorhanden, Typen korrekt, Zählgrenzen (vocab 6–10, exercises 12–18, ≥ 5 Typen).
- `multiple_choice`: 4 Optionen, Index gültig, keine Duplikate. `fill_blank`: 3 Optionen, ein `___`.
  `word_bank`: alle `answer`-Tokens in `tokens`, mind. 2 Ablenker. `match_pairs`: 5 Paare.
  `true_false`: bei `false` ein `correction`.
- Grammatik-Text höchstens 5 Sätze (gezählt an `.`, `!`, `?`).

### 6.2 Glossar
- `ceb` eindeutig; `lesson` existiert; jedes Glossar-Wort steht in der `vocab`-Liste genau dieser Lektion
  und jede `vocab`-Zeile hat einen Glossar-Eintrag mit identischem `ceb`/`de`.
- Höchstens ein `outlook`-Wort pro Lektion.

### 6.3 Nur bekannte Wörter
Für jeden Cebuano-Text einer Übung (Prompt/Optionen/Tokens/Antworten/Statements je nach Richtung) wird
jedes Token geprüft. Ein Token gilt als bekannt, wenn eine dieser Bedingungen zutrifft:
1. Es ist (kleingeschrieben, ohne Satzzeichen) ein Glossar-`ceb`, eine `forms`-Variante oder ein Wort eines
   mehrteiligen Glossar-Eintrags (`Maayong buntag` → `maayong`, `buntag`), das bis zu dieser Lektion eingeführt ist.
2. Es steht in `names.json`.
3. Es lässt sich durch Abtrennen von Affixen auf eine bekannte Wurzel (≥ 3 Buchstaben) zurückführen.
   Präfixe: `mo, mu, mag, nag, ni, mi, gi, gina, i, ma, na, naka, maka, naga, maga, nagka, magka, ka, pag, pagka, mang, nang, man, nan, pa, ipa, gipa, ika, taga, tag, ting, labing, pinaka, ka…an`.
   Suffixe: `on, hon, an, han, a, ha, i, hi, ng, g, y, ay, ra`. Infix: `in` nach dem ersten Konsonanten (`gisulat` ↔ `sinulat`).
   Verdopplung der ersten Silbe (`magluto` ↔ `magluluto`) wird akzeptiert.
4. Es ist eine Zahl, ein Satzzeichen oder ein Platzhalter `___`.

Unbekannte Tokens sind **Fehler** (nicht Warnung). Lösung: Wort in der passenden Lektion einführen oder den Satz ändern – nie die Regel lockern.

### 6.4 Orthografie
Fehler bei: `og` (→ `ug`), `jud`/`jd` (→ `gyud`), `nga ` vor Vokal ist erlaubt, `kanusa` (→ `kanus-a`),
`maguusa` (→ `mag-usa`), `ug` am Satzanfang groß erlaubt. Prüfliste in `scripts/validate_content.mjs` erweiterbar.

### 6.5 Wiederholungsquote
Siehe 3.2 (2). Unter 30 % → Fehler.

---

## 7. Sprachliche Regeln

- **Standard-Cebuano** (Cebu City), Schreibung nach dem gängigen Standard: `ug` (nicht `og`), `gyud` (nicht `jud`),
  `kaayo`, `kinsa`, `unsa`. Glottis-Bindestrich **nur** zwischen Konsonant und Vokal innerhalb eines Wortes
  (`kanus-a`, `mag-usa`, `tan-aw`, `kan-on`), nie bei `maayo`, `buntag`.
- Spanische Lehnwörter in Cebuano-Schreibung: `kwarto`, `lamesa`, `kusina`, `semana`, `oras`, `pero`.
- Englische Lehnwörter, die im Alltag üblich sind, werden in Cebuano-Schreibung oder Original geführt
  und in `names.json` bzw. Glossar gelistet (`selpon`, `bus`, `nurse`).
- Pronomen: Langform (`ako`, `ikaw`, `siya`, `kita`, `kami`, `kamo`, `sila`) wird am Satzanfang und betont gebraucht,
  Kurzform (`ko`, `ka`, `siya`, `ta`, `mi`, `mo`, `sila`) nach dem ersten Satzglied. Beide im Glossar.
- Zahlen: native Zahlen (`usa`, `duha`, …) zum Zählen in Unit 2; spanische Zahlen (`uno`, `dos`, …, `baynte`)
  für Preise und Uhrzeit in Units 3–4, weil das im Alltag so gesprochen wird.
- Übersetzungen natürlich, nicht wörtlich; wörtliche Bedeutung in `note`.
- Beispielsätze aus dem Leben des Lerners: Lehrer (Biologie/Chemie, Gesamtschule), früher Apotheke, Frau aus
  Cebu, kleine Tochter, Holzwerkstatt (Möbel), E-Bike, Kochen, Sauerland, Reisen auf die Philippinen.
  Eigennamen in `names.json`: `Tim` (der Lerner – im Kurs als Platzhalter), `Mama`, `Papa`, `Sauerland`, `Germany`, `Cebu`, …

---

## 8. Kursplan

| Unit | Thema | Grammatik-Schwerpunkt | Niveau nach Unit |
|---|---|---|---|
| 1 | Begrüßen, Danke, Ja/Nein, Vorstellen | Pronomen `ako/ko, ikaw/ka, siya …`, `si`, Satz ohne „sein“ | A0 |
| 2 | Familie, Zahlen 1–100, Alter | `kini/kana/kadto`, `mga`, Linker `ka`/`nga`, Possessiv `akong …` | A0 |
| 3 | Essen & Trinken, mögen/wollen, Einkaufen, Preise | `gusto`, `ug` als Objektmarker, spanische Zahlen | A0 |
| 4 | Alltag, Tageszeiten, Uhrzeit, Wochentage, Routinen | Verbfokus 1: `mo-`/`mag-` (Zukunft/Gewohnheit), `ma-` bei Zustandsverben | A0 |
| 5 | Zuhause, Zimmer, Gegenstände, Ortsangaben | `sa`, `dinhi/dinha/didto`, `naa/wala` (vorhanden sein), `asa` | A1 |
| 6 | Gefühle & Zustände, Befinden, Wetter | Adjektive, `ma-`-Adjektive, `ka-` Ausruf, `kaayo`, `kay` (weil) | A1 |
| 7 | Arbeit & Schule, Unterricht, Fächer | `naka-/maka-` (können/schaffen), `kahibalo`, `nga` als „dass“ | A1 |
| 8 | Verbfokus 2: Vergangenheit/Gegenwart/Zukunft | `ni-/nag-/mo-`; Objektfokus `gi-/gina-/i-`, `nako/nimo/niya` | A1 |
| 9 | Fragen stellen & beantworten | `unsa, kinsa, asa/diin, kanus-a, ngano, pila, giunsa`, `ba` | A2 |
| 10 | Unterwegs: Richtungen, Verkehr, Philippinen, Jeepney, Markt | `padulong`, `gikan`, Richtungen, `Lugar lang` | A2 |
| 11 | Vergangenes erzählen, Erlebnisse | `na/pa`, `gyud/lang/man`, `naka-` + `na` („schon einmal“) | A2 |
| 12 | Meinung, Wünsche, Pläne, Beziehung & Zukunft | `unta`, `kung`, `sa akong hunahuna`, `tika`, `para` | A2 |

Jede Lektion: 6–10 neue Wörter, 12–18 Übungen, 1 Grammatik-Notiz, 1 Überraschungssatz.
Ziel: 72 Lektionen, ca. 800–900 Wörter.

---

## 9. Unit 13 hinzufügen (Kurzfassung)
1. Neue Wörter mit `"lesson": "u13_l0X"` ins Glossar.
2. `content/units/unit_13.json` nach Abschnitt 3 anlegen.
3. `"unit_13"` in `content/index.json` eintragen.
4. `node scripts/validate_content.mjs 13` bis fehlerfrei.
5. In `sw.js` die `CACHE_VERSION` erhöhen, damit die PWA die neue Datei lädt.
