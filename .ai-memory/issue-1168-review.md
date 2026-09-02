# Issue 1168 / PR #1170 — Review (Fixup-Nachweis, Runde 2), Stand 2026-09-02T13:40:18Z

**ERGEBNIS: VERDICT reviewed (🟢).** Marker `<!-- ai-review -->` vorhanden (Kommentar-ID 5506004907,updatedAt 2026-09-02T07:23:46Z) → Fixup-Verification, kein neues Kreuzverhör. Delta = Fixup-Commits a9f1be36 + 324fe706 (danach nur .ai-memory-Commits 24cd95eb/33f650a7, per `git show --stat` verifiziert). Beide Runde-1-Findings behoben wie vorgeschlagen; Runde-2-Härtung verifiziert; Sammelkommentar per PATCH in-place aktualisiert (Review-Typ: Fixup-Nachweis).

## Erledigt
- MODE-Bestimmung: Marker-Suche via `gh api issues/1170/comments` → 1 Treffer (ID 5506004907, 🟡 needs-fixup, 2 offene Findings).
- Fixup-Delta gelesen: `git diff 17490bdc..33f650a7 -- frontend/` (nur `issue-1168-dashboard-done-button.spec.ts` + `CompleteTaskDialog.tsx`).
- Finding 1 verifiziert: TF3-Seeds `9/5` → `5/2` (spec.ts:58-59) — entspricht exakt dem Runde-1-Vorschlag.
- Finding 2 verifiziert: TF6-Mock `'PUT'` → `'PATCH'` (spec.ts:119) — entspricht exakt dem Vorschlag.
- Runde-2-Härtung verifiziert (aus CI-Rot auf 78f2c8e9 entstanden, Details in `issue-1168-fixup.md`):
  - TF3-Locator-Scope: `.dashboard-next-task-content` existiert (`Dashboard.tsx:193`), `.modal-body` existiert (`Modal.tsx:159`) — Light-DOM-Anchor, umgeht die KolDialog-Shadow-DOM/textContent-Falle.
  - TF6: KolAlert in `<div role="alert">` gewrappt (`CompleteTaskDialog.tsx:57-63`), Vorbild `App.tsx:599,606` (dort 2× `role="alert"` per grep bestätigt); Test assertet `getByRole('alert')` sichtbar + Dialog offen + Status `Open`.
- Testsubstanz geprüft: TF3 pollt `taskStatus(firstId).toBe('Done')` + nächste Aufgabe ohne Reload (AK5); TF4/TF5-Seeds ≤5. Keine tautologischen Tests.
- Kein neues Finding im Delta; keine Inline-Review-Kommentare nötig (Threads aus Runde 1 vom Fixup aufgelöst).
- Titel-Gate: `feat(frontend): replace dashboard start button with done dialog` — konform (lowercase, Englisch, ≤72), kein Rename.
- Sammelkommentar 5506004907 per `gh api --method PATCH … -F body=@<file>` aktualisiert: 🟢 reviewed, Behobene-Anmerkungen-Tabelle (Findings 1+2 → a9f1be36), Footer `Review-Typ: Fixup-Nachweis`.

## Relevante Stellen
- `frontend/e2e/issue-1168-dashboard-done-button.spec.ts:58-59,119,62-71` — beide Fixes + gescopte Assertions.
- `frontend/src/components/CompleteTaskDialog.tsx:57-63` — role="alert"-Wrapper.
- `frontend/src/components/Dashboard.tsx:193` / `frontend/src/components/Modal.tsx:159` — die e2e-Anchor-Klassen.
- `frontend/src/App.tsx:599,606` — role="alert"-Vorbild.
- `.ai-memory/issue-1168-fixup.md` — Fixup-Protokoll beider Runden (CI-Run-Belege: 324fe706 grün, Run 33635957687).

## Annahmen
- CI auf HEAD (33f650a7) war beim Review noch `pending`; da die einzigen Commits nach 324fe706 nur .ai-memory-Dateien berühren, ist der grüne Run auf 324fe706 für den Codezustand repräsentativ. pending ≠ rot → 🟢 zulässig (gate-merge prüft CI zusätzlich).
- Fixup-Notiz-Aussagen (CI grün auf 324fe706, lokale 4/4 grün) nicht selbst reproduziert — durch Commit-Metadaten + Codeinspektion plausibilisiert.

## Verworfen
- Neues Kreuzverhör des ganzen PR-Diffs — MODE Fixup-Verification verbietet es (Skill Schritt 5, Diff-Scoping).
- MEMORY.md-Eintrag — kein neuer Fehler/Experience (knip- und Locator-Learnings stehen dort bereits vom 2026-09-02 aus dem Fixup-Lauf); Aufnahmekriterium nicht erfüllt.
- Nachbesserung am nackten KolAlert in `ConfirmDeleteDialog.tsx:96` (dasselbe fehlende role="alert") — außerhalb des PR-Diffs, in Fixup-Notiz als Scope-Grenze dokumentiert.

## Offen
- `.ai-memory/issue-1168-review-round2.md` (Body-Datei für den PATCH) ist Wegwerf-Artefakt — NICHT committen; `rm` braucht Freigabe (Muster früherer Läufe).

## Nächster Schritt
- Keiner für diese Phase. Workflow übernimmt: gate-merge prüft CI auf HEAD und setzt `ai:ready-to-merge`, sobald e2e/verify grün sind.

## Fallstricke
- Sammelkommentar NIE neu anlegen, solange ID 5506004907 existiert — immer PATCH (Marker-Suche zuerst).
- e2e-Dialoginhalts-Assertions: `.modal-body` (Light DOM) nehmen, nicht `getByRole('dialog')` — Shadow-DOM-textContent-Falle (KolDialog schlottet Kinder, eigener textContent bleibt leer).
- Nacktes `KolAlert` exponiert keine alert-Rolle — Fehler-Assertions brauchen den `role="alert"`-Wrapper (auch relevant für ConfirmDeleteDialog, falls je angefasst).
