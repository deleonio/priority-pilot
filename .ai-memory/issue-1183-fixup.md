# Issue 1183 — Fixup (PR #1188), Stand 2026-09-03 (Runde 2)

## Erledigt
- Runde 1 (voriger Lauf): F1 gefixt (`8239cf75`), Merge `7047043a`, Thread `PRRT_kwDONloM186eufG9` resolved — verifiziert: isResolved=true.
- Re-Review Runde 2 (Kommentar 5518226930, 2026-09-03T00:02:38Z): 🟢, „F1 sauber behoben, keine neuen Findings im Fixup-Delta".
- CI-Befund `e2e (4)` FAILURE (Run 33699775732, Head 6f8005fc) untersucht: KEIN Flaky — `settings-switch-layout.spec.ts` AK1–AK3 erwarten `toHaveCount(2)` auf `.settings-general .settings-switch-row`, fanden deterministisch 3 (14×Retry). Ursache: #1183 hat den dritten Switch „Animationen" (`SettingsPage.tsx:269-283`, eigenes `.settings-switch-row`, Muster wie #971) in den Allgemein-Tab gebaut — Test-Pflege wie F1, echte Regression im Diff-Nachbereich.
- Fix: Spec auf 3 aktualisiert (Z. 12-14 HINWEIS + AK1:66/71, AK2:93/95, AK3:117/119, Kommentare nennen #1183); AK5–AK7 label-basiert, unberührt.
- Verifikation lokal: `npx playwright test e2e/settings-switch-layout.spec.ts` = 7/7 grün (14s). Prettier + eslint auf der Datei grün.
- Commit + Push (siehe `git log`), kein Verdict — Fortschritt trägt der Commit. Kein Review-Thread aufzulösen (CI-Failure war kein Inline-Finding; Review-Kommentar unangetastet).

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx:269-283` — der #1183-Master-Schalter „Animationen", drittes `.settings-switch-row` im tab-0 (Allgemein).
- `frontend/e2e/settings-switch-layout.spec.ts:66,93,117` — Count-Assertionen (jetzt 3); Push-Zeile ist an `pushSupported` gekoppelt (im CI-Env supportet → 3 stabil).
- PR #1188 Checks: run 33699775732 (e2e 1–3 + verify grün, e2e 4 rot vor Fix).

## Annahmen
- Count 3 bleibt stabil, da Push-Support im E2E-Env gegeben war (CI sah 3, nicht 2) und kein weiterer Switch in tab-0 geplant.
- Kein neuerer Lauf existierte, der den Fix schon enthält; Pipeline startet nach Push automatisch.

## Verworfen
- `gh run rerun --failed` — kein Flaky (deterministischer Count-Mismatch, 3 AKs rot).
- AK5-Labels um „Animationen" erweitern — grüner Sicherungs-Test, kein gemeldetes Finding (SCOPE-Regel).
- Vollständiger Diff-Walk — Review hat 🟢 gegeben, nur CI-Anker verfolgt.

## Offen
- Pipeline nach Push beobachten (nächster Lauf); `.costs/1183.json` bleibt untracked (Harness-Artefakt, nicht committen).

## Nächster Schritt
- Nächster Lauf: CI auf PR #1188 prüfen (sollte jetzt komplett grün sein), dann Merge-Pfad des Workflows.

## Fallstricke
- Repo ist in frischen Runner-Sandboxes wieder SHALLOW → `git fetch --unshallow origin` vor merge-base-Operationen.
- Der #971-Spec-Kommentar „Seit #1151 nur noch 2" war veraltetet Munition: Count-Assertions in Altspecs sind die erste Anlaufstelle, wenn ein neuer Switch in tab-0 landet.
- AK3 (reduce) bekommt weiterhin KEINE Schalter-Vorbelegung-Ausnahme (Runde-1-Vertrag).
