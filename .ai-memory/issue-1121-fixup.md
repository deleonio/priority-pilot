# Issue 1121 — Fixup (Runde 1), Stand 2026-08-29

## Erledigt
- Befundlage gelesen: ai-review-Kommentar (needs-fixup, Runde 1) enthält GENAU 1 offenes Finding (🟡 Finding 1, doppelter Trenner app.css:978); 1 inline review thread (id 3886614318, app.css:978); CI komplett grün (verify + e2e 1–4 pass). Keine Entscheidungs-Findings.
- Finding 1 als eindeutig fixbar eingestuft (Review liefert konkreten Patch + empfiehlt Variante 1 „gap: 0" explizit als die klarere Lösung) → umgesetzt.
- Fix angewendet: `frontend/src/app.css` Regel `.task-tree-row-header` (Z. 947) — `gap: var(--task-tree-row-gap)` → `gap: 0` + Kommentar („kein gap — U+00A0 ist der einzige Trenner"). Sicherung: `.task-tree-row-header` hat genau EINEN Konsumenten (TaskTree.tsx:87, LeafItem) und enthält nur Titel + NBSP + Geo-Badge (Diff gegen f388572f geprüft) → kein Seiteneffekt auf andere Abstände.
- e2e-Verträglichkeit geprüft (frontend/e2e/issue-1121-geo-badge-title.spec.ts): AK4 misst nur vertikale Überlappung (badgeBox.y/height vs headingBox), AK2/AK5 zählen U+00A0-Textknoten — beides unabhängig vom horizontalen gap. `issue-1063`-Assertions laut Review row-scoped.
- GATE an role `gate-runner` (haiku) delegiert (SKILL Delegation).

## Relevante Stellen
- `frontend/src/app.css:947-953` — `.task-tree-row-header`; das gefixte gap.
- `frontend/src/components/TaskTree.tsx:87-95` — einziger Header-Konsument; NBSP + GeoBadge hinter KolHeading.
- `frontend/e2e/issue-1121-geo-badge-title.spec.ts:156-160` — AK4-Bounding-Box-Assertions (von gap unberührt).

## Annahmen
- Review-Variante 1 (`gap: 0`) ist die bindende Empfehlung; Variante 2 (negativer margin-left) war nur Alternativvorschlag im Thread.
- Thread gilt als unambig (nicht decision) → nach grünem Gate fixen + Thread auflösen.

## Verworfen
- Variante 2 (margin-left: calc(-1 * --task-tree-row-gap)) — impliziter Rück-Abstand, unperspicuoter; Review nennt Variante 1 „die klarere Lösung".
- `gap: 0.25rem` analog `done-title-cell` (app.css:1347) — würde neben dem NBSP wieder einen zweiten Trenner erzeugen.

## Offen
- GATE: alles grün (format/prettier/lint/frontend-vitest/e2e issue-1121 exit 0); einzig `pnpm knip` exit 1 mit nur „Configuration hint" (`client knip: src/schema.d.ts — Remove from ignore`) = pre-existing Rot auf main (MEMORY 2026-08-24), liegt nicht im Diff (nur frontend/src/app.css geändert) → nicht fixen.

## Nächster Schritt
- Commit + Push (inkl. dieser Notiz, ADR 0007), Thread 3886614318 beantworten + auflösen (`resolveReviewThread`, MEMORY 2026-08-23), danach Abschlusssatz/Verdict.

## Fallstricke
- E2E braucht Chromium in frischer Sandbox (MEMORY 2026-08-20: `pnpm exec playwright install chromium --with-deps` vor dem ersten Lauf).
- Gezielte e2e-Ausführung: `npx playwright test e2e/<datei>.spec.ts` im `frontend`-Verzeichnis (`pnpm --filter ... test:e2e --` filtert nicht, MEMORY 2026-08-26).
- `pnpm test` lokal rot an session.test.ts (Redis) = umgebungsbedingt, MEMORY 2026-08-29 — nicht jagen.
- NBSP-Falle: nach Edits in dieser Datei-Region `grep -c $'\xc2\xa0'` gegenprüfen (MEMORY 2026-08-29).
