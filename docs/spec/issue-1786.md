# Spec #1786 — Website und App zeigen Free/Plus/Pro

Ziel: Preisseite (Website, 10 Sprachen) und Paketansicht der App nennen genau Free, Plus und Pro (ADR 0018).

## Website-Preisseite

- Genau drei Paketkarten (`data-plan`): free, plus, pro (AK1).
- Plus und Pro zeigen Monats-, Quartals- und Jahrespreis, locale-formatiert, aus `catalog.prices` (`plans.ts`): Plus 4,99 / 13,47 / 47,90 €, Pro 9,99 / 26,97 / 95,90 € (AK2). Free bleibt „kostenlos" ohne Periodenpreise.
- Kein gerendertes HTML enthält „Max", „Ultimate" oder eine Anfragenzahl der KI-Hilfe; die MCP-Zeile nennt Lesen ab Plus, Lesen und Schreiben in Pro (AK3).
- Keine Preiskopie im Website-Code: ein anderer Katalog ändert die Ausgabe (AK4).
- 375 px: Karten ohne Überlauf, alle Periodenpreise sichtbar (AK6).

## App-Paketansicht

- `PlansSection` zeigt genau die Spalten Free/Plus/Pro mit drei Preiszeilen, ohne Max/Ultimate (AK5).

## Test-Pflege

Bestehende Fixtures mit pro/max/ultimate (`PlansSection.test.tsx`, `PlanBadge.test.tsx`, E2E-Specs) zieht die Umsetzung auf free/plus/pro nach.
