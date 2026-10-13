# Einstieg statt Defizit-Vorwurf auf frischem Konto

**Stand:** 2026-10-13
**Ziel:** Ein Konto mit **0 Erledigungen** im jüngeren Fenster (frisches Konto) sieht unter „Nächste Aufgabe" und im Fürsorge-Hinweis einen einladenden Einstiegssatz statt „… kam diese Woche zu kurz". Ab `UEBERLAST_MINDEST_ERLEDIGUNGEN` Erledigungen bleibt das bisherige Verhalten unverändert; bei 1–2 Erledigungen gilt die bestehende Ermutigung aus #2521 (und die Defizit-Formulierungen bleiben ebenso unterdrückt — Issue-Regel „solange die Mindestmenge nicht erreicht ist").

## Journey: Frisches Konto → Einstieg statt „kam diese Woche zu kurz"

### Ziel

Die Fürsorge-Texte laden am Anfang ein, statt ein Defizit festzustellen. Der Einstieg steuert **nur den Wortlaut** — Score und Ranking (`normBalance`, `beitraege.balance`) bleiben unverändert.

### Vorbedingung

- Angemeldetes Konto mit Standard-Säulen; Erledigungen (`Done` mit `ScoreEntry.zeitpunkt`) im jüngeren 7-Tage-Fenster, kontoweit gezählt
- Mindestmenge: die exportierte Konstante `UEBERLAST_MINDEST_ERLEDIGUNGEN` aus `server/src/logics/careDeficit.ts` (ein Zählmuster, keine Kopien)

### Schritte

1. **„Nächste Aufgabe" (`GET /next`) unter der Mindestmenge**
   - `toReasons` liefert kein `reasons.balance`, sondern setzt das Einstieg-Signal `einstieg: true` (neuer optionaler Schlüssel in `TaskReasons`)
   - Das Dashboard rendert dafür den Satz aus `dashboard:reasons.einstieg` (de/en) statt des Balance-Satzes
   - Datenquelle: `find.ts` zählt kontoweit via `zaehleErledigungen` über die bereits geladenen ScoreEntries (`status Done`, `zeitpunkt`) — dieselbe Quelle wie die Care-Route
2. **Fürsorge-Hinweis (`GET /scores/care-suggestions`) unter der Mindestmenge**
   - Bei **0** Erledigungen: genau **ein** Eintrag mit `anlass: 'einstieg'` an erster Position (typ `vorlage`, `saeuleId: 0`, ohne `taskId`/`templateKey` — nichts zum Übernehmen oder Ablehnen); keine `defizit`-Einträge
   - Bei 1–2 Erledigungen: der Ermutigungs-Eintrag aus #2521 bleibt der sichtbare Eintrag; `defizit`-Einträge sind ebenfalls unterdrückt
   - Der `titel` des Einstieg-Eintrags kommt aus der neuen Konstante `CARE_EINSTIEG[sprache]` (neben `CARE_ERMUTIGUNG` in `careSuggestionData.ts`)
   - `CareHint` behandelt `einstieg` wie `ermutigung`: nur der Satz im Status-Wrapper, keine Aktionsreihe, keine Grundauswahl, kein Dismissal
