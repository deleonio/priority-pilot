# #2075 — Server: Rang-Regel als Spiegel und vollständige Fürsorge-Vorschläge

## Ziel

Der Server übernimmt die #2074-Rang-Regel als Spiegel und liefert Fürsorge-Vorschläge mit
vollständiger Verteilung über alle fünf Säulen — damit legt die unveränderte Übernahme
(CareHint → `POST /tasks`) Aufgaben an, die die strenge Prüfung (#2077) bestehen.

## Voraussetzungen

- Fünf Säulen sind fix (#1573); `roundSharesToTotal`/`evenShares` (Largest-Remainder,
  Gleichstand → Reihenfolge) bleiben die einzigen Rundungsbausteine — keine neue Rundungslogik.
- API-Vertrag `saeulenBeitraege: { pillarId, share }[]` bleibt unverändert; Task-Vorschläge
  (`typ: 'task'`) geben die Aufgaben-Verteilung 1:1 durch (bleiben unangetastet).

## Verträge

- **AK1 — `suggestRankedShares(ranks, count)`** in `server/src/logics/pillarShares.ts`
  (Nachfolger von `suggestMainShares`, das entfällt): `ranks` = Säulen-Indizes in
  Tipp-Reihenfolge (Rang 1 zuerst), `count` = Säulezahl. Angetippte Säulen erhalten
  50/20/15/10/5 in genau dieser Reihenfolge; nicht angetippte teilen den Rest gleichmäßig,
  ganzzahlig (vier Säulen über 50 % → 13/13/12/12 in Säulen-Reihenfolge); ohne angetippte
  Säule: Gleichverteilung; eine Säule → 100 %; `count <= 0` → `[]`. Summe exakt 100, jeder
  Anteil ≥ SHARE_MIN — dieselben Testfälle wie die #2074-Frontend-Regel.
- **AK2 — vollständige Fürsorge-Vorschläge:** `waehleCareVorschlaege` erhält die
  Nutzer-Säulenliste als 2. Parameter, `waehleErholungsVorschlaege` als 1. Parameter. Jeder
  Vorlagen- und Erholungsvorschlag trägt genau fünf `saeulenBeitraege`: Ziel-Säule 50 %,
  übrige vier gleichmäßig über die restlichen 50 % (13/13/12/12), ganzzahlig, Summe exakt
  100, jeder Anteil ≥ SHARE_MIN (5).
- **AK3 — unveränderte Übernahme:** `POST /tasks` mit dem gelieferten Payload legt einen
  Task mit exakt dieser Verteilung an (fünf Einträge, Summe 100, jeder ≥ 5).
- **AK4 — gleiche Form im KI-Pfad:** KI-Vorschläge (`typ: 'ki'`) haben dieselbe Form wie die
  Regelpfad-Vorschläge (inkl. Erholung).

## Testfälle

- TF1 (AK1, unit): `server/src/logics/pillarShares.test.ts` — ersetzt die 80/5-Blöcke
  (#1962): Treppe in Tipp-Reihenfolge, gedrehte Reihenfolge, 13/13/12/12-Rest (Ziel-Säule
  vorne und mittendrin), Gleichverteilung, degenerierte counts, Invarianten-Schleife 1–7 Säulen.
- TF2 (AK2, unit + API): `server/src/logics/careSuggestions.test.ts` (Ziel-Säule vorne und
  mittendrin, Task-Durchgriff, Erholungspfad) + `server/src/express/scores-care-suggestions.test.ts`
  (Überlast-Setup, Form-Assertion über Defizit- und Erholungsvorschläge).
- TF3 (AK4, API): `server/src/express/scores-care-suggestions-ki.test.ts` — dieselbe
  Form-Assertion für `typ: 'ki'`.
- TF4 (AK3): durch TF2/TF3 abgedeckt — der #1791-AK3-Test („Vorlagen-Payload per POST /tasks
  anlegbar") trägt jetzt die exakte Verteilungs-Übernahme als Assertion.
