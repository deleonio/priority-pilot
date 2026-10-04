# Löschen-Schalter bei Orten kürzer beschriften — Balamentum

**Stand:** 2026-10-04  
**Ziel:** Von außen sichtbares Verhalten der Karte „Meine Orte“ (Einstellungen → Orte): die Löschen-Schaltfläche je Ort zeigt sichtbar nur „Löschen“, bleibt aber je Zeile eindeutig zuordenbar.

## Journey: Einen gespeicherten Ort über die gekürzte Schaltfläche löschen

### Ziel

In der Karte „Meine Orte“ trägt jede Löschen-Schaltfläche sichtbar nur das Wort „Löschen“ (keine Anschrift im sichtbaren Text). Der zugängliche Name enthält zusätzlich die vollständige Anschrift des Orts, sodass je Zeile eindeutig bleibt, welcher Ort gelöscht wird. Auf Mobile (375 px) bleibt die Schaltfläche ein Touch-Ziel von mindestens 44 px Höhe, und die Zeile läuft nicht horizontal aus dem Viewport.

### Vorbedingung

- Angemeldeter Nutzer
- Mindestens ein Standort-Favorit existiert (Karte „Meine Orte“ unter `/app/settings/orte`)

### Schritte

1. **Karte „Meine Orte“ öffnen**
   - Jede Favoritenzeile (`place-favorite-row`) zeigt eine Gefahren-Schaltfläche
   - Der sichtbare Text der Schaltfläche ist ausschließlich „Löschen“ (AK1)
2. **Schaltfläche mit Screenreader erkennen**
   - Der zugängliche Name beginnt mit „Löschen“ und enthält die vollständige Anschrift der eigenen Zeile (AK2) — bei mehreren Orten ist je Zeile eindeutig, welcher Ort gemeint ist
   - Technisch: `_label="Löschen"` plus visuell versteckter Anschrift-Text im Slot (`.visually-hidden`); der Bestätigungsdialog (#1595 AK6) bleibt unverändert
3. **Ort löschen (Mobile, 375 px)**
   - Die Schaltfläche ist mindestens 44 px hoch (AK3)
   - Die Zeile bleibt vollständig im Viewport, ohne horizontales Überlaufen (AK3; Bounding-Box-Check statt `scrollWidth` — die App-Shell clippt `overflow-x`)

### Erwartetes Ergebnis

- Sichtbare Beschriftung je Löschen-Schaltfläche: nur „Löschen“
- Zugänglicher Name je Löschen-Schaltfläche: „Löschen“ + vollständige Anschrift, je Zeile eindeutig
- Löschen läuft weiterhin über den Bestätigungsdialog („Endgültig löschen“)
- Kein horizontales Scrollen der Favoritenzeilen bei 375 px; Touch-Ziel ≥ 44 px

### Abgrenzung

- Kein UX-Lauf: der Label-Wortlaut („Löschen“) ist im Issue vorgegeben
- KoliBri-Constraint: `kol-button` hat keine `_ariaLabel`-Prop und liest kein `aria-label` vom Host — der zugängliche Name der Shadow-DOM-Taste entsteht aus `_label` UND dem Slot-Inhalt
