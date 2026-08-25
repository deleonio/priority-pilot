## Erledigt
- PR #1007 Inputs gelesen: gh pr diff, gh pr view, Issue #1004
- Klassifikation festgelegt: fixed (Test-Fix, schließt Behavior-Coverage-Lücke)
- /tmp/doc.json geschrieben mit classification, title, summaries, files, issues
- JSON validiert mit jq .

## Relevante Stellen
- `frontend/e2e/issue-930-transparent-backgrounds.spec.ts:336-347` — AK2-Test-Änderung: Tab-Schleife statt .focus()
- `docs/spec/issue-1004.md` — neue Spec mit Testvertrag (Ziel/Vorbedingung/Schritte/Erwartetes Ergebnis)
- `.ai-memory/MEMORY.md:134-141` — Shadow-Fokus/Mutationsprobe-Learnings (wurden in diesem PR hinzugefügt)
- Issue #1004 — Teil von #945 (Finding 2, severity critical), UI-Bezug: nein, Aufwand: haiku

## Annahmen
- Titel-Konformitäts-Prüfung aus der Regel-Logik (false) war korrekt: test(1004) ist kein Conventional Commit
- Die Mutations-Probe (tabindex="-1" → Test rot) wurde laut PR-Body lokal ausgeführt und macht den Test rot
- Die Grenze von 15 Tabs ist laut PR-Body konservativ genug für die aktuelle /-Seite (nur Banner-Logo/-Links davor)

## Verworfen
- Keine Alternativen geprüft — der PR löst das Problem adversarial vollständig (Review-Phase: 0 Findings, Verdict: reviewed)
- Keine migration_en nötig (kein breaking)

## Offen
-

## Nächster Schritt
- Documenter-Phase abgeschlossen — /tmp/doc.json liegt vor, der nächste Schritt (Render-Schritt) übernimmt

## Fallstricke
- KEINE Dateiänderungen außer /tmp/doc.json — kein gh pr edit/comment, keine Labels (das macht der Render-Schritt)
- Bei der Klassifikation "fixed" gewählt statt "internal" — der Regel-Logik zufolge („Im Zweifel NICHT internal") und weil der PR eine echte Lücke schließt (Behavior-Coverage-Gap aus #945 Finding 2)
- Memory-Pflicht nicht vergessen — die Memory-Datei ist der Checkpoint für einen eventuellen Soft-Abort

## Ergebnis
- Classification: fixed (Test-Fix für Behavior-Coverage-Lücke)
- Titel-Vorschlag: fix(e2e): add keyboard tab focus probe to issue-930 test
- /tmp/doc.json vollständig und validiert
- Ready für Render-Schritt
