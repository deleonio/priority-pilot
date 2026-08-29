# Spec #1121 — Geo-Badge hinter dem Task-Titel statt in der Badge-Gruppe

**Stand:** 2026-08-29

## Ziel

Im TaskTree (`LeafItem`, `frontend/src/components/TaskTree.tsx`) steht das Globus-Badge heute in
der Badge-Gruppe vor dem „…"-Menüschalter. Es soll unmittelbar hinter dem Titeltext stehen —
durch genau ein geschütztes Leerzeichen (U+00A0) getrennt —, damit der Ortsbezug direkt am
Aufgabennamen ablesbar ist und die Badge-Gruppe wieder nur Status-Aussagen (Serie, geändert,
Fortschritt, Priorität) trägt. Vorbild ist die Anordnung in `CompletedTasksTable.tsx:121-136`
(`done-title-cell`: Titel + GeoBadge in einem Wrapper). `GeoBadge.tsx` bleibt unangetastet —
`role="img"`, `aria-label="Standort: …"` (Reverse-Geocoding mit Fallback) und
`data-testid="geo-badge"` sind Vertragsbestandteil (#1063).

## Preconditions

- Task mit Ortsbezug: `latitude != null || address != null` (Render-Bedingung,
  `TaskTree.tsx:106-110`).
- Titel Maximum 30 Zeichen (`server/src/models/task.ts:93`).
- KolHeading ist eine Web Component: U+00A0 und Icon liegen als Geschwister des Heading im
  Header (Light DOM), nicht im `_label`.

## Verhalten (Akzeptanzkriterien)

### AK1 — DOM-Reihenfolge in der Task-Zeile

In einer Task-Zeile mit Ortsbezug liegt das Element `data-testid="geo-badge"` innerhalb des
Headers `task-tree-row-header` und im DOM unmittelbar nach dem Titel (`.task-tree-title`) sowie
vor `task-tree-row-controls`. Nicht mehr in der Badge-Gruppe `task-tree-badges` (AK3).

### AK2 — Genau ein geschütztes Leerzeichen, gemeinsame Umbrucheinheit

Zwischen Titel und Icon steht genau ein Textknoten `U+00A0` (kein normales Leerzeichen, kein
Mehrfaches). Titel + Icon bilden eine Umbrucheinheit: Bei schmalem Viewport bricht das Icon
nicht isoliert in eine eigene Zeile unterhalb des Titeltexts um.

### AK3 — Kein `geo-badge` in der Badge-Gruppe

`.task-tree-badges` enthält kein `geo-badge` mehr.

### AK4 — Übrige Badges unverändert

Serie, geändert, Fortschritt und Priorität bleiben in `.task-tree-badges` vor dem Menüschalter,
in Reihenfolge und Props wie `TaskTree.tsx:92-107`. (Hinweis: „Fortschritt" erscheint im
Blatt-Task-Listing seit #537 nicht — Eltern-Tasks mit Sub-Tasks sind dort nicht sichtbar; der
Guard prüft daher die setzbaren Badges an ihrer Position.)

### AK5 — Keine Task-Zeile ohne Ortsbezug dekoriert

Bei einer Zeile ohne Ortsbezug existiert weder ein `geo-badge` noch ein U+00A0-Textknoten hinter
dem Titel.

### AK6 — GeoBadge-Vertrag bleibt (Regression)

`role="img"`, `aria-label="Standort: …"` (aufgelöste Adresse bzw. Fallback) und
`data-testid="geo-badge"` bleiben; `GeoBadge.tsx` wird nicht geändert. Bereits durch die
Sichtbarkeits- und aria-label-Assertions in `frontend/e2e/issue-1063-geo-badge.spec.ts` (AK4/AK5)
abgedeckt — kein Duplikat-Test.

### AK7 — 375px ohne horizontalen Überlauf (Regression)

Bei 375px überläuft die Task-Zeile mit langem Titel (30 Zeichen) und Globus-Icon den Viewport
nicht. Bereits durch `issue-1063-geo-badge.spec.ts` AK6 (Task-Zeilen-Bounding-Box bei 375px mit
30-Zeichen-Titel + Adresse) abgedeckt — kein Duplikat-Test.

## Testpflege

Keine Alt-Tests zu entfernen; `issue-1063-geo-badge.spec.ts` bleibt unverändert gültig
(zeilen-scoped Assertions überleben den Umzug innerhalb derselben Zeile).
