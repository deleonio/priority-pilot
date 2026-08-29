# Issue/PR 1112 — Fixup (Runde 1), Stand 2026-08-29

**Kontext:** Review (Kreuzverhör, Runde 1) lieferte 2 Findings (Inline-Kommentare 3885809186 = F1 @ Zeile 228, 3885809187 = F2 @ Zeile 216), Verdict needs-fixup. Beide UNAMBIGUOUS → beide gefixt. KEINE Entscheidungs-Findings → KEIN ai-fixup-decisions-Kommentar, KEIN needs-human-Verdict.

## Erledigt
- **F1** (`.github/workflows/claude-pr-gate-merge.yml`, Block ab Zeile 224): Skip-Akzeptanz jetzt doppelt abgesichert —
  - `reviewed_label="$(echo "$labels" | jq -r 'any(.[]; . == "ai:reviewed")')"` (`labels` steht ab Zeile 172 zur Verfügung) und
  - `review_skipping="$(echo "$review_checks" | jq -r '(length > 0) and all(.[]; .bucket == "skipping")')"` (Vakuum-true bei leerer Liste ausgeschlossen),
  - `if [ "$has_review" != "true" ] && [ "$reviewed_label" = "true" ] && [ "$review_skipping" = "true" ]`.
  - jq-Logik am Runner gegenprobt: `[]`→false, `[skipping]`→true, `[pending]`→true-Verweigerung (false), `[skipping,skipping]`→true. YAML parst (`python3 yaml.safe_load`).
- **F2** (Zeile 216): Kommentar „ohne dem Filter" → „ohne den Filter" zurückgesetzt; neuer Kommentarblock auf ae/oe/ue konform („Fix fuer", „skipping", „darueber").
- Empirische Klärung der offenen Review-Annahme: `gh pr checks 1112 --json` LISTET geskippte Review-Jobs (`{"bucket":"skipping","name":"review","workflow":"5/6 Review"}` verifiziert am 2026-08-29). Damit sind skipping-Einträge sichtbar → `length > 0` ist SAFE und der PR-Body („liegen im Bucket skipping") ist korrekt — PR-Body NICHT geändert. Konsequenz: mit gelistetem skipping-Eintrag ist `has_review` schon vorher true; der Block ist damit ein No-Op in der Happy-Path-Welt und greift nur als Schutz, falls Checks unvollständig gelistet sind. Genau die vom Review geforderte Mindestabsicherung.
- Gate per gate-runner (SKILL 3c) vor Commit — Ergebnis im Commit dokumentiert.
- CI-Seitig: `e2e (2)` rot (Run 33238074080) — thematisch unrelated (CI-only-Workflow-Änderung, kein Frontend-Code im PR); Logs nicht als Fix-Ziel verfolgt. Kein Rerun angestoßen (der Fixup-Push triggert einen frischen Run).

## Relevante Stellen
- `.github/workflows/claude-pr-gate-merge.yml:216` — F2-Kommentarzeile (revertet).
- `.github/workflows/claude-pr-gate-merge.yml:224-237` — neuer Skip-Akzeptanz-Block (F1).
- `.github/workflows/claude-pr-gate-merge.yml:172` — `labels`-Quelle für `reviewed_label`.
- `.github/workflows/claude-pr-gate-merge.yml:~340` — Merge-Zweig verlangt ai:reviewed unabhängig (Label-Gating im Loop konsistent damit).

## Annahmen
- skipping-Einträge erscheinen in `gh pr checks --json` (am aktuellen PR verifiziert) — daher `length > 0` ohne Funktionsverlust des ursprünglichen Fixes.
- `labels` im Loop-Stand (vor der Schleife geholt, Zeile 144/151/172) reicht: ai:reviewed wird nur von Review-Transitions entfernt, ein Loop-Lauf dauert < 30 s; der Merge-Zweig nutzt denselben Stand (pre-existing Verhalten, nicht Teil des Findings).

## Verworfen
- `length > 0` weglassen (nur Label-Gating) — Review nannte es als Alternative, aber da skipping-Einträge nachweislich gelistet werden, ist die schärfere Variante SAFE und deckt zusätzlich den unvollständige-Liste-Fall.
- PR-Body-Korrektur („liegen im Bucket skipping") — durch die jq-Empirie widerlegt (Body stimmt).
- Umfangreicheres Umstellen (pr_json im Loop refreshen) — über den Finding-Scope hinaus, pre-existing Verhalten.

## Offen
- Wegwerf-Artefakt: keine. Diese Datei ist die Phasen-Notiz und wird MIT committet (ADR 0007).

## Nächster Schritt
- Nach Push: Fixup-Nachweis-Review abwarten (Review-Typ: Fixup-Nachweis, Sammelkommentar-ID 5460790229 per PATCH updaten, NICHT neu erstellen); Threads F1/F2 auflösen (`resolveReviewThread(input:{threadId})`).

## Fallstricke
- Sammelkommentar 5460790229 per PATCH updaten, nicht neu anlegen.
- Finding-Nummern F1/F2 stabil halten.
- Keine Labels setzen (Workflow macht das).
- `gh pr checks --json`-Empirie: skipping-Checks SIND gelistet — wer trotzdem `length > 0` weglässt, öffnet die Vakuum-Lücke wieder.
