# Issue 1090 — Review (Phase 5, PR #1094), Stand 2026-08-28

**ERGEBNIS: VERDICT reviewed, Ampel 🟢, Review-Typ Kreuzverhör (Erstprüfung).** Sammelkommentar `#issuecomment-5453832595` (Marker `<!-- ai-review -->`, genau 1 auf dem PR). Titelgate: PR-Titel umbenannt → `ci(prompts): remove skill duplicates from phase prompts (#1090)`. Keine Review-Kommentare (keine Findings).

## Erledigt
- MODE-Bestimmung: 0 Issue-Kommentare auf PR #1094 vor dem Lauf → Marker fehlte → Kreuzverhör-Erstprüfung (kein Fixup-Nachweis).
- Issue-Body-KI-ANALYSE-Block (Zeilen 168–194) geladen: AK1–AK5, „keine Testfälle" (Markdown-only), Ampel 🟢; Closing-Issue #1090 vorhanden (`closingIssuesReferences` length 1).
- **AK4 unabhängig nachvollzogen** (Kernleistung): alle 13 Referenzen der PR-Body-Dry-Check-Tabelle aufgelöst und gegen den jeweiligen Streichungstext gestellt — `ticket-spec` SKILL.md:21–24 (Branch + AK-Quelle + Legacy-Fallback), 54–57 (erster Commit/Push/Draft-PR/Titel wörtlich/Closes/Link-Check); `ticket-ux` 12 (Mandatory sources), 18–52 (Output-Block + VERDICT-Platzierung), 60 (Fail-safe inkl. „a human clarifies before the spec"), 62–68 (KoliBri-MCP docs-only + rein statisch); `ticket-implementation` 20–22 (Draft-PR-Pickup, Closing-Keyword-Falle, non-draft-Idempotenz), 24–31 (AKs aus Body-Block, Dateiexistenz, 🔴-Regel, „No full re-triage"), 55–63 (review-ready); `review-kreuzverhoer` 52–53 (Test-Pflege-Bedarf + KoliBri-first beide in step 2), 148–153 (⏸️-Template); `pr-documenter` 44–49 (`title`/`files`/`issues`/`jq`) → **keine Lücke**, PR-Behauptung „Keine Lücke gefunden" bestätigt.
- AK5 byte-exakt gegen den PR-Head (`1cd9fd2f`) nachgemessen: spec 3267→2426, ux 2382→2082, implement 3336→3094, review 4892→4628, documenter 886→631, Summe 14763→12861 B (−1902 B) = identisch mit PR-Body-Tabelle.
- AK2 mechanisch geprüft: Platzhalter-Arten je Datei vor/nach per `grep -o '{{[A-Z_]*}}'` — alle Arten erhalten (nur Mehrfachnennungen im gestrichenen Text geschrumpft), keine neue Art eingeführt.
- AK3: `git show --stat 5f808e44` = 5 Prompt-Dateien + `.ai-memory/issue-1090-implement.md` (Phasennotiz, laut Promptpflicht ADR 0007 im selben Commit); Workflows/Sync-Prompts/Rang 1+7–12 unangetastet.
- Regression-grep: nach den gestrichenen Formulierungen („For UX ambiguities", „Check ONLY whether", „pick it up", „Rules (short form", „Check the resume hint") in `--include='*.{yml,yaml,sh,js,ts,md}'` → keine Treffer; kein Workflow/Script parst den Wortlaut (nur Pfade-Referenzen in 5 Workflow-Dateien + pr-doc-render.sh).
- CI: `verify` pass (3m14s), e2e 1–4 pass, precheck pass; nur `review` pending (= dieser Lauf selbst). `pnpm test` lokal nicht gefahren → durch CI-verify abgedeckt, im Sammelkommentar begründet.
- Titelgate VOR dem Verdict: alter Titel „ci: Prompt-Audit — Phasen-Prompts optimieren (2026-08-28) (#1090)" verletzt CC (deutsch, Mixed-Case-Subject, 65 Zeichen wäre ok) → `gh pr edit 1094 --title "ci(prompts): remove skill duplicates from phase prompts (#1090)"` (61 Zeichen).
- Sammelkommentar gepostet (`.ai-memory/issue-1090-review-comment.md` als body-file) und per API verifiziert: genau 1 Kommentar mit Marker.

## Relevante Stellen
- `.github/prompts/{spec,ux,implement,review,documenter}.md` — die 5 gekürzten Prompts (Ist-Stand = PR-Head).
- `.claude/skills/{ticket-spec,ticket-ux,ticket-implementation,review-kreuzverhoer,pr-documenter}/SKILL.md` — Referenzziele, Zeilenbelege oben; alle PR-Body-Zeilenangaben waren korrekt.
- PR #1094, Commit `5f808e44` (Implement), Head `1cd9fd2f`.

## Annahmen
- `review.md` Schritt 1 definiert den „Review ohne Issue"-Wortlaut — der im 🟠-Wrap-up gestrichene Zusatz „(keine AK-Verifikation möglich)" ist damit inhaltlich gedeckt (nicht als Finding erhoben: kein operationeller Verlust).
- Der beim Resume-Hint gestrichene Zusatz „Look at existing commits/tests (git log, gh pr view), understand the state" ist durch „continue on its state — do NOT rewrite everything" + `ticket-spec` SKILL.md step 3 Dedup-Regel abgedeckt (kein Finding).
- CI-Job `verify` grün ist ein ausreichender Ersatz für den nicht gefahrenen lokalen `pnpm test`.

## Verworfen
- Findings/needs-fixup: alle fünf Fund-Kürzungen verhaltenserhaltend, kein Cover-Loch, keine verwaisten Platzhalter, keine externen Parser-Abhängigkeiten.
- needs-human: kein Architektur-/Produkt-Entscheid im Diff (O2/O3 laut Analyse-Block ausdrücklich außerhalb des Scopes).
- „genau die fünf Dateien" (PR-Body AK3) als Finding: die Phasennotiz im selben Commit ist ADR-0007-Pflicht, keine Scope-Verletzung.
- Titelgate als Finding: laut Vorgabe explizit kein Finding, wird nicht gezählt.

## Offen
- Wegwerf-Artefakte in `.ai-memory/` (untracked, NICHT committen): `issue-1090-review-bodyfetch.md` (Issue-Body-Rohfassung), `issue-1090-review-comment.md` (Sammelkommentar-Quelle); aus früheren Phasen zusätzlich `issue-1090-body/block/new/decision.md`, `issue-1090-prbody.md` (lt. Notizen teils schon gelöscht).
- CI `review`-Job war beim Laufabschluss pending (eigener Lauf).

## Nächster Schritt
- Kein Fixup nötig: Workflow setzt `ai:needs-review`-Folge bzw. Gate/Auto-Merge entscheidet; PR #1094 ist aus Review-Sicht fertig (🟢 + grünes CI nötig für `ai:ready-to-merge`).

## Fallstricke
- Platzhalter-Check nur nach **Arten** bewerten, nicht nach Anzahl: AK2 verlangt Erhalt der Lauf-Mechanik, aber das Wegkürzen von Wiederholungen senkt die Zähler legal (spec.md {{ISSUE_NR}} 9→4, implement.md 9→7, documenter {{TITLE_OK}} 2→1/{{LINKED_ISSUES}} 2→1).
- `documenter.md` {{TITLE_OK}} hängt NUR noch an INPUTS Zeile 9 — die Regel dazu lebt in `pr-documenter` SKILL.md:46 („empty if the existing title is already compliant"); nicht als „verwaister Platzhalter" missdeuten.
- Die PR-Body-Zeilenbelege (z. B. `review-kreuzverhoer SKILL.md:148–153`) waren alle korrekt — trotzdem nachprüfen, nicht übernehmen: genau das ist der AK4-Dry-Check, den der Review unabhängig wiederholen muss.
- Titelgate VOR dem Sammelkommentar/Verdict ausführen und im Review-Status transparent machen (hier: eigener Satz im Status-Block), sonst wirkt der Rename wie ein unbeobachteter Eingriff.
- `pnpm --filter`-Testläufe sind hier irrelevant (Markdown-only); CI-`verify` ersetzt den lokalen Gate-Teil — das im Sammelkommentar begründen, nicht stillschweigend überspringen.
