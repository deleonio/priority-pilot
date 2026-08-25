# PR 1019 Documenter (CI-Phase 7) — VERDICT-Parser-Härtung

## Erledigt
- PR 1019 analysiert: Diff + Metadaten via gh pr diff/view gelesen
- Klassifikation: fixed (Bugfix, Parser hat Issues fälschlich geparkt)
- /tmp/doc.json geschrieben und mit jq validiert
- Phasen-Memory erstellt

## Relevante Stellen
- `.github/workflows/{01-claude-triage,02-claude-ux,03-claude-spec,04-claude-implement,05-claude-pr-review,claude-guide-sync,claude-spec-sync}.yml` — 8 Parser-Stellen: `tr -d -c 'A-Za-z0-9-'` → `grep -oE '<Vokabular>' | head -1`
- `.github/prompts/{ux,spec,implement,review}.md` + Inline-Prompts in Workflows — VERDICT-Beispiele: Token nackt, Bedeutungen in eigener Zeile
- `.ai-memory/MEMORY.md:142-146` — PR selbst trägt das Learning ein (tr klebte Prosa an Token → grep -oE löst das)

## Annahmen
- Titel ist bereits konform (`fix(ci): make VERDICT parser ignore prose after token`) → keine Umbenennung nötig
- Klassifikation ist "fixed" (Bugfix), nicht "internal" — Nutzer-Input-Workflow sichtbar betroffen (falsches Parken)
- Release-Note: Endnutzer-sichtbare Korrektur, Issues werden nicht mehr fälschlich geparkt

## Verworfen
- Neue Klassifikation erwägen ("internal" vs "fixed") — "internal" wäre unangemessen, der Bug hat echte Nutzer-Impact (Issues fälschlich beim Menschen geparkt)

## Offen
- Keine — Documenter-Phase abgeschlossen, /tmp/doc.json liegt für den Render-Schritt vor

## Nächster Schritt
- Keine — der Workflow übernimmt die Weiterverarbeitung (Render-Schritt liest /tmp/doc.json)

## Fallstricke
- Keine — PR-Diff und Metadaten waren vollständig und eindeutig, keine Zweifelsfälle bei der Klassifikation
