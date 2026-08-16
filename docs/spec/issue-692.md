# Spec Issue 692: Alert-Layout-Verbesserung

**Stand:** 2026-08-16  
**Ziel:** Alert-Box soll sauberer aussehen mit besserem Abstand zum Button, Serien-Titel mit konsistenter Formatierung.

## Vorbedingung

- Dashboard mit Serien-Alert ist geladen

## Schritte

1. Serien-Alert mit Titel anzeigen
2. Alert-Abstand nach unten zum Button prüfen
3. Serien-Titel font-weight prüfen

## Erwartetes Ergebnis

- Alert hat mindestens 8px Abstand (margin/padding) nach unten zum Button
- Serien-Titel haben font-weight: 600 (semi-bold) für konsistente visuelle Hierarchie

## Versionierung

- **v1.0** (2026-08-16): Initialefassung für Issue #692.
- **v1.1** (2026-08-16): Nightly-Sync — font-weight auf Ist-Zustand korrigiert (600 statt normal).
