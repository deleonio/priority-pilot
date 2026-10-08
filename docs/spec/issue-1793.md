# Spec: Issue 1793 — Frontend: Fürsorge-Hinweis auf dem Dashboard

**Stand:** 2026-09-29 (Spec-Phase)
**Quellen:** Harness-Kommentar (KI-ANALYSE stand=2026-09-29T03:51:21Z, KI-UX), `docs/fuersorge-tonalitaet.md`, `docs/mobile-ui-rules.md`, Server-Vertrag #1791 (`GET /scores/care-suggestions`, `POST /scores/care-suggestions/dismissals`).

> **Ablöst:** Die Säulen-Beiträge dieser Spec (Ein-Säulen-Form, share 100) sind mit #2077 durch
> die Vollverteilung ersetzt — siehe `docs/spec/issue-2077.md`.

## Ziel

Ist eine Säule defizitär, zeigt das Dashboard oberhalb der Card „Nächste Aufgabe" genau einen Fürsorge-Hinweis mit drei Ein-Tap-Aktionen. Nur Frontend; kein Server-Umbau.

## Vertrag (Testsaum)

- Komponente `frontend/src/components/CareHint.tsx`, Export `CareHint`, ohne Pflicht-Props, lädt selbst (Muster `DayDoneHint`). Wurzel `data-testid="care-hint"`, `role="status"` mit `aria-label`.
- Client-Methoden in `frontend/src/api.ts`: `api.getCareSuggestions({ sprache?, signal? })` → `{ vorschlaege }`; `api.dismissCareSuggestion({ templateKey })`. Übernehmen nutzt vorhandenes `api.createTask({ taskCreate })` bzw. `api.updateTask({ id, taskUpdate })`.
- Buttons (zugängliche Namen): „Vorschlag übernehmen", „Nicht jetzt", „Vorschlag ablehnen"; Übernehmen zuerst im DOM.
- Angezeigt wird nur der erste Vorschlag; Text `<Säule> kam diese Woche zu kurz. <beschreibung>?`, Titel und Säulenname sichtbar.

## Schritte / erwartetes Ergebnis

| Schritt                    | Erwartung                                                                                                                                                                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Liste hat Einträge         | genau ein Hinweis (AK1), im DOM vor `.dashboard-next-task`                                                                                                                                                                                                 |
| Übernehmen, `typ: vorlage` | genau ein `createTask` mit Titel der Vorlage und `pillars: [{ pillarId: saeuleId, share: 100 }]`; Hinweis weg (AK2)                                                                                                                                        |
| Übernehmen, `typ: task`    | `updateTask({ id: taskId, taskUpdate: { status: 'In process' } })`; kein createTask; Hinweis weg (AK2)                                                                                                                                                     |
| Ablehnen, `typ: vorlage`   | genau ein `dismissCareSuggestion({ templateKey })`; Hinweis weg (AK3)                                                                                                                                                                                      |
| Ablehnen, `typ: task`      | kein Server-Call; 14 Tage lokal unterdrückt, auch nach Remount; danach wieder sichtbar (AK3)                                                                                                                                                               |
| Nicht jetzt                | kein Server-Call; bis Tagesende lokal unterdrückt, auch nach Remount; am Folgetag wieder sichtbar (AK4)                                                                                                                                                    |
| Leere Liste                | Rückmeldung „Gerade gibt es keinen Vorschlag für dich." ohne Buttons (AK5)                                                                                                                                                                                 |
| Zugänglichkeit             | `role="status"` mit Label, Bedeutung über Text (AK6)                                                                                                                                                                                                       |
| Ladefehler                 | nichts gerendert, kein Fehlerbanner (AK8)                                                                                                                                                                                                                  |
| Übernehmen scheitert (UX)  | Hinweis wieder sichtbar, Fehlermeldung `role="alert"`                                                                                                                                                                                                      |
| 375 px                     | kein horizontaler Überlauf, Buttons ≥ 44 px hoch (AK7, E2E, Bounding-Box); #2445: Übernehmen (inhaltsbreit), „Heute nicht“ (Uhr) und „Diesen Vorschlag nicht mehr“ (Papierkorb) in einer Zeile, Icon-Schalter `_hideLabel` mit Namen/Tooltip, ≥ 44 × 44 px |

## Nicht getestet

Nachrücken-Verbot, Fokusziel nach Verschwinden, Dark-Theme-Kontrast und Textbausteine aller zehn Sprachen: visuell/Review.
