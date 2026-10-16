# Spec #2637 — Badge-Farb-Mappings in badgeColors.ts konsolidieren

## Ziel

Eine Quelle für alle KolBadge-Farben: Die lokalen Duplikate `PRIORITY_COLOR` (TaskTable, TaskTree)
und `URGENCY_COLOR` (Dashboard) wandern nach `frontend/src/lib/badgeColors.ts`; der Guard-Test
deckt fortan auch Mapping-Definitionen ab. Optik unverändert (Hex-Werte exakt gleich).

## AK1 — Keine lokalen Hex-Mappings mehr in den Komponenten

- Vorbedingung: `TaskTable.tsx`, `TaskTree.tsx`, `Dashboard.tsx`.
- Erwartung: keine Hex-Literal-Strings (`'#…'`) mehr in den Dateien; die Mappings werden aus
  `badgeColors.ts` importiert. Anwendungsstellen (`_color={MAPPING[...]}`) bleiben strukturell gleich.

## AK2 — badgeColors.ts exportiert beide Mappings mit unveränderten Hex-Werten

- Vorbedingung: Import aus `frontend/src/lib/badgeColors.ts`.
- Erwartung: `PRIORITY_COLOR` = `{ info: '#005b99', warning: '#c66a00', danger: '#b42318' }`,
  `URGENCY_COLOR` = `{ overdue: '#b42318', soon: '#b54708' }` — exakt diese Werte (KoliBri rechnet
  den Kontrast selbst, der parsbare Hex-Wert muss erhalten bleiben).

## AK3 — Guard-Test deckt die drei Komponenten inklusive Mapping-Definitionen ab

- Vorbedingung: `frontend/src/lib/badge-colors.guard.test.ts`.
- Erwartung: `it.each` umfasst `TaskTable.tsx`, `TaskTree.tsx` und `Dashboard.tsx`; geprüft wird
  nicht nur das `_color`-Prop, sondern jedes Hex-Literal-String in der Datei (lokale
  Mapping-Konstanten wären sonst weiterhin erlaubt). Die bestehende Abdeckung
  (TaskTree/SeriesTab/MilestoneBadges) geht nicht verloren. Hex-Zeichen in Issue-Referenzen
  (`#2361`) sind keine Farbliterale und dürfen den Guard nicht auslösen — deshalb nur
  in Anführungszeichen stehende Hex-Strings prüfen.

## Kein E2E

Reine Code-Konsolidierung ohne sichtbare Änderung; die hex-identischen Werte sichert AK2 ab.
