# Issue/PR 1112 — Review (Kreuzverhör, Runde 1), Stand 2026-08-29

**ERGEBNIS: VERDICT needs-fixup, Ampel 🟡.** Kein `<!-- ai-review -->`-Marker vorhanden → Kreuzverhör (Initial). KEIN Closing-Issue (`closingIssuesReferences` = 0) → „Review ohne Issue - PR-Beschreibung ist massgebend" (in Sammelkommentar Zeile 2 vermerkt). Titel war deutsch (`fix(ci): gate-merge akzeptiert "skipping"-Review-Checks`) → Title-Gate fehlgeschlagen → umbenannt zu `fix(ci): gate-merge accepts skipping review checks`.

## Erledigt
- Modus bestimmt (Marker-Suche via `gh api repos/.../issues/1112/comments`): kein Marker → Kreuzverhör; volle Diff gelesen (9+/1−, nur `.github/workflows/claude-pr-gate-merge.yml`).
- Workflow-Kontext gelesen: Zeilen 150–434 (Retry-Schleife 204–242, G2-Permission-Alarm, Gate-Zweig ab ~293, Merge-Zweig ab ~331 mit ai:reviewed-Label-Pflicht ~343).
- Titel per `gh pr edit 1112 --title` umbenannt (Title-Gate, kein Finding).
- Inline-Review (event=COMMENT) mit 2 Findings gepostet (Kommentar-IDs 3885809186 = F1 @ Zeile 228, 3885809187 = F2 @ Zeile 216; F1 nachträglich gepatcht wegen Sprachfehler) + Sammelkommentar (Marker) erstellt (**ID 5460790229** — für Folgerunden per PATCH updaten); verdict `needs-fixup`.

## Relevante Stellen
- `.github/workflows/claude-pr-gate-merge.yml:227-228` — Finding F1: `all(.[]; .bucket == "skipping")` ist bei LEEREM `review_checks`-Array vakuum-true (jq-`all` auf [] = true) → has_review=true auch wenn NOCH KEIN Review-Check sichtbar ist; untergräbt die dokumentierte Retry-Härtung (PR-#220-Kommentar direkt darüber, „nur das reine Fehlen eines Eintrags wird per Retry abgefangen"). Zudem verspricht der Commit-Message „wenn ai:reviewed gesetzt" ein Label-Gating, das der Code NICHT implementiert (`labels` ist in der Schleife verfügbar). Vorschlag: Skip-Akzeptanz an `ai:reviewed`-Label koppeln (+ ggf. length>0, falls skipping-Checks wirklich gelistet werden).
- `.github/workflows/claude-pr-gate-merge.yml:216` — Finding F2: Kommentar „ohne den Filter" → „ohne dem Filter" geändert = Grammatik-Regression (ohne + Akkusativ), ohne PR-Bezug; zusätzlich nutzt der neue Kommentar echten Umlaut („Fix für") gegen die Datei-Konvention ae/oe/ue (waere/wuerde/laeuft).
- Merge-Zweig ~:343 — verlangt ai:reviewed-Label ohnehin → F1 schadet v.a. der Retry-Semantik + Randfall „Mensch pusht nach ai:reviewed neuen Commit, Review-Checks noch nicht sichtbar, CI grün → Merge ungeprüften Commits".

## Annahmen
- jq-`all` auf leerem Array = true (vakuum) — Standard-jq-Semantik, nicht im Runner getestet.
- Warum der alte Code scheiterte, ist nicht voll aufklärbar: Wären skipping-Checks gelistet, wäre `has_review` schon vorher true gewesen (select filtert nicht nach bucket). Plausibel: geskippte Review-Jobs erscheinen in `gh pr checks` GAR NICHT → der Fix wirkt über die vakuum-leere Liste. Dann würde ein `length>0`-Guard den Fix brechen — deshalb Empfehlung Label-Gating statt Existenz-Guard. Im PR-Body steht allerdings „liegen im Bucket skipping" (Widerspruch, in F1 angesprochen).
- Keine Tests fürs Workflow-Inline-Bash im Repo-Üblichkeitsmaß (wie gesamte Datei ungeprüft) → kein eigener Test-Befund.

## Verworfen
- KoliBri-/Mobile-first-/Design-Audit — CI-only-PR, kein Frontend.
- 🔴-Verdikt — Merge-Zweig verlangt zusätzlich ai:reviewed-Label, Hauptschaden ist Race/Retry-Schwächung, behebbar → 🟡/needs-fixup.
- MEMORY.md-Eintrag — kein neues Fehlermuster über Phase-Notiz hinaus.

## Offen
- -

## Nächster Schritt
- Fixup-Runde: F1 (Label-Gating/Vakuum-Guard) + F2 (Kommentar reverten) umsetzen; danach Fixup-Nachweis-Review (Marker-Kommentar dann updaten, Review-Typ: Fixup-Nachweis).

## Fallstricke
- Sammelkommentar-ID beim Update wiederverwenden (`gh api --method PATCH .../issues/comments/<id>`), NICHT neu erstellen.
- Finding-Nummern F1/F2 stabil halten über Runden.
- Keine Labels setzen (macht der Workflow).
