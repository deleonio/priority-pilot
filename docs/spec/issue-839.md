# Issue 839: Fix dead pnpm filter to server in CI workflows

## Ziel

Die CI-Workflows sollen den korrekten pnpm filter verwenden, nachdem das Package `priority-pilot` in `server` umbenannt wurde (issue-696).

## Vorbedingung

- Das Package wurde von `priority-pilot` zu `server` umbenannt
- CI-Workflows verwenden noch den alten Filter-Namen

## Schritte

1. Prüfen Sie `.github/workflows/ci.yml` Zeile 90
2. Prüfen Sie `.github/workflows/ci-multi-provider.yml` Zeile 86
3. Ersetzen Sie `--filter priority-pilot` durch `--filter server`

## Erwartetes Ergebnis

- Beide Workflow-Dateien enthalten nur noch `--filter server`
- Keine Warnung "No projects matched the filters" im CI-Log
- Coverage-Gate läuft korrekt über server/src/logics
