# Issue 1183 — Review (Phase 5, Kreuzverhör Runde 1), Stand 2026-09-03

**ERGEBNIS: needs-fixup (🟡).** Kein `<!-- ai-review -->`-Kommentar vorhanden → MODE Kreuzverehr (Initial). Genau 1 fixables Finding (F1, Regression außerhalb des Diffs). Review 5096450985 gepostet (Inline-Kommentar auf `frontend/src/lib/confetti.ts:85`), Sammelkommentar neu angelegt (id 5518226930). PR-Titel auf Conventional Commits umbenannt: „feat(frontend): master switch for animations (confetti default off)". Labels nicht angefasst.

## Erledigt
- MODE bestimmt (Marker-Suche leer → Kreuzverhör), Harness-Kommentar #1183 geladen (AK1–AK5, `.ai-memory/issue-1183-harness.md`), kompletter Diff gelesen (`.ai-memory/issue-1183-pr-diff.txt`, 562+/3−).
- Trennung der Pflichten verifiziert: `git diff 820dd1a2 HEAD -- <5 Testdateien>` zeigt NUR Prettier-Zeilen_umbruch, keine Assertion verändert/weggelassen.
- Blast-Radius an recherche/haiku delegiert: `launchConfetti`-Aufrufer = App.tsx:404 + **:452 (#1182-Dashboard-Pfad!)**; #1151-Reihenfolge-Test ordnungs-, nicht nachbarstellungssensitiv → Schalter-Einbau unkritisch.
- F1 verifiziert durch Lesen von `frontend/e2e/issue-1182-dashboard-confetti.spec.ts`: AK1 `:78` + AK4 `:105` erwarten Overlay, kein Key-Preset, Datei NICHT im PR-Diff → bricht mit Default aus.
- Review + Sammelkommentar gepostet, Titel-Gate ausgeführt.

## Relevante Stellen
- `frontend/src/lib/confetti.ts:85` — neues Master-Gate nach reduced-motion-Frühcheck (Anker des Inline-Findings).
- `frontend/e2e/issue-1182-dashboard-confetti.spec.ts:78,105` — die beiden brechenden Overlay-Assertionen (F1).
- `frontend/e2e/issue-1169-confetti.spec.ts` beforeEach-addInitScript — Fix-Muster für F1.
- `frontend/src/App.tsx:404,452` — beide launchConfetti-Aufrufer (Listen-Pfad + Dashboard-Dialog-Pfad), beide vom Gate erfasst (gewollt).
- Sammelkommentar id 5518226930, Review id 5096450985 — für Fixup-Runde via Marker wiederfinden.

## Annahmen
- CI-e2e-Shards waren zum Review-Zeitpunkt pending; F1 rot-Vorhersage basiert auf Codelesung (Gate-Default schlägt durch, kein Mock im 1182-Spec), nicht auf gesehener CI-Rot-Fahne.
- AK4 nur Unit-abgedeckt ist Spec-Vertrag (Test-Abdeckungstabelle in docs/spec/issue-1183.md) — kein Finding.

## Verworfen
- Weitere Findings: waitForTimeout(1_000)-Negative-Assertion im 1183-E2E (pragmatisch, Muster wie 1182-Spec), STORAGE_KEY-Literal-Duplikat in Tests (knip-konform dokumentiert), fehlende AK4-E2E (Spec-Vertrag) — jeweils kein Meldewert.
- MEMORY.md-Eintrag zum F1-Muster → DOCH aufgenommen (siehe unten), weil übertragbar auf alle Phasen mit Koppel-Symbolen.

## Offen
- F1 wartet auf Fixup (Label-Steuerung übernimmt der Workflow; ich setze keine Labels).
- Wegwerf-Artefakte NICHT committen: `issue-1183-harness.md`, `issue-1183-pr-diff.txt`, `issue-1183-review-payload.json`, `issue-1183-collected.md`. Nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- Fixup-Runde (MODE Fixup-Nachweis): nur F1 prüfen — beforeEach-addInitScript in issue-1182-dashboard-confetti.spec.ts, CI-e2e grün, dann Sammelkommentar 5518226930 updaten (F1 → „Behobene Anmerkungen", Review-Typ: Fixup-Nachweis) und VERDICT reviewed.

## Fallstricke
- Fixup darf die reduce-Ausnahme NICHT bekommen: 1182-Spec AK3 bleibt ohne Key-Preset-Veränderung nötig? Nein — AK3 braucht kein Key-Preset (erwartet kein Overlay), aber das neue beforeEach gilt auch für AK3; harmlos, da reduce ohnehin unterdrückt. Aussage im Sammelkommentar ist korrekt.
- Sammelkommentar UPDATEN (PATCH auf 5518226930), nicht neu anlegen; Finding-Nummer F1 stabil halten.
- Keine Labels setzen (Workflow-Automatik).
- Review-Inline-Kommentar kann in der Fixup-Runde nicht „getickt" werden — Fortschritt nur im Sammelkommentar führen.
