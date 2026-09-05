# Issue 1237 — PR Documenter (Phase), Stand 2026-09-05

## Erledigt
- PR #1237 analysiert (`gh pr view` + `gh pr diff`), Output nach `/tmp/doc.json` geschrieben; `jq empty` = OK.
- Klassifikation `fixed` (Bugfix: KolSingleSelect-Clear liefert `{ value: null }`, readString machte `"[object Object]"` → `userId=NaN` → Server lehnt Aufgabenanlage ab).
- Titel umbenannt (Input: title compliant = false): `fix(frontend): clear on recipient select no longer breaks task creation` (69 Zeichen, CC, englisch, lowercase) + title_reason. Der Input-Vorschlag `feat/frontend` wurde bewusst NICHT übernommen — Diff ist eindeutig ein Bugfix.
- `files` = alle 5 PR-Dateien (unter dem 8er-Limit): inputValue.ts (Fix-Kern), TaskForm.tsx, recipientOptions.ts (neu), inputValue.test.ts, recipientOptions.test.ts (neu).
- `issues` = `Closes #1237` (PR-Titel-Nummer; im PR-Body selbst kein `Closes #`).
- Keine gh-Schreibaktionen (edit/comment/label) — Skill-Ban eingehalten. Label `ai:documented` + `release:engineering` waren bereits gesetzt.

## Relevante Stellen
- `frontend/src/lib/inputValue.ts` — readString entpackt jetzt `{ value: … }` rekursiv; einziger verhaltensrelevanter Fix.
- `frontend/src/lib/recipientOptions.ts` — neuer Helfer `buildRecipientOptions` (Extraktion aus TaskForm, Verhalten unverändert).
- `frontend/src/components/TaskForm.tsx:571` — useEffect nutzt jetzt buildRecipientOptions.

## Annahmen
- `issues.ref` auf #1237 gesetzt (kein separates Issue im Body verlinkt; Merge-Commit referenziert #1237).
- `release:engineering`-Label steht im Widerspruch zum Klassifikationsergebnis `fixed` — ich habe trotzdem eine release_note_en geliefert (Skill verlangt sie für non-internal); Endverarbeitung entscheidet.

## Verworfen
- Klassifikation `improved` für die buildRecipientOptions-Extraktion — Refactoring ist Nebeneffekt, Hauptzweck ist der Bugfix.
- `migration_en` — kein Breaking, leer gelassen.

## Offen
- -

## Nächster Schritt
- Ende der Pipeline für diesen PR; nichts weiter zu tun.

## Fallstricke
- PR-Body enthält `🤖 Generated with Claude Code`-Fußnote — nicht in Summaries übernehmen.
- Der Input `type/scope = feat/frontend` stammt aus reinem Titel-Parsing und ist hier inhaltlich falsch; Klassifikation/Titel immer aus dem Diff ableiten.
