# Geo-Badge (Globus) für Aufgaben und Serien mit Ortsbezug

**Stand:** 2026-08-30

## Ziel

Einträge mit Ortsbezug (`address` und/oder Koordinaten) sind auf den ersten Blick erkennbar: In der Serienliste (`SeriesTab`), in der Aufgaben-Liste (TaskTree) und in der Erledigt-Liste (`CompletedTasksTable`) zeigt ein Globus-Badge (Font Awesome `fa-solid fa-globe`, kein Emoji), dass die Serie bzw. der Task einen Ortsbezug trägt.

## Ortsbezug an der Serien-API

- `POST /series` und `PATCH /series/:id` akzeptieren `address` (String ≤ 255 Zeichen oder `null`); `GET /series` und `GET /series/:id` geben es zurück. Ohne Angabe gilt `address === null`.
- Validierung analog Tasks: Zahl oder mehr als 255 Zeichen → 400; `null` löscht einen bestehenden Ortsbezug; leerer String wird wie `null` behandelt.
- `generateDueInstances` schreibt `address: series.address ?? null` als Snapshot auf jede neu generierte Instanz (Semantik wie `description`). Nachträgliche Template-Änderungen wirken nur auf künftige Instanzen — bestehende behalten ihren Snapshot.
- `PATCH /series/:id` mit `applyToInstances=true` übernimmt ein geändertes `address` auf alle offenen (nicht erledigten) Instanzen mit `seriesId = :id`; erledigte Instanzen bleiben unverändert. Ohne `applyToInstances` bleiben alle Instanzen unangetastet.

## Globus-Badge

- Jede Serie mit Ortsbezug zeigt in ihrer Zeile ein Globus-Badge; Serien ohne Ortsbezug zeigen keins.
- Jeder Task mit Ortsbezug zeigt in der Aufgaben-Liste (TaskTree) und in der Erledigt-Tabelle das Badge; Tasks ohne Ortsbezug zeigen keins.
- Das Badge ist rein informativ (nicht klickbar), icon-only und transportiert seine Bedeutung für assistive Technologien über `aria-label` (enthält „Standort"); Verankerung für Tests: `data-testid="geo-badge"`.

## Mobile (375px)

Bei 375px Viewport verursacht das Badge in allen drei Listen keinen horizontalen Überlauf: Zeile bzw. Tabellen-Host bleiben vollständig in der Viewport-Breite (Bounding-Box-Messung — die App-Shell clippt mit `overflow-x: hidden`, `scrollWidth` wäre strukturell grün).
