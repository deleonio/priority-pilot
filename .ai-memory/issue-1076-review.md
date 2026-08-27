# PR 1076 — Review (Kreuzverhör Runde 1, 2026-08-27)

## Erledigt
- MODE bestimmt: CROSS-EXAMINATION — 0 Kommentare auf Issue/PR 1076, kein `<!-- ai-review -->`-Marker (gh api issues/1076/comments → length 0).
- Full diff gelesen (4 Dateien, +221/−7): `docs/spec/issue-1073.md` (neu), `frontend/e2e/issue-1073-footer-address.spec.ts` (neu), `frontend/src/components/Footer.test.tsx`, `frontend/src/components/Footer.tsx`.
- PR hat KEINE closingIssuesReferences (`[]`) → „Review ohne Issue"; Issue #1073 existiert aber (KI-ANALYSE-Block gelesen, AK1–AK6 decken sich mit PR-Body + Spec-Doc).
- TDD-Reihenfolge verifiziert: `c4357821 test: red spec tests for #1073` → `f7e6480c feat(frontend): …` → `e8ebb611` (merge main).
- Regressionssuche: kein Test ausserhalb des Diffs referenziert 📍/Koordinaten; `footer-version.spec.ts` prüft nur Version + contentinfo.
- `.app-footer` CSS geprüft (app.css:1658–1665): normaler Block, `text-align:center`, KEIN Flex → `minWidth: 0` auf dem inline-Span (Footer.tsx:13) ist inert.
- Befund F1 (🟡): inertes `minWidth: 0` — einziger fixup-fähiger Punkt; Verdict needs-fixup.
- Titel-Gate: Titel war deutsch nicht-konventionell → umbenannt in `feat(frontend): show address instead of raw coordinates in footer`.
- Inline-Review (event=COMMENT) gepostet: Review-ID 5045876746, Inline-Kommentar-ID 3876063057 (Footer.tsx:13).
- Sammelkommentar erstellt (KEIN vorheriger vorhanden): Kommentar-ID **5445515209** — Folge-Runden per `gh api --method PATCH repos/{owner}/{repo}/issues/comments/5445515209` aktualisieren.
- Verdict `needs-fixup` nach /tmp/claude-verdict geschrieben.

## Relevante Stellen
- `frontend/src/components/Footer.tsx:13` — Span mit `minWidth: 0, overflowWrap: 'anywhere'`; nur overflowWrap wirkt (inline in Block-Footer).
- `frontend/src/app.css:1658` — `.app-footer` ohne `display:flex` (Beleg für F1).
- `frontend/e2e/issue-1073-footer-address.spec.ts:29` — Helper `enableGeolocationPreference` (Test-Pflege, im PR-Body dokumentiert, Assertions unverändert → akzeptiert).
- `frontend/src/components/Footer.test.tsx:60ff` — Unit-AKs AK1/2a/2b/3a/3b mit exakten String-Checks.

## Annahmen
- Issue #1073 ist der fachliche Kontext, auch ohne Closing-Link; AK-Verifikation erfolgte informell gegen dessen KI-ANALYSE-Block + docs/spec/issue-1073.md.
- CI zum Review-Zeitpunkt pending (nicht rot); Pipeline-Gate degradiert selbst, falls rot — kein Inhaltsthema.
- Hemisphere-Labels `° N`/`° E` bei negativen Koordinaten: präexistierend, bewusst NICHT als Finding (nur Beobachtung im Review-Body).

## Verworfen
- a11y-Bedenken gegen `aria-hidden`-Separator: Standard-Praxis für dekorative Pipes, kein Finding.
- 320px/200%-Reflow-Test als Lücke bewertet: SKILL verlangt 375px-Test (vorhanden); 320px ist nur Umsetzungshinweis im Spec-Doc.
- Double-Cast im Unit-Test-Mock (`as unknown as`): vitest-Standard-Pattern für Partial-mockReturnValue, keine Fehlerunterdrückung.
- MEMORY.md-Eintrag: strenges Kriterium nicht erfüllt (kein Pipeline-/Wiederholfehler).

## Offen
- -

## Nächster Schritt
- Fixup-Runde: F1 beheben lassen (`minWidth: 0` entfernen in Footer.tsx:13, Hinweis ggf. in docs/spec/issue-1073.md korrigieren) → dann MODE FIXUP VERIFICATION: nur F1-Abhaken + Fixup-Diff prüfen.

## Fallstricke
- Finding-Nummer F1 und Struktur des Sammelkommentars sind STABIL — beim Update nichts umbenennen, F1 nach Behebung in „Behobene Anmerkungen" verschieben.
- Keine Labels setzen (Workflow macht das selbst).
- Sammelkommentar per PATCH der Kommentar-ID aktualisieren, nicht neu anlegen.
