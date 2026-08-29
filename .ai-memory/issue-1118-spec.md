# Issue 1118 — Spec (Phase 3), Stand 2026-08-29

## Erledigt
- Branch `ai/harness/1118` ausgecheckt (Resume-Hint beachtet; lokale untracked Duplikate der Phase-Notes vor dem Switch entfernt — die Branch-Versionen sind identisch im Kontext-Deckel).
- Spec `docs/spec/issue-1118.md` neu angelegt (AK1–AK9 + Testfälle TF1–TF9, KI-UX-Anforderungen eingearbeitet: Bounding-Box statt scrollWidth, `_level` Default 0, #930-Shadow-DOM-Klippe).
- Rote Unit-Tests in `frontend/src/components/Dashboard.test.tsx` (2 neue Tests im Describe „Dashboard — Sektionen als Kolibri-Cards (Issue #1118)" + umgeschriebener #440-Empty-State-Test): 3 rot, 12 bestehende grün (`pnpm --filter frontend exec vitest run src/components/Dashboard.test.tsx`).
- Rote E2E-Spec `frontend/e2e/issue-1118-dashboard-section-cards.spec.ts` (7 Tests, AK1–AK8). ESLint + Prettier grün; `tsc --noEmit` ohne Fehler.
- Commit + Push + Draft-PR (siehe git log); Labels nicht gesetzt (Workflow).
- Dedup geprüft: keine bestehenden Tests zu Cards je Sektion / Gleichhöhe; `issue-1042-*.spec.ts` prüft nur Button-Sizing, nicht Tastatur → AK8-Tastaturteil neu.

## Relevante Stellen
- `frontend/src/components/Dashboard.tsx:178,206,232,251,291,313` — die sechs Sektionen (noch bare `<section>` + `<h3>`); Umbauziel.
- `frontend/src/components/Dashboard.tsx:254-258` — „Keine Säulen vorhanden"-Card = Card-in-Card-Fall; contract jetzt: Hinweistext IN der Sektions-Card (SectionClass-Test zählt genau 1 kol-card).
- `frontend/src/app.css:1958-1983` (#930: kol-card transparent) + `:707-713` (`align-items: start`) — Impl-Hebel: stretch + `height:100%` NUR in der Media Query.
- `frontend/src/components/Dashboard.test.tsx:134-153` — umgeschriebener #440-Test (Test-Pflege-Bedarf, im PR-Body dokumentiert).
- `frontend/e2e/issue-1118-dashboard-section-cards.spec.ts` — Hilfsfunktionen `sectionCards` (Card-Host via `section.matches('kol-card') ? section : section.querySelector('kol-card')`) und `openDashboard(width,height)`; funktioniert für beide möglichen Umbauvarianten (Wrapper behält Klasse ODER Section wird selbst Card).

## Annahmen
- AK4 gilt laut KI-UX auch für den „Meine Themen"-Leerzustand (Analyse-AK4 nannte nur NearbyCard) — Spec und Tests so erweitert.
- AK6 „keine Karte künstlich gestreckt" ist bei einspaltigem Grid (height:100% = eigene Höhe) nicht falsifizierbar → als Bounding-Box-Enthaltung + Einspaltigkeit + Reihenfolge getestet; im PR-Body vermerkt.
- KoliBri reflektiert `_label`/`_level` als Host-Attribute (Präzedenz #440-Test liest `_label`-Attribut) — Label-Checks laufen darüber statt durch den Shadow-DOM.

## Verworfen
- AK9 als eigener Test — Gate deckt lint/test/format ab (Spec-Notiz im PR-Body).
- `scrollWidth`-Assertion (AK6-Wortlaut) — App-Shell clippt mit overflow-x:hidden, immer erfüllt (Memory 2026-08-24, KI-UX-Block bestätigt).
- AK8-Signalprüfung über `el.shadowRoot`-Walk — ESLint no-restricted-syntax verbietet Shadow-DOM-Introspection; stattdessen Raster-Abtastung via `document.elementFromPoint` gegen aufgelöstes `--pp-signal-wash`.
- Equal-Height nur für starre Paare (top-tasks|pillars) — stattdessen row-agnostisch: alle Cards gleicher Oberkante (±2 px) müssen gleich hoch sein, mind. eine zweispaltige Zeile als Guard gegen Vakuum-Pass.

## Offen
- E2E-Tests wurden NICHT lokal ausgeführt (kein Chromium-Install-Zyklus in der Restlaufzeit) — Rot-Begründung ist strukturell (0 kol-card pro Sektion → toHaveCount/evaluate schlagen fehl), nicht am Setup verifiziert. Risiko: AK8-Tastaturschleife (40× Tab) und `elementFromPoint`-Abtastung erst bei Impl verifizieren.

## Nächster Schritt
- Impl-Phase (Routing sonnet/high): Dashboard.tsx-Sektionen auf KolCard mit `_label`/`_level={3}` umstellen, `<h3>` entfernen, Region `aria-label`, „Keine Säulen vorhanden"-Card zur Text leeren; app.css stretch + Host-Passthrough nur ≥48rem, `grid-column: 1/-1`-Selektoren mitziehen, Signal-Wash gegen #930 (Token-Vererbung oder gescopete Ausnahme), dann rote Tests grün fahren.

## Fallstricke
- ESLint verbietet `shadowRoot`-Zugriff und kol-dialog-Selektoren in e2e (`no-restricted-syntax`) — Dialoge über `getByRole('dialog')`, Shadow-DOM nur über `elementFromPoint`/Host-Attribute.
- `onStartTask` = `openEdit` (App.tsx:613) — öffnet den Edit-Dialog, ändert NICHT den Status; AK8-„auslösbar" = Dialog sichtbar.
- `TOP_TASKS_LIMIT = 5` (Dashboard.tsx:51) — „3 vs 8 Einträge" aus dem Issue exakt so nicht erzeugbar; AK5 testet deshalb höhenagnostisch je Grid-Zeile (8 Deadlines gegen Nachbar-Karten).
- Bestehenden #440-Test nicht einfach löschen: er war der Card-in-Card-Vertrag — umgeschrieben + als Test-Pflege-Bedarf im PR-Body dokumentiert.
