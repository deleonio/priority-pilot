# Issue 761 – Layout Titel/Beschreibung/Aktionen im Task-Formular

**Stand:** 2026-08-23  
**Version:** v1.1 (2026-08-23): Nightly-Sync — IST/SOLL-Arbeitsstand durch Ist-Beschreibung ersetzt (Verhalten ist per E2E `issue-761-layout-optimization.spec.ts` gesichert).

## Ziel

Im Task-Formular nutzen Titel und Beschreibung die volle verfügbare Breite ihrer Zeile; die Aktionen stehen rechtsbündig unterhalb der Felder.

## Vorbedingung

- Nutzer ist in der App angemeldet
- Task-Formular ist geöffnet (Anlegen über „Neuen Task anlegen" → „Überspringen", oder Bearbeiten)

## Schritte

1. **Layout prüfen**
   - Titel-Feld nimmt die volle verfügbare Breite ein
   - Beschreibung-Feld nimmt die volle verfügbare Breite ein (unterhalb des Titels)
   - Die Aktionen-Gruppe (z. B. „Anlegen"/„Abbrechen") ist rechtsbündig unterhalb der Felder platziert

2. **Responsive-Verhalten prüfen**
   - Mobile (375px), Tablet (768px), Desktop (1024px): Layout bleibt stabil, Aktionen bleiben rechtsbündig

## Erwartetes Ergebnis

- Titel und Beschreibung nehmen die volle verfügbare Breite ein
- Aktionen sind rechtsbündig unterhalb von Titel/Beschreibung platziert
- Responsive Design ist gewährleistet (Mobile, Tablet, Desktop)
- Touch-Ziele sind ausreichend groß (min. 44x44px laut KoliBri)
- A11y-Requirements sind erfüllt (Logical Tab-Order, Focus-Indikator, Screenreader-Support)