3. **Kein KI-Beraterlauf unter der Mindestmenge**
   - `ermittleKiVorschlag` wird erst ab `UEBERLAST_MINDEST_ERLEDIGUNGEN` Erledigungen aufgerufen (Muster #1873: nur buchen, was angezeigt werden kann); auch bei 1–2 Erledigungen kein Aufruf
4. **Sprache**
   - Der Einstiegssatz existiert in de und en (Server-Konstante `CARE_EINSTIEG` und Locale-Schlüssel `dashboard:reasons.einstieg`), Ton nach `docs/fuersorge-tonalitaet.md` (kleinen Schritt anbieten, du-Form, kein Schuld-Vokabular, ein Gedanke)
   - Festgelegter Wortlaut (Spec-Entscheidung, beide Oberflächen textgleich):
     - **de:** „Such dir eine kleine Aufgabe aus, die dir heute guttut – klein anfangen zählt."
     - **en:** „Pick one small task that does you good today – starting small counts."
5. **Ab der Mindestmenge**
   - `reasons.balance` und Defizit-/Überlast-/KI-Verhalten wie bisher — kein Einstieg-Signal, kein Einstieg-Eintrag

### Erwartetes Ergebnis

- Kein frisches Konto sieht mehr „Säule … kam diese Woche zu kurz", bevor es überhaupt etwas erledigt hat
- `TaskReasons.einstieg?: true` ergänzt den Vertrag von `GET /next` additiv; Score, Ranking und `scoreBreakdown` bleiben unberührt
- Die Care-Antwort enthält unter der Mindestmenge keinen `defizit`-Eintrag mehr; sichtbar ist genau einer: `einstieg` (bei 0) oder `ermutigung` (bei 1–2)

### Randfälle & Fehler

| Situation                          | Erwartetes Verhalten                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| 0 Erledigungen, „Nächste Aufgabe"  | `reasons.einstieg: true`, kein `reasons.balance`, Einstiegssatz im Dashboard         |
| 0 Erledigungen, Care-Hinweis       | Genau ein `einstieg`-Eintrag vorn, keine `defizit`-Einträge, kein Beraterlauf        |
| 1–2 Erledigungen                   | `ermutigung` wie #2521, keine `defizit`-Einträge, kein Beraterlauf, kein `einstieg`  |
| ≥ `UEBERLAST_MINDEST_ERLEDIGUNGEN` | Altes Verhalten (`reasons.balance`, `defizit`/`ueberlast`/`ki`) ohne Einstieg-Signal |

## Testfälle (rote Spec-Tests)

- **TF1** `server/src/express/suggestions.test.ts`: frisches Konto + offene Aufgabe → kein `reasons.balance`, `einstieg === true` (AK1); ab `UEBERLAST_MINDEST_ERLEDIGUNGEN` verteilten Erledigungen → `reasons.balance.pillars` wie bisher, kein Einstieg-Signal (AK2).
- **TF2** `server/src/express/scores-care-suggestions.test.ts`: 0 Erledigungen → genau ein `einstieg`-Eintrag vorn, kein `defizit`/`ueberlast`, de/en-Sätze nach Wortlaut oben (AK1/AK4); ab `UEBERLAST_MINDEST_ERLEDIGUNGEN` (importiert, AK3) verteilten Erledigungen → `defizit` wie bisher, kein `einstieg` (AK2).
- **TF2b** `server/src/express/scores-care-suggestions-ki.test.ts`: Plus-Konto, Defizit, 0 Erledigungen → Berater 0×, kein `ki`-Vorschlag, keine Buchung (AK5).
- **TF3** `frontend/src/components/Dashboard.test.tsx`: `reasons.einstieg` → deutscher Einstiegssatz statt „kam diese Woche zu kurz"; Sprache en → englischer Satz (AK4).
- **TF4** `frontend/src/components/CareHint.test.tsx`: `anlass: 'einstieg'` → nur der Satz, keine Aktionsreihe/Grundauswahl, kein Dismissal (AK1).

### Test-Pflege (im Spec-PR umgestellt)

Unter der Mindestmenge liefern `/next` und die Care-Route kein `reasons.balance` bzw. keine `defizit`-Einträge mehr — Bestands-Tests, die das auf frischem Konto erwarten, bekommen die Mindestmenge an **verteilten** Erledigungen vorab (je 100 % auf verschiedene Säulen → keine Überlast, Säule 0 bleibt defizitär):

- `suggestions.test.ts` — #1985-AK1-Test (frische DB) und beide #2523-Sprach-Tests (frisches Konto)
- `scores-care-suggestions.test.ts` — #1791 AK1/AK2/AK3/AK4-api und #1795 AK3 („ohne Überlast")

Nicht berührt: `frontend/e2e/issue-1795-care-overload.spec.ts` (prüft bereits mit 3 Erledigungen die Abwesenheit von „zu kurz"); Dashboard-/CareHint-Tests injizieren `reasons`/`anlass` direkt und bleiben unverändert.
