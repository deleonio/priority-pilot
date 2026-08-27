# PR 1050 — Review (Kreuzverhör, Runde 1)

## Erledigt
- Modus bestimmt: kein `<!-- ai-review -->`-Kommentar vorhanden → KREUZVERHÖR (Erstreview).
- Vollständigen Diff gelesen (2037 Zeilen, 18 Dateien: 7× SKILL.md, knowledge-graph/references/link-style.md, 9× .github/prompts/*.md, Inline-Prompt in claude-prompt-audit.yml).
- Mechanical Checks bestanden: `{{PLACEHOLDER}}`-Mengen alt (Base de005b79) vs. neu identisch je Prompt-Datei; VERDICT-Token-Listen identisch; deutsche Artefakt-Literale erhalten (Test-Pflege-Bedarf in ticket-spec/SKILL.md:1, implement.md, review.md; Entscheidungs-Findings in review-kreuzverhoer/SKILL.md + review.md; fixup.md Sektionen Behobene Anmerkungen/Review-Typ: Fixup-Nachweis); YAML des Workflows + aller 7 Skill-Frontmatters parst (python3 yaml.safe_load).
- Titel-Gate ausgeführt: Titel war nicht Conventional-Comits-konform → umbenannt zu `chore: translate agent harness instructions from german to english` (TITLE_OK=false, Hints chore/k.A.).
- Sammelkommentar (Marker `<!-- ai-review -->`) neu angelegt, Status reviewed/🟢.

## Relevante Stellen
- `.github/prompts/*.md` — CI-Prompts, einzige Verbraucher sind `cat` in Workflows 03–06 (kein Parsing des Inhalts).
- `.github/workflows/claude-guide-sync.yml`/`claude-spec-sync.yml` — absichtlich deutsch geblieben (Begründung im PR-Body), unverändert.
- `01-claude-triage.yml` — parst deutsche Literale aus dem ISSUE-Body (nicht aus Prompts), unverändert, konsistent zur weiter deutsch schreibenden Triage-Skill-Vorlage.

## Annahmen
- Kein verlinktes Issue → AK aus dem PR-Body selbst abgeleitet (Übersetzung ohne Verhaltensänderung).
- `VERDICT: exactly ONE line…`-Instruktionszeile ist ungefährlich: Workflows parsen den Agenten-Output, nicht den Prompt (Parser greift ersten bekannten Token, Memory 2026-08-25).

## Verworfen
- Finding „toter impeccable-Verweis" (`.claude/skills/impeccable/` existiert nicht): pre-existing, auf Base de005b79 und origin/main ebenfalls nicht vorhanden, nicht vom PR eingeführt.
- Finding „Body nennt 8 SKILL.md-Dateien": kosmetisch (7 SKILL.md + 1 Referenzdatei), als Nebennotiz im Sammelkommentar erwähnt, kein Finding.

## Offen
- -

## Nächster Schritt
- Keiner — Verdict `reviewed` geliefert (Datei + Output). Bei Fixup-Runde: MODUS FIXUP-NACHWEIS, nur Diff seit updatedAt des Sammelkommentars prüfen.

## Fallstricke
- Lokaler `main`-Ref ist stale (`git show main:.github/prompts/…` schlägt fehl) — Vergleichs-Basis für alt/neu ist der Merge-Parent de005b7990e4e48f870b7afd9253c417abc9c508.
- gh/`--jq` hängt Newline an; Body-Dateien per `--body-file` übergeben (Memory 2026-08-26).
