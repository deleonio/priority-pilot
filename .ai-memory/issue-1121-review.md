# Issue 1121 — Review (Kreuzverhör Runde 1 + Fixup-Nachweis Runde 2), Stand 2026-08-29T13:03Z

**ERGEBNIS: VERDICT reviewed, Ampel 🟢.** PR #1123 (`feat(frontend): move geo badge next to task title (#1121)`), schließt #1121. Runde 1: Kreuzverhör, 1 fixabler Finding (doppelter Trenner gap+NBSP+gap) → needs-fixup. Runde 2: Fixup-Nachweis, Finding 1 behoben via `e6d51cbd`, keine neuen Probleme → reviewed. Sammelkommentar id 5462492269 aktualisiert (Review-Typ: Fixup-Nachweis).

## Erledigt
- Runde 1 (Kreuzverhör): AK1–AK7 aus Harness-Marker-Kommentar geprüft; DOM-Umzug GeoBadge `.task-tree-badges` → `.task-tree-row-header` hinter KolHeading korrekt, GeoBadge.tsx unangetastet (AK6), Badges unverändert (AK4), keine rohen NBSPs. Finding 1 (app.css:978) als inline Review + Sammelkommentar geposted → needs-fixup.
- Runde 2 (Fixup): Delta-Diff seit updatedAt 2026-08-29T12:47:03Z — nur `e6d51cbd` (Code) + Memory-Commits. `git diff f388572f e6d51cbd -- frontend/src/app.css`: `gap: var(--task-tree-row-gap)` → `gap: 0` + Kommentar (Z. 947-951), exakt der Review-Vorschlag. Header-Children verifiziert (`TaskTree.tsx:87-96`): nur KolHeading + NBSP + GeoBadge; ohne Geo nur KolHeading → gap:0 ohne Seiteneffekt. Einziger Konsument `TaskTree.tsx:87` (git grep). Keine neuen Findings → kein neuer inline Kommentar.
- CI auf head 88f01a57 beim Abschluss: verify/review/e2e 1-4 IN_PROGRESS, precheck SUCCESS, nichts rot (Gate-Step behandelt grünen Content-Verdict).
- Title Gate: Titel bereits Conventional-Commits-konform → kein Edit.

## Relevante Stellen
- `frontend/src/app.css:947-951` — gefixtes gap; 976-987 Titel-Flex 0 1 auto + `.task-tree-row-header .geo-badge { flex: none; }`.
- `frontend/src/components/TaskTree.tsx:87-96` — Header-Block (Titel + `{' '}` + GeoBadge); 108-128 Badge-Gruppe ohne GeoBadge.
- `frontend/e2e/issue-1121-geo-badge-title.spec.ts` — AK1-AK7; AK4 Bounding-Box, AK2/AK5 NBSP-Zählung, vom horizontalen gap unabhängig.

## Annahmen
- CI in_progress (nicht rot) zählt nicht als Blocker für 🟢 — Skill verbietet nur 🟢 bei rotem CI; der deterministische Gate/Auto-Merge-Step prüft die allowlisten-Checks.
- GATE-Protokoll im Fixup (format/lint/vitest/e2e exit 0) als Beleg akzeptiert, ohne selbst Tests zu fahren (Review-Tier: code-off-limits).

## Verworfen
- Erneutes Volldiff-Kreuzverhör — Fixup-Modus per Skill (Diff-Scoping).
- Neue inline Review-Kommentare — keine neuen Findings.
- `rm` der Wegwerf-Artefakte `/tmp/ai-review-1123.md` — außerhalb des Repos, unbedenklich.

## Offen
- —

## Nächster Schritt
- Keine. PR wartet auf grünes CI → Gate setzt `ai:ready-to-merge` und mergt automatisch.

## Fallstricke
- `gap: 0` ist nur sicher, weil der Header ausschließlich Titel+NBSP+Badge enthält — künftige Children in `.task-tree-row-header` brauchen wieder einen Abstand.
- Sammelkommentar-`updatedAt` ist die Delta-Basis für den Fixup-Modus; Memory-Commits auf dem Branch erzeugen Diff-Rauschen (`.ai-memory` ausklammern).
