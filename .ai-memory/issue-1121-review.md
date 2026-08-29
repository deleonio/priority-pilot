# Issue 1121 — Review (Phase 5), Stand 2026-08-29T12:47Z

**ERGEBNIS: VERDICT needs-fixup, Ampel 🟡 (Kreuzverhör, Runde 1).** Review 5058096379 (1 Inline-Finding auf `frontend/src/app.css:978`), Sammelkommentar mit `<!-- ai-review -->` = issuecomment-5462492269. PR-Titel wg. TITLE GATE umbenannt: „feat(frontend): move geo badge next to task title (#1121)“ (vorher ohne Conventional-Commits-Type).

## Erledigt
- MODE = Kreuzverhör (kein ai-review-Marker auf PR 1123 vor diesem Lauf); Closing-Issue #1121 vorhanden, AK1-AK7 aus dem Harness-Marker-Kommentar gelesen.
- Trennung Spec/Impl verifiziert: `git diff 152058b6 97980b0a` (rot→grün) berührt nur TaskTree.tsx + app.css + neue Phasen-Notiz — Spec-Tests unverändert grün gemacht.
- Blast-Radius (haiku/recherche): `.task-tree-title`/`.task-tree-row-header` nur in `LeafItem` (TaskTree.tsx:87-88), keine anderen Konsumenten; kein Alt-Test erwartet geo-badge in `.task-tree-badges`; `.geo-badge`-Klasse an GeoBadge.tsx:86 → `.task-tree-row-header .geo-badge { flex: none }` (app.css:984) greift auf den Host.
- Finding 1 gepostet: `.task-tree-row-header` `gap` (0.5rem) + U+00A0 + `gap` = ≈21px statt „unmittelbar hinter dem Titeltext“; Vorbild `done-title-cell` (app.css:1347) trennt mit 0.25rem ohne NBSP. Vorschlag: `gap: 0` (Header enthält nur Titel + NBSP + Badge).
- Sonst geprüft, unauffällig: AK1-AK7-Abdeckung durch die 5 e2e-Tests (AK6/AK7 Dedup über issue-1063, im PR-Body begründet), kein rohes NBSP im Quelltext (impl-Notiz: grep C2 A0 = 0), CI/e2e grün im PR-Body dokumentiert, `--task-tree-row-gap` = `--pp-gap-tight` = 0.5rem (app.css:920,118).

## Relevante Stellen
- `frontend/src/components/TaskTree.tsx:88-95` — neue Header-Blöcke (KolHeading + Fragment mit `{' '}` + GeoBadge); alter GeoBadge-Block aus `.task-tree-badges` entfernt (jetzt Z.108 ff.).
- `frontend/src/app.css:950` — `gap: var(--task-tree-row-gap)` im Header = Ursache des Findings.
- `frontend/src/app.css:978,984-986` — `flex: 0 1 auto` + neue `flex: none`-Regel (Anker der Inline-Review: 978).
- `frontend/e2e/issue-1121-geo-badge-title.spec.ts` — Spec-Vertrag (5 Tests, AK1-AK5), unverändert seit rotem Commit.
- `frontend/src/components/CompletedTasksTable.tsx:121-136` + `app.css:1345-1353` — `done-title-cell`-Vorbild (gap 0.25rem, kein NBSP).

## Annahmen
- Fixup folgt der „gap: 0“-Variante; e2e-Tests sind von der reinen CSS-Gap-Änderung nicht betroffen (AK2 misst Struktur + Bounding-Box-Überlappung, nicht Pixelabstände).
- CI (verify/e2e) war beim Review-Lauf pending; GATE-Angaben im PR-Body als Beleg genommen.

## Verworfen
- needs-human — Finding 1 ist eine 1-Zeilen-CSS-Änderung, kein Produktentscheid.
- KoliBri-Finding — kein Custom-Widget neu gebaut; KolBadge/KolHeading weiterhin, NBSP-Trenner ist im Analyse-Block als Randbedingung vorgegeben.
- Test-Pflege-Bedarf — keine Alt-Tests obsolet (issue-1063 row-scoped, überlebt den Umzug).
- `badgeBeforeControls`-Weakness (`controls === null` → true) im Test als eigenes Finding — Zeile hat immer Controls, Tautologie-Risiko zu gering.

## Offen
- —

## Nächster Schritt
- Fixup-Verifikation (nächster Review-Lauf nach Fixup-Push): nur prüfen, ob `gap` zwischen Titel und Icon auf 0 ist (app.css `.task-tree-row-header` bzw. `.task-tree-row-header .geo-badge`) und e2e AK1-AK5 grün bleibt; Finding 1 in „Behobene Anmerkungen“ schieben.

## Fallstricke
- **NBSP-Swap betrifft auch Review-Texte**: Das Harness-Tooling ersetzt `{' '}`-Absichten in HEREDOCS/Write-Inhalten durch ein rohes NBSP (C2 A0) — gepostete GitHub-Kommentare müssen danach per `python3`-Replace korrigiert werden (hier bei Inline-Kommentar 3886614318 und Sammelkommentar 5462492269 nötig gewesen; `grep -o "{'" ...`/repr prüfen).
- `gh pr edit` kennt kein `--json` (Title-Gate nur mit `-t`).
- Review-Posting mit `-f 'comments[][line]=978'` scheitert (String statt Zahl) → JSON-Payload via `--input` + `python3 json.dumps`.
- `.ai-memory/MEMORY.md` und `issue-1121-{triage,spec,implement}.md` sind Teil des PR-Diffs (committed) — Review darf sie nicht anfassen.
