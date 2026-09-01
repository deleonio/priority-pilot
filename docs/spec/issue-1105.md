# App-Routes für alle Menüs (außer Dialoge)

**Stand:** 2026-09-01

## Ziel

Alle Haupt-Menüs der App sind unter eindeutigen, browser-nativen URLs erreichbar (React Router
v6): Browser-Back/Forward und Deep-Links funktionieren, Tab-Zustand wird aus der URL abgeleitet,
`/aufgaben` reagiert auf Query-Parameter. Dialoge bleiben Modals ohne URL-Effekt.

## Voraussetzungen

- Angemeldeter Nutzer (Auth-Gate durchlässig).
- SPA-Fallback des Dev-Servers liefert `index.html` für alle Pfade → Deep-Links laden die App.

## Schritte und erwartetes Ergebnis

### AK1 — 9 Routen rendern die zugehörige Ansicht

Direkter Aufruf (`page.goto`) jeder Route öffnet die richtige Ansicht:

| Route                | Ansicht (erkennbar an aktivem Tab / Panel)                       |
| -------------------- | ---------------------------------------------------------------- |
| `/`                  | Tab „Dashboard“ aktiv                                            |
| `/aufgaben`          | Tab „Aufgaben“ aktiv                                             |
| `/serien`            | Tab „Serien“ aktiv                                               |
| `/wald`              | Tab „Wald“ aktiv                                                 |
| `/hilfe`             | Hilfe-Seite (Markdown-Überschrift sichtbar)                      |
| `/settings/general`  | Settings-Tab „Allgemein“ aktiv                                   |
| `/settings/pillars`  | Settings-Tab „Säulen“ aktiv (Säulen-Gewichtungs-Editor sichtbar) |
| `/settings/llm`      | Settings-Tab „KI-Provider“ aktiv                                 |
| `/settings/standort` | Settings-Tab „Standort“ aktiv (Geo-Einstellungen sichtbar)       |

### AK2 — Navigation ändert die URL, Back/Forward stellt die Ansicht wieder her

Tab-Klick ändert den Pathname auf die Route der gewählten Ansicht. `page.goBack()` zeigt die
vorige Ansicht mit voriger URL (kein Reload nötig), `goForward()` entsprechend.

### AK3 — Deep-Links inklusive Settings-Panel

Siehe AK1-Tabelle; `/settings/:tab` wählt das richtige Panel.

### AK4 — Zustand aus URL abgeleitet

Aktiver Haupt-Tab und Settings-Tab sind reine Funktion der URL (bei Load und bei URL-Wechsel);
die Navigation läuft vollständig über den Router (keine parallelen pushState/popstate-Pfade).

### AK5 — `/aufgaben` Query-Parameter

- `/aufgaben?view=done` zeigt die erledigten Aufgaben (Umschalter geprüft, Tabelle statt Baum).
- Anwenden des Titel-Filters setzt `?q=<Begriff>` an die URL.
- Browser-Back stellt den vorherigen Filterzustand wieder her (URL + Ansicht).

### AK6 — Dialoge bleiben Modals

Öffnen und Schließen von Task-Dialog („Neuen Task anlegen“), Suche und Säulen-Berater ändern
Pathname und Query nicht (`page.url()` unverändert).

### AK7 — Regression

Bestehende Verhalten (Hilfe-Seite, Settings-Tabs, Aufgaben-Filter) bleiben unverändert.

### AK8 — Mobile-first 375 px

Alle Haupt-Routen sind bei 375 px Viewport ohne horizontalen Overflow nutzbar (Navigation
bedienbar, Inhalt `x + width <= 375`).
