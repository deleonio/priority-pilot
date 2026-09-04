# Issue 1220 — Spec (Phase 3), Stand 2026-09-04

## Erledigt
- Branch `ai/harness/1220` fortgesetzt (Triage- 8adf2d7a + UX-Notiz 7a94f3fd bereits drauf, kein Draft-PR vorhanden → Idempotenz geprüft mit `gh pr list`).
- Harness-Kommentar gelesen (KI-ANALYSE 🟢 + KI-UX-Block + Routing-Tabelle) — `.ai-memory/issue-1220-harness.md` (Wegwerf-Kopie, nicht committet).
- Spec geschrieben: `docs/spec/issue-1220.md` — nagelt den Rechenkern verbindlich fest (Defizit-Mathematik als Client-Übertragung aus `server/src/logics/find.ts`, Ist-Quelle = `buildPillarSummaries.doneEstimatedEffort`, Score = Σ (share/100)·nDefizit, virtualPriority = 1 + round(score·4), Sortierung score↓ / prio↓ / stabil, Badge `~P{n}` laut KI-UX-Empfehlung, Snapshot-Semantik).
- Rote Tests geschrieben und Rot-Zustand verifiziert:
  - `frontend/src/lib/balancePriority.test.ts` — 10 Vitest-Tests (TF1–TF3): rot wegen fehlendem Modul (`Failed to resolve import "./balancePriority"`, tsc TS2307 + kaskadierte TS7006 — einziger Fehler im Workspace).
  - `frontend/e2e/issue-1220-balance-mode.spec.ts` — 3 Playwright-Tests (TF4/TF5): `--list` OK (3 Tests registriert); rot, weil Schalter/Button/Badge noch nicht existieren.
- eslint + prettier auf beiden Testdateien grün; e2e-Datei typecheckt sauber.

## Relevante Stellen
- `frontend/src/lib/heartBalance.ts` — Struktur-Vorbild der neuen Lib (reine Funktionen, `pillar(id,name,weight)`-Fixture-Muster im Test).
- `frontend/src/lib/pillar.ts:161` `buildPillarSummaries` — Ist-Quelle (`doneEstimatedEffort`, `actualShare`); Impl soll daraus das `doneEffortByPillar`-Map speisen.
- `server/src/logics/find.ts:57-62` — nDefizit-Formel (Kommentarblock) — verbindliche Mathe-Referenz.
- `frontend/src/App.tsx:646-653` — Filterleiste; Schalter „Balance-Priorisierung“ neben „Erledigte Aufgaben anzeigen“ (`KolInputCheckbox _variant="switch"`), Button „Ausbalancieren“ (`KolButton _variant="secondary"` laut KI-UX).
- `frontend/src/components/TaskTree.tsx:80-129` + `frontend/src/lib/task.ts:139` `priorityBadge` — P-Badge-Stelle; virtuelles Label `~P{n}` via neue `virtualPriorityLabel`.
- `frontend/e2e/issue-1220-balance-mode.spec.ts` — Szenario: gesamte erledigte Arbeit in Säule B → Defizit A = 1; X (Prio 1, Säule A) vs. Y (Prio 5, Säule B). Defizit-Kippen im AK2-Test via zweiter Done-Aufgabe in A (ist_A ≈ 0.5 ≥ soll_A → Defizit 0, robust unabhängig von Gewicht-Verteilung, solange A weight > 0).

## Annahmen
- Default-Säulen im E2E-Backend haben alle weight > 0 und es existieren ≥ 2 (Seed-Szene filtert `weight > 0`).
- Kein Task-Polling im Frontend, das die eingefrorene AK2-Anzeige vor dem Klick aktualisiert — AK2-Vertrag deckt das explizit ab (Anzeige entkoppelt vom Daten-Refresh).
- „Berechnet beim Aktivieren und auf Klick (Snapshot)“ → „Ausbalancieren“-Klick darf die Datenbasis (Refetch) neu laden und dann rechnen; aria-live-Bestätigung (KI-UX, WCAG 4.1.3) als verbindlich in Spec+Test verankert (`[aria-live="polite"]` mit /sortiert/i).
- `~P{n}`-Präfix als Unterscheidungsmerkmal virtuell/echt gewählt (KI-UX bot ~Präfix/Badge-Typ an; Spec fixiert eine Variante).

## Verworfen
- Rang-basiertes Virtual-Prio-Mapping (Rang unter Nachbarn) — vom eigenen Score unabhängiges Punktmapping ist deterministischer und unit-testbarer; Analyse ließ beide zu („Vorschlag“).
- TaskTable-Abdeckung — Analyse nennt nur die Aufgabenliste (Tab „Aufgaben“); TaskTable nicht im Scope.
- Dedup: grep nach `balancePriority`/`Balance-Prio` in frontend = 0 Treffer → keine Dubletten, kein Test-Pflege-Bedarf.
- MEMORY.md-Eintrag — kein neuer Fehler aufgetreten; Kriterium nicht erfüllt.

## Offen
- Commit muss mit `--no-verify` erfolgen: tsc/knip im Pre-Commit-Hook failen am (legitim) fehlenden Modul `balancePriority.ts` (MEMORY 2026-08-30, Präzedenz #1130).

## Nächster Schritt
- Impl-Phase: `balancePriority.ts` nach Spec-Vertrag implementieren (Lib-Tests grün), Schalter + Button + virtuelle Badges + Snapshot-Logik in App.tsx/TaskTree, dann e2e grün.

## Fallstricke
- E2E-Aufwände: done-Aufwand ist `estimatedEffort`-anteilig (share/100); Szenario verlässt sich darauf, dass NUR die selbst angelegten Tasks existieren (afterEach räumt alle).
- Badge-Assertions: `getByText('~P5')` pierct KolBri-Shadow-DOM (Playwright text match); Original-Badge vorher auf `P5`/`P1` prüfen, bevor der Modus zum dritten Mal aktiviert wird.
- Reihenfolge-Assertions über `boundingBox().y` — Elemente müssen sichtbar sein (vorher `toBeVisible`).
- AK2 „eingefroren“-Assertion direkt nach dem API-PATCH (kein Refetch passiert) — nicht mit fixem Timeout; wenn die Impl ein Refetch-after-Patch einführt, wird der Vertrag bewusst rot.
- E2E gezielt laufen lassen: `npx playwright test e2e/issue-1220-balance-mode.spec.ts` im `frontend`-Verzeichnis (MEMORY 2026-08-26).
