# Issue 1154 — Documenter (Phase 6), Stand 2026-09-01

## Erledigt
- PR 1154 analysiert (View + Diff), Output `/tmp/doc.json` geschrieben, mit `jq empty` validiert (VALID).
- Klassifikation: `internal` — docs/spec-only Sync-PR (12 Dateien: 9 docs/spec, 1 Phasen-Notiz, 1 Kommentarzeile in `server/src/express/http-error.test.ts:9`, 1 gelöschte Spec). Kein Produktivcode, kein User-Impact.
- `title` leer gelassen: `docs(spec): sync specs to implemented state 2026-09-01` ist CC-konform (Prompt-Flag title-compliant=true).
- `files`: 8 Einträge (Schwerpunkt #1136/#1151 Ist-Neufassung, #1130-Löschung, #1105-Routentabelle, #1098/#845 Tab-Umstellung, http-error.test.ts, fixup-Notiz).
- `issues`: kein Feature-Issue verknüpft → Sammel-Ref „Spec-Sync 2026-09-01" mit Aufzählung der betroffenen Tickets (#845, #933, #1098, #1105, #787, #843, #831, #1136, #1151; #1130 entfernt).

## Relevante Stellen
- PR-Body (view) — enthält die vollständigen Befunde je Spec-Datei; primäre Quelle für summary/notes, Diff nur zur Verifikation.
- `docs/spec/issue-1130.md` (DELETED) — einzige substanzielle Löschung; Begründung: reines internes Refactoring, kein Spec-Wert.
- `server/src/express/http-error.test.ts:9` — einzige src-Änderung (Kommentar-Verweis auf gelöschte Spec gestrichen).

## Annahmen
- `internal` ist hier korrekt, obwohl der SKILL „when in doubt, NOT internal" sagt — Dateien sind ausschließlich Specs/Docs, kein Verhaltens- oder UI-Impact; Zweifel nicht vorhanden.
- Keine echten „Closes #"-Beziehungen: nächtlicher Bot-Run (Autor app/my-github-action-bot), Issues sind nur Referenzobjekte der Specs.

## Verworfen
- Klassifikation `improved`/`new` — keinerlei Funktionalität; Docs-only.
- Release-Note mit Inhalt — für internal ist 1 Satz „warum keine Note" vorgeschrieben.
- Titel-Rename — bestehender Titel bereits compliant.
- Erneutes Lesen von `gh pr diff` über die ersten 200 Zeilen hinaus — PR-Body dokumentiert jede Datei mit Befund+Korrektur, Dateiliste+Zeilen aus `--json files` decken den Rest.

## Offen
- -

## Nächster Schritt
- Kein weiterer Schritt dieser Phase; Output liegt unter `/tmp/doc.json` (jq-validiert). Kein gh pr edit/comment/label (Review-Tier).

## Fallstricke
- `gh pr diff <n> --stat` existiert nicht (unknown flag) — `--name-only` oder volles Diff verwenden.
- Write-Tool auf `/tmp/doc.json` braucht Freigabe — Heredoc via Bash umgeht das nicht inhaltlich, war hier aber der genehmigte Weg.
- Deutsche Anführungszeichen im JSON: „…“-Paare in Strings sind unproblematisch, aber kein verschachteltes unescaped `"` verwenden.
