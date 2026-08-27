# PWA-Update-/Offline-Hinweis — Priority Pilot

**Stand:** 2026-08-27  
**Ziel:** Von außen sichtbares Verhalten der Update-/Offline-Cards am unteren Viewport-Rand

## Journey: Update-Hinweis und Offline-Hinweis bedienen

### Ziel

Bei neuer App-Version bzw. abgeschlossener Offline-Vorbereitung zeigt die App eine Card am unteren Rand mit menschlich-beschreibenden Texten und auf Mobile gut bedienbarem Aktionsbutton.

### Vorbedingung

- App ist geöffnet
- Update-Card erscheint, wenn eine neue Version bereitsteht (`needRefresh`); Offline-Card, wenn die App offline einsatzbereit ist (`offlineReady`)

### Schritte

1. **Update-Card betrachten**
   - Card-Label: „Neue Version verfügbar"
   - Fließtext: „Priority Pilot wurde aktualisiert. Lade die App neu, um die neue Version zu nutzen."
   - Button: „Jetzt neu laden"
   - Klick auf den Button lädt die App neu (Service-Worker-Update)

2. **Offline-Card betrachten**
   - Card-Label: „Offline einsatzbereit"
   - Fließtext: „Priority Pilot funktioniert ab jetzt auch ohne Internetverbindung."
   - Button: „Verstanden"
   - Klick auf den Button schließt die Card

3. **Auf Mobile (375 px) bedienen**
   - Der Aktionsbutton je Card ist mindestens 44×44 px groß und füllt die Card-Innenbreite

4. **Auf Desktop (ab 768 px) betrachten**
   - Die Cards bleiben am unteren Viewport-Rand fixiert; der Button kehrt auf kompakte Standardbreite zurück

### Erwartetes Ergebnis

- Beide Cards tragen die oben genannten Labels, Texte und Button-Beschriftungen
- Auf schmalen Viewports ist der Aktionsbutton eine volle-Breite-Tap-Fläche ≥ 44×44 px (WCAG 2.5.8); kein Kind-Element der Card läuft aus dem Viewport (320 px)
- Ab 768 px: Card-Position unverändert `position: fixed; bottom: 0`, kein Mobile-Layout
- Ohne Update- und Offline-Ereignis rendern die Cards nicht

### Randfälle & Fehler

| Situation                       | Erwartetes Verhalten                          |
| ------------------------------- | --------------------------------------------- |
| Weder Update noch Offline ready | Keine Card sichtbar                           |
| Sehr schmaler Viewport (320 px) | Kein horizontales Überlaufen der Card-Inhalte |
| Beide Ereignisse gleichzeitig   | Beide Cards erscheinen untereinander          |
