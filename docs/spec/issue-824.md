# Issue 824: KoliBri-Test-Guard

## Ziel

Tests greifen nur über öffentliche KoliBri-Schnittstellen auf Web-Components zu — kein `.shadowRoot`-Piercing, keine internen KoliBri-Klassen, keine Struktur-/Style-Checks im Schatten-DOM.

## Vorbedingung

- ESLint-Config existiert: `frontend/eslint.config.mjs`
- Test-Dateien existieren in `frontend/e2e/**` und `frontend/src/**/*.test.*`
- KoliBri-Components werden in der App verwendet

## Schritte

### 1. ESLint-Guard implementieren

In `frontend/eslint.config.mjs` neuen Flat-Config-Block für Test-Dateien hinzufügen:

- Scope nur auf `e2e/**/*.ts` und `src/**/*.test.{ts,tsx}`
- Regel: `.shadowRoot`-Zugriff verboten
- Regel: interne KoliBri-Klassen verboten (per Regex-Literal-Check)
- Host-Locators (`kol-button`, `kol-input-range`) erlaubt

### 2. Bestandsmigration durchführen

Für jede Fundstelle A–D aus der Fundliste:

- `.shadowRoot`-Zugriffe entfernen
- Interne KoliBri-Klassen durch öffentliche Locators ersetzen
- Icon-Präsenz-Checks entfernen (bewusster Verlust)
- Range-Slider und Password-Fields mit Rollen-Locators umschreiben

### 3. Doku aktualisieren

- `docs/testing.md` §4: Regel dokumentieren (erlaubt/verboten/Ausnahme)
- `.ai-knowledge/conventions.md`: Link auf testing.md hinzufügen

## Erwartetes Ergebnis

1. **ESLint-Guard aktiv**: `pnpm --filter frontend lint` zeigt Fehler bei `.shadowRoot` in Test-Dateien, aber nicht in Produktivcode
2. **Tests grün**: `pnpm --filter frontend test` läuft ohne Fehler durch
3. **Migration vollständig**: Alle 17 Fundstellen A–D sind migriert
4. **Doku vorhanden**: Regel ist in `docs/testing.md` und `.ai-knowledge/conventions.md` dokumentiert
5. **Ausnahme dokumentiert**: Hydration-Probe in `e2e/helpers.ts` mit `eslint-disable` + Begründung

## Akzeptanzkriterien-Bezug

- AK1: Kein Zugriff auf KoliBri-Interna in Test-Dateien (nur Ausnahme: helpers.ts)
- AK2: ESLint-Guard aktiv und gescoped
- AK3: Tests grün nach Migration
- AK4: Doku vorhanden
