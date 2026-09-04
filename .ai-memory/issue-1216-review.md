# PR 1216 — Review (Runde 1 Kreuzverhör + Runde 2 Fixup-Nachweis), Stand 2026-09-04T13:28Z

**ERGEBNIS Runde 2: VERDICT needs-fixup (unverändert).** Modus FIXUP VERIFICATION (Marker vorhanden, Kommentar #5541029875, updatedAt 13:20:40Z). **Kein Fixup gelaufen:** kein `<!-- ai-fixup-decisions -->`-Kommentar, kein Fixup-Commit; einziges Delta seit Runde 1 = Merge `2511ed5e` (main, 13:21:08Z) mit nur `package.json`-Versions-Bump (`git diff --stat 9173ee33 2511ed5e`). Finding #1 und Nit N1 auf PR-Head unverändert verifiziert (`heart-balance.spec.ts:59-62` scrollWidth-Assertion bzw. `HeartBalance.tsx:293`). Sammelkommentar #5541029875 per PATCH in-place auf Runde 2 aktualisiert (id stabil). Titel-Gate Runde 2: Conventional-Commits-konform, kein Rename.

**ERGEBNIS Runde 1: VERDICT needs-fixup (🟡).** Kein `<!-- ai-review -->`-Marker vorhanden → Modus Kreuzverhör (Erstreview). **Keine Closing-Issue** (`closingIssuesReferences` = []) → „Review ohne Issue — PR-Beschreibung ist massgebend". Titel-Gate gegriffen: deutscher Subject → umbenannt zu `feat(frontend): add heart-shaped life-balance widget to the dashboard`.

## Erledigt
- Vollständigen Diff gelesen (1221+/21−, 13 Dateien; `.ai-memory/issue-1216-pr.diff`), PR-Body als informelle Spec.
- Modus bestimmt (Marker-Suche über Issues-API: leer), Closing-Issues geprüft (0).
- Alle CSS-Tokens des Diffs gegen app.css verifiziert: `--pp-ease`, `--pp-pillar-1…8`, `--pp-ink(-muted)`, `--pp-surface-1/2`, `--pp-gap-{generous,base,tight}`, `--pp-space-1/2`, `--pp-font-size-{2xl,lg,sm}`, `--pp-weight-bold`, `--pp-line-{tight,base}`, `--pp-radius-pill`, `--pp-border-{subtle,strong}` — alle vorhanden.
- Imports verifiziert: `usePrefersReducedMotion` (reducedMotion.ts:15), `useAnimationsEnabled`, `KolInputCheckbox` (SettingsPage.tsx:1), `buildPillarBalances` (lib/score.ts:18).
- Overflow-Befund verifiziert: `overflow-x: hidden` weiterhin in app.css (783 u. a.) → `documentElement.scrollWidth`-Probe strukturell grün (MEMORY 2026-08-24, Mutationssonde).
- Pillar-Annahme der E2E geprüft: dashboard-meter.spec.ts:92-93 setzt ebenfalls vorhanden Säulen voraus → e2e-Backend seedt Säulen; kein Finding.
- `deleteAllTasks`-Duplikat geprüft: Muster in 8+ Specs etabliert → kein Finding.
- Review (event COMMENT) mit 1 Inline-Kommentar + Sammelkommentar (`<!-- ai-review -->`, neu erstellt) gepostet; Titel umbenannt; `/tmp/claude-verdict` = needs-fixup.

## Relevante Stellen
- `frontend/e2e/heart-balance.spec.ts:59` — tote Overflow-Assertion (scrollWidth trotz Shell-Clip) → **Finding #1, fixable/blocker**; Fix: Bounding-Box-Muster (`heartBox.x + heartBox.width ≤ 375+1`), idealerweise 320 px mitprüfen (Karten-Padding schluckt Überlauf).
- `frontend/src/components/HeartBalance.tsx:293` — Legenden-Dot `heart-legend-dot--${colorIndex+1}` ohne Grenze bei Rang 8 → Klasse ohne Regel ab 9. Säule (fällt korrekt auf neutral zurück) → Nit N1; Kontrast zu `waterClass()` (HeartBalance.tsx:741, explizite `PILLAR_RAMP_SIZE`-Prüfung).
- `frontend/src/lib/heartBalance.ts` — Rechenkern `Σ min(soll, ist)`, Randfälle (keine Punkte / alle Gewichte 0 / Soll 0) dokumentiert und getestet; geprüft: leerer pillars-Array kann `1/pillars.length` nicht auswerten (map über pillars).
- `frontend/src/components/HeartBalance.tsx:714-731` — Wellenpfad-Kachelung mathematisch geprüft: Spanne −32…128, Verschiebung −16 = 1 Periode → nahtlos, sichtbarer Bereich stets gedeckt.
- `frontend/src/components/Dashboard.tsx:503-524` — `punkteProSaeule` in eigenes useMemo gezogen (zwei Konsumenten); Herz-Karte nur bei `pillars.length > 0`.
- CI-Stand bei Review: verify pass, e2e (1)/(4) pass, e2e (2)/(3) pending — Pipeline-Gate übernimmt das; nicht Inhalt des Verdicts.

## Annahmen
- E2E-Shards pending ≠ rot; Merge-Gate der Pipeline prüftallowliste Checks selbst.
- SMIL statt CSS für Wellen-Drift (Phasengleichheit) und `{animated && <animateTransform>}` für reduced-motion sind begründet und korrekt umgesetzt; `usePrefersReducedMotion` ist live (#1187).
-px in `--pp-heart-rise` wirkt im SVG-User-Space als Nutzereinheiten — korrekt, da aus `HEART_BOTTOM - HEART_TOP` berechnet, nicht hartkodiert.

## Verworfen
- Weitere Findings: Token-Fehlstellen (alle da), KoliBri-first-Verstoß (SVG ausführlich begründet, KolMeter kann keine Herz-Metapher), Test-Pflege-Bedarf bei settings-switch-layout.spec.ts (#971, 3→5 Zeilen — in-diff dokumentiert, kohärent), Overflow-Risiko des `overflow: visible` + Beat-Scale (zentriert ~7 px je Seite vs. ~20 px Karten-Padding — unkritisch).
- MEMORY.md-Eintrag — Befund steht seit 2026-08-24 drin; nichts Neues gelernt.

## Offen
- `.ai-memory/issue-1216-pr-body.md`, `issue-1216-pr.diff`, `issue-1216-review-input.json`, `issue-1216-collected.md` (2× geschrieben: Runde 1 + 2) = Wegwerf-Artefakte, NICHT committen.
- Fixup-Runde muss Finding #1 abarbeiten; danach Fixup-Nachweis (Modus bleibt FIXUP VERIFICATION bis Claims da sind).

## Nächster Schritt
- Fixup: heart-balance.spec.ts Overflow-Prüfung auf Bounding-Box umstellen (Muster s. Finding #1), Nit N1 optional.

## Fallstricke
- Nächste Runde = FIXUP VERIFICATION (Marker jetzt vorhanden): Claim-Checklist aus `<!-- ai-fixup-decisions -->` gegen Fixup-Diff prüfen, NICHT den ganzen PR neu kreuzverhören.
- Finding-Nummern stabil: #1 = Overflow-Assertion, N1 = Legenden-Dot-Grenze.
- E2E-Shards (2)/(3) waren bei Abgabe pending — bei Rot dort nicht automatisch neues Finding aufmachen, sondern zuerst zuordnen, ob die neue Spec/die geänderte settings-Spec betroffen ist.
