## Erledigt
- PR-Daten via `gh pr view 1022` und `gh pr diff 1022` geholt
- Klassifikation: `fixed` — Bugfix für CI-Workflow-Expression-Limit-Problem
- Titel-Analyse: aktueller Titel mit `fix(ci):` ist konform, aber sehr lang (>100 Zeichen Gesamt)
- Dokument nach Vorgabe erstellt

## Relevante Stellen
- `.github/workflows/04-claude-implement.yml:787-794` — drei neue env-Keys für die ausgelagerten Interpolationen
- `.github/workflows/04-claude-implement.yml:823` — `sha_before="${{ steps.head-before.outputs.sha }}"` → `sha_before="$HEAD_BEFORE_SHA"`
- `.github/workflows/04-claude-implement.yml:1027-1028` — zwei weitere Interpolationen in env-Variablen gewandert

## Annahmen
- Die PR-Beschreibung ist korrekt: der `run:`-Block war mit ~24k Zeichen über dem 21000-Limit
- Der Fix ist technisch korrekt: ohne `${{ }}` im `run:`-Block wird er als Literal behandelt
- Test plan in PR-Body ist vollständig und die Checks sind bestanden (YAML parst, env-Keys vorhanden, kein weiterer Block über Limit)

## Verworfen
-

## Offen
-

## Nächster Schritt
- Phasen-Notiz schreiben, dann /tmp/doc.json mit jq validieren

## Fallstricke
- Titel-Idee war deutsch → Conventional Commits sind englisch
- Time war noch nicht dringend (1787663836 ist weit in der Zukunft)
- MEMORY.md existiert noch nicht → nur Phasen-Notiz schreiben
