# Überlast erst ab Mindestmenge — Ermutigung statt Überlast-Warnung

**Stand:** 2026-10-12
**Ziel:** Ein Konto mit wenigen Erledigungen im jüngeren Fenster (1–2) bekommt keine Überlast-Einstufung mehr — weder Ausgleichs-Vorschläge noch Überlast-Push —, sondern einen ermutigenden Satz im Fürsorge-Hinweis. Ab 3 Erledigungen bleibt das Verhalten unverändert.

## Journey: Wenig Erledigtes → Ermutigung statt Überlast-Warnung

### Ziel

Die Überlast-Erkennung wertet erst ab einer Mindestmenge erledigter Aufgaben aus; darunter antwortet das Konto auf Fürsorge mit Anerkennung statt mit Ausgleichs-Vorschlägen.

### Vorbedingung

- Angemeldetes Konto mit Standard-Säulen; erledigte Aufgaben (`Done` mit `erledigtAm`) im jüngeren 7-Tage-Fenster
- Ein Säulenanteil über `UEBERLAST_ANTEIL` (50 %) des Gesamtaufwands des jüngeren Fensters

### Schritte

1. **Konto mit genau einer erledigten Aufgabe**
   - `bewerteCareDefizit` liefert für keine Säule `ueberlast: true` — auch nicht bei über 50 % Anteil
   - `GET /scores/care-suggestions` liefert keinen `anlass: 'ueberlast'`-Eintrag
   - Erster Eintrag der Antwort ist genau **ein** Ermutigungs-Eintrag: `anlass: 'ermutigung'`, ohne `taskId` und ohne `templateKey` (nichts zum Übernehmen oder Ablehnen)
   - `CareHint` rendert diesen Eintrag als Satz **ohne Aktionsreihe** (kein Übernehmen, kein „Nicht jetzt", kein Ablehnen, keine Grundauswahl)

2. **Sprache wechseln (`?sprache=de` / `?sprache=en`)**
   - Der Ermutigungs-Satz kommt in beiden Care-Sprachen (`CARE_SPRACHEN`), Ton nach `docs/fuersorge-tonalitaet.md` (Lob-Variante: die erledigte Aufgabe konkret anerkennen, du-Form, kein moralisches Vokabular); de und en unterscheiden sich

3. **Konto mit drei erledigten Aufgaben im jüngeren Fenster, ein Säulenanteil über 50 %**
   - Überlast wie bisher: `bewerteCareDefizit` meldet `ueberlast`, die Route liefert Erholungsvorschläge mit `anlass: 'ueberlast'`, der Fürsorge-Push (`carePush`) sendet die Überlast-Situation

### Erwartetes Ergebnis

- Die Mindestmenge ist eine **exportierte Konstante** `UEBERLAST_MINDEST_ERLEDIGUNGEN = 3` neben `UEBERLAST_ANTEIL` in `server/src/logics/careDeficit.ts` (Muster #1793/#1794/#1796); kein Konsument zählt außerhalb von `bewerteCareDefizit` selbst
- `bewerteCareDefizit` setzt `ueberlast` nur noch, wenn im jüngeren Fenster **mindestens** `UEBERLAST_MINDEST_ERLEDIGUNGEN` erledigte Aufgaben liegen (kontoweit gezählt) UND der Anteilsschwellen-Wert überschritten ist — alle drei Konsumenten (`/scores/balance`, `/scores/care-suggestions`, Care-Push) erben die Regel automatisch
- Bei 1–2 Erledigungen liefert `/scores/care-suggestions` **genau einen** Ermutigungs-Eintrag und keinen `ueberlast`-Eintrag; der Eintrag steht an erster Position (CareHint zeigt nur den ersten — er ist damit der einzige sichtbare Vorschlag, keine Mischung im Karten-Screen)
- Ohne Erledigung im jüngeren Fenster bleibt das bestehende Verhalten unverändert (Defizit-Vorschläge); der Care-Push kennt keine Ermutigungs-Situation (kein neuer Push-Text)
- `CareHint` rendert den Ermutigungs-Eintrag im bestehenden Status-Wrapper mit `KolAlert` (`_type="info"`, `_variant="card"`, `_label` wie bisher); er setzt keinen Nachrück-Cursor und zählt nicht als Ablehnung/Dismissal

### Randfälle & Fehler

| Situation                        | Erwartetes Verhalten                                                 |
| -------------------------------- | -------------------------------------------------------------------- |
| 2 Erledigungen, Anteil über 50 % | Kein `ueberlast`, Ermutigungs-Eintrag statt Erholungsvorschlägen     |
| 3 Erledigungen, Anteil über 50 % | Überlast wie bisher (Erholungsvorschläge, Überlast-Push)             |
| 0 Erledigungen                   | Bestehendes Verhalten (Defizit-Vorschläge), kein Ermutigungs-Eintrag |
| Ermutigungs-Eintrag angezeigt    | Keine Aktionen, kein Nachrücken, kein Dismissal — reiner Satz        |
