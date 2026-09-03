# Issue 1183 — Fixup (PR #1188, Kreuzverhör Runde 1), Stand 2026-09-03

## Erledigt
- Findings eingesammelt: genau EIN fixables Finding F1 (🟡, Inline-Kommentar 3919809567, `frontend/e2e/issue-1182-dashboard-confetti.spec.ts`) — kein Entscheidungs-Finding, kein CI-Befund im Kommentar.
- Ursache verifiziert: Branch basierte auf `bb340752` (vor #1182-Merge `ba00b9d7`), das 1182-Spec fehlte lokal komplett → Repo war SHALLOW (`git rev-parse --is-shallow-repository` = true, daher zunächst „no merge base"); nach `git fetch --unshallow origin` merge-base da.
- `git merge origin/main --no-edit` in `ai/harness/1183` (bringt #1182-Spec + App.tsx-Wiring, #1191, Release-Commits; kein Konflikt).
- Fix F1: `test.beforeEach` + `addInitScript('pp-animations-enabled' → 'true')` in `issue-1182-dashboard-confetti.spec.ts` eingefügt (nach dem `afterEach`, vor AK1) — Muster aus `issue-1169-confetti.spec.ts:60-62`, Kommentar verweist auf #1183-Test-Pflege und AK3-Reduce-Ausnahme.
- Verifikation E2E lokal: `npx playwright test e2e/issue-1182-dashboard-confetti.spec.ts` = 3/3 grün (AK1/AK3/AK4); `issue-1183-animations.spec.ts` + `issue-1169-confetti.spec.ts` = 11/11 grün nach dem Merge.
- Gate (format/lint/knip/unit) an gate-runner (haiku) delegiert — Ergebnis im Commit/PR nachlesbar, s. Offen falls noch laufend.

## Relevante Stellen
- `frontend/e2e/issue-1182-dashboard-confetti.spec.ts:69-81` (AK1) und `:107-118` (AK4) — die vom Gate `launchConfetti → readAnimationsEnabled` (Default aus) gebrochenen Overlay-Assertions; Fix sitzt als beforeEach direkt im describe.
- `frontend/src/lib/confetti.ts:85` — das neue Default-aus-Gate, Auslöser der Regression.
- `frontend/e2e/issue-1169-confetti.spec.ts:56-62` — Vorlagen-Muster des Fixes.
- PR #1188: Review-Kommentar `<!-- ai-review -->` (needs-fixup, F1), Thread 3919809567 (GraphQL resolve ausstehend/nach Push).

## Annahmen
- Merge von origin/main in den Feature-Branch ist der richtige Weg (statt Cherry-Pick der Datei): vermeidet add/add-Konflikt beim PR-Merge und hält den PR-Diff gegen main minimal (nur der beforeEach-Block).
- F1 ist unambiguous (Review liefert exakten Code-Vorschlag) → direkt gefixt, keine Klärung nötig.

## Verworfen
- Cherry-Pick/Checkout nur der 1182-Spec-Datei aus origin/main — hätte add/add-Konflikt beim GitHub-Merge erzeugt (beide Seiten fügen gleiche Datei mit unterschiedlichem Inhalt hinzu).
- Vollständiger Diff-Walk — Review hat nur F1 gemeldet, SCOPE-Regel des Prompts (nur Anker lesen).

## Offen
- -

## Nächster Schritt
- Erledigt: Merge `7047043a` (origin/main rein), Fix-Commit `8239cf75` gepusht (4fae36ab..8239cf75), Review-Thread PRRT_kwDONloM186eufG9 (Inline 3919809567) per GraphQL resolved (isResolved=true verifiziert). Kein Verdict — Fortschritt trägt der Commit. Nächster Lauf: Re-Review/CI auf PR #1188 abwarten.

## Fallstricke
- Runner-Repo ist shallow geklont — merge-base-Fehler erst mal mit `git fetch --unshallow origin` lösen, nicht als divergierte Historie fehldeuten.
- Bash-Tool-Arbeitsverzeichnis persistiert: nach `cd frontend` läuft der nächste Call schon dort („cd: frontend: No such file or directory" ist dann kein Fehler für den eigentlichen Befehl).
- AK3 (reduce) bekommt KEINE Schalter-Vorbelegung-Ausnahme — reduce unterdrückt auch bei eingeschaltetem Schalter; wer dort test.beforeEach-Ausnahmen einbaut, verändert den Vertragspunkt.
