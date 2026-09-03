# Issue 1198 — Documenter (Phase 6), Stand 2026-09-03

## Erledigt
- PR #1199 (merged, Autor deleonio) analysiert: `gh pr view 1199` + vollständiger Diff (4 Dateien, +152/−20). Output `/tmp/doc.json` geschrieben und mit `jq -e` verifiziert (classification internal, 4 files, 1 issue); Titel-Check: 59 Zeichen, lowercase, `ci:`-Präfix.
- Classification **internal** — rein CI-Tooling (Audit-Prompt, KOSTEN-BASIS-Skript + Test, Workflow-Header-Kommentar), kein Nutzer-IMPACT; `release_note_en` = 1 Satz Begründung, `migration_en` leer.
- Titel vorgeschlagen: `ci: add turn economy axis to prompt audit and costs summary` (Alt: `feat(ci): Turn-Ökonomie … (#1198)` — falscher Typ `feat`, deutscher Subject, PR-Nummer-Suffix; Vorgabe title compliant = false, type ci).
- Kein MEMORY.md-Eintrag: kein neuer Fehler, Aufnahmekriterium nicht erfüllt.

## Relevante Stellen
- `.github/scripts/costs-summary.sh` — Kern: Läufe ohne `turns`-Feld (244 von 801, vor #984) werden jetzt aus allen Turn-Mittelwerten ausgeschlossen (`$withTurns`-Filter) statt als 0 gemittelt, in Fußnote genannt; Phase ohne Turn-Daten → „—"; neues optionales Verzeichnis-Argument (Default `.costs`).
- `.github/scripts/costs-summary.test.ts` (neu, 105 Z.) — node:test, schreibt Fixtures in tmpdir, ruft das Skript mit Verzeichnis-Argument; deckt Summen, Ausschluss, Turns/Ticket, „—"-Fall, Fußnote ab.
- `.github/prompts/prompt-audit.md` — Kriterium `H. TURN ECONOMY` (Z. 17), Fund-Kategorie `Turn-Bündelung`, turns-first-Priorisierung in FRAME/ORDER-1/REPORT; VERDICT + Report-Struktur wörtlich unverändert.
- `.github/workflows/cron.audit-prompts.yml` — nur Header-Kommentar (+9/−2), keine Step-/Label-Mechanik.

## Annahmen
- „internal" korrekt, obwohl Regel „when in doubt NOT internal": Impact betrifft nur die KI-Pipeline/CI, keine Nutzerfunktion — abgeleitet aus Body + Diff, keine entgegenstehende Angabe.
- issues nur aus Body (`Closes #1198`); kein weiteres verlinktes Issue.

## Verworfen
- Classification `improved` — Performance-Gewinn betrifft nur CI-Kosten, nicht das Produkt.
- Titel `feat(ci)` beibehalten — Typ passt nicht (kein Feature) und Titel ist laut Vorgabe nicht compliant.
- MEMORY.md-Eintrag — nichts Neues schiefgegangen.

## Offen
- -

## Nächster Schritt
- Keiner — Documenter-Phase abgeschlossen; PR ist gemerged und dokumentiert.

## Fallstricke
- `costs-summary.sh` hat jetzt ein Argument: der Test ruft es mit Fixture-Verzeichnis auf; wer das Skript separat testet, sollte Default `.costs` nicht brechen.
- Turn-Mittelwerte basieren nur auf Läufen MIT turns-Feld (Runs-Spalte zählt weiter alle) — Ø „steigen" scheinbar (#1198-Body: review 11→17), das ist Korrektur, nicht Regression.
