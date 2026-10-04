# Server: Nacharbeiten Säulenverteilung aus #2076/#2077 (Issue 2152)

**Stand:** 2026-10-04

## Ziel

Drei abgegrenzte Nacharbeiten aus #2076/#2077: Der Feedback-Endpoint validiert den optionalen
Anteil gegen die dokumentierten Grenzen 5–80 (statt nur den Typ zu prüfen); die Handover-Auffüllung
scheitert laut statt still Zeilen mit Anteil 0 zu schreiben; der Auffüllblock liegt genau einmal in
einem logics-Helfer, den beide Übergabe-Routen aufrufen. Der Kopfkommentar der Demo-Seed-Tests
beschreibt den Ist-Stand.

## Voraussetzungen

- Konto mit mindestens einer Säule (Feedback-Endpoint nimmt nur `pillarId`s der eigenen Säulen an).
- Anteils-Grenzen: `SHARE_MIN` = 5, Obergrenze 80 (`logics/pillarShares.ts` bzw.
  `logics/pillarContributions.ts`) — dieselben Grenzen, die `openapi.yml` für den Feedback-Anteil
  dokumentiert und die `validatePillars` bereits durchsetzt.
- `share` bleibt optional: Alt-Clients ohne Anteil bleiben gültig (#2076).

## Schritte und erwartetes Ergebnis

### AK1 — Feedback mit Anteil außerhalb 5–80 → 400

`POST /tasks/suggest-pillars/feedback` antwortet mit HTTP 400, wenn ein `share` unterhalb 5
(z. B. 4) oder oberhalb 80 (z. B. 81) geschickt wird. Die Grenzen sind inklusive: `share: 5` und
`share: 80` werden weiterhin mit 201 angenommen und gespeichert. `share` ohne Wert (Alt-Client)
bleibt gültig. Damit deckt die Route das ein, was `openapi.yml` (Anteil 5–80) und das
`validatePillars`-Muster bereits vorgeben — die Few-Shot-Beispiele enthalten danach nur noch
gültige Anteile.

### AK2 — Handover-Auffüllung: lautender Fehler bei gekürzter Verteilung

Der gemeinsame Auffüll-Helfer `buildHandoverRows` (in `logics/pillarContributions.ts`) wirft einen
lautenden Fehler, wenn die verteilte Anteils-Liste kürzer ist als die Empfänger-Säulen-Liste,
statt stille Zeilen mit Anteil 0 zu schreiben (früher `shares[index] ?? 0`).

Vertrag: Basisanteile kommen aus `remapped` (fehlend → 0), die Verteilung liefert standardmäßig
`distributeWithMinimum`, ist aber als Parameter injizierbar — genau dieser Seam macht den
Kürzungsfall im Test erzwingbar. Der Zeilenaufbau bleibt über einen `buildRow`-Callback bei der
Route (TaskPillar vs. SeriesPillar: `taskId`/`seriesId`, Model bei destroy/bulkCreate).

### AK3 — Auffüllblock genau einmal

Der Auffüllblock (remapped → Verteilung → Zeilen) liegt genau einmal im logics-Helfer; `tasks.ts`
und `series.ts` rufen ihn auf. Das Übergabeverhalten ändert sich nicht: die bestehenden #2077-AK4-
Tests (`tasks-handover.test.ts` „Übergabe füllt die Verteilung beim Empfänger zu einer gültigen
Vollverteilung auf“, `series-handover.test.ts` analog) bleiben grün. Abdeckung ist damit bereits
vorhanden — keine neuen Tests für AK3 (Dedup).

### AK4 — Kopfkommentar der Demo-Seed-Tests beschreibt den Ist-Stand

Der Kommentar am Kopf von `logics/demoSeed.test.ts` (Zeilen 8–13) beschreibt den aktuellen Stand
(Modul `logics/demoSeed.ts` existiert, Tests sind grün), nicht mehr den Rot-Spec-Zustand von
#2077. Reine Kommentaränderung — kein Testfall, Prüfung im Review (kein Test für Kommentare,
ADR 0001).

## Testmatrix

| AK  | Test                                                                                                               | Datei                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| AK1 | share 4 → 400, share 81 → 400, share 5 → 201, share 80 → 201                                                       | `server/src/express/suggest-pillars.test.ts` (describe `POST /tasks/suggest-pillars/feedback`) |
| AK2 | gekürzte Verteilung → Wurf statt share-0-Zeilen; Happy Path: Vollverteilung, kein 0-Anteil, confidence-Default 100 | `server/src/logics/pillarContributions.test.ts` (describe `buildHandoverRows`)                 |
| AK3 | bestehende Handover-Tests bleiben grün (Dedup, kein Duplikat)                                                      | `server/src/express/tasks-handover.test.ts`, `server/src/express/series-handover.test.ts`      |
| AK4 | kein Test (Kommentaränderung)                                                                                      | —                                                                                              |
