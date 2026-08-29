# Issue/PR 1112 — Review (Runde 1 Kreuzverhör + Runde 2 Fixup-Nachweis), Stand 2026-08-29

**ERGEBNIS Runde 2: VERDICT reviewed, Ampel 🟢.** Modus: Fixup-Nachweis (Marker-Kommentar 5460790229 vorhanden, updatedAt 06:22:21Z < Fixup-Commit cf40d9a2 06:34:01Z). Original-Review war „ohne Issue" → PR-Beschreibung blieb massgebende Spec (keine AK-Verifikation möglich). Beide Findings behoben, kein neues Problem im Delta. Titel `fix(ci): gate-merge accepts skipping review checks` — Title-Gate erfüllt, kein Rename.

## Erledigt
- Runde 1 (Kreuzverhör, needs-fixup): F1 Inline-Kommentar 3885809186 @ :228 (Vakuum-`all` + fehlendes Label-Gating), F2 Inline-Kommentar 3885809187 @ :216 (Grammatik/Umlaut); Sammelkommentar 5460790229 erstellt; Titel zu Conventional-Commits-Englisch umbenannt.
- Runde 2 (Fixup-Nachweis): Delta-Review nur cf40d9a2 (einziger Commit seit updatedAt): F1 fix verifiziert — `reviewed_label` (`:233`) + `(length > 0) and all(…)` (`:234`), Bedingung `:235` verlangt beides; `labels` ab `:172` im selben Run-Block (quergeread, Zeilen 140–245) → Scope ok. F2 fix verifiziert — `:216` revertet auf „ohne den Filter", neuer Kommentar ae/oe/ue-konform. Keine neuen Befunde.
- Sammelkommentar 5460790229 per PATCH aktualisiert (Status reviewed, F1/F2 in Behobene-Anmerkungen-Tabelle, Review-Typ: Fixup-Nachweis) — 06:38:03Z bestätigt.

## Relevante Stellen
- `.github/workflows/claude-pr-gate-merge.yml:233-235` — fixer Skip-Akzeptanz-Block: Label-Check + Vakuum-Guard + Bedingung.
- `.github/workflows/claude-pr-gate-merge.yml:172` — `labels="$(echo "$pr_json" | jq -r '[.labels[].name? // empty]')"` — Quelle für `reviewed_label`, vor der Retry-Schleife im selben Run-Block.
- `.github/workflows/claude-pr-gate-merge.yml:216` — F2-Stelle (reverteter Kommentar).
- Sammelkommentar GitHub-ID 5460790229 — weitere Runden: per PATCH updaten, nie neu anlegen.

## Annahmen
- `labels`-Snapshot vor der Schleife reicht (Fixup-Notiz dokumentiert dasselbe; Merge-Zweig nutzt denselben Stand, pre-existing).
- CI-Allowlist-Checks zum Verdict-Zeitpunkt pending (review = dieser Lauf, e2e/verify liefen), nicht rot → content-🟢 zulässig; deterministisches Gate degradiert ohnehin bei Rot.

## Verworfen
- Thread-Auflösung F1/F2 (`resolveReviewThread`) — stand in der Fixup-Notiz als deren „Nächster Schritt", nicht im Review-Scope dieses Prompts; nicht ausgeführt.
- Neue Kreuzverhör des Voll-Diffs — Modus Fixup-Nachweis, Delta-Scoping greift.
- MEMORY.md-Eintrag — kein neues Fehlermuster.

## Offen
- Wegwerf-Artefakt `.ai-memory/issue-1112-collected.md` (Body-Datei fürs PATCH) — NICHT committen.

## Nächster Schritt
- Keiner review-seitig; Pipeline übernimmt (Gate/Merge entscheidet anhand CI/Reviewer-Checks).

## Fallstricke
- F1/F2-Nummern und Sammelkommentar-ID 5460790229 bleiben stabil, falls doch noch eine Runde kommt.
- Keine Labels setzen (Workflow).
