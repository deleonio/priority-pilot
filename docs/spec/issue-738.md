# Issue 738: Verifikation + Migration-Runbook für laufende Tickets

## Ziel

Verifikation aller Änderungen an `check-phase-label.sh` und Dokumentation des Migrations-Prozesses für bestehende Tickets.

## Vorbedingung

- Issue #736 ist gemergt (Blocker aufgelöst)
- `.github/scripts/check-phase-label.sh` existiert und ist funktionsfähig

## Schritte

### 1. Syntax-Verifikation

- Bash-Syntax-Check: `bash -n .github/scripts/check-phase-label.sh`
- Erwartung: Keine Syntax-Fehler

### 2. Format-Verifikation

- Format-Check aller geänderten Dateien: `pnpm format` (Check-only)
- Erwartung: Keine Format-Probleme

### 3. Funktions-Test (Read-Only)

- Read-only-Probelauf gegen echtes Issue: `bash .github/scripts/check-phase-label.sh --phase ux --ticket <N>`
- Erwartung: Phase wird korrekt erkannt, Script läuft ohne Fehler

### 4. Migrations-Dokumentation

PR-Body enthält Migrations-Runbook mit zwei Schritten:

- Nicht-UI-Tickets: `ux:ready` Label setzen
- UI-Tickets: Phase 02b triggern

## Erwartetes Ergebnis

Alle Verifikationen erfolgreich, Migrations-Runbook dokumentiert, Issue kann umgesetzt werden.
