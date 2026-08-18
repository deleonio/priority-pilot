# Issue 840: Update all references from priority-pilot to server

## Ziel

Alle Referenzen von "priority-pilot" zu "server" in der Dokumentation aktualisieren, um die Umbenennung des server-Pakets zu reflektieren.

## Vorbedingung

- Die Dokumentationsdateien enthalten veraltete "priority-pilot" Referenzen

## Schritte

1. README.md aktualisieren: `--filter priority-pilot` → `--filter server`
2. CONTRIBUTING.md aktualisieren: `--filter priority-pilot` → `--filter server`
3. AGENTS.md aktualisieren: `--filter priority-pilot` → `--filter server`
4. .ai-knowledge/conventions.md aktualisieren: `priority-pilot` Referenzen → `server`
5. .ai-knowledge/project.md aktualisieren: `priority-pilot` Referenzen → `server`
6. server/README.md korrigieren: npm-Name ist `server` (nicht priority-pilot)
7. frontend/README.md aktualisieren: `--filter priority-pilot` → `--filter server`

## Erwartetes Ergebnis

- Keine `priority-pilot` Referenzen mehr in den genannten Dateien (außer in History/Comments)
- Alle `--filter` Aufrufe verwenden `--filter server`
- npm-Paket-Referenzen korrekt als `server`
