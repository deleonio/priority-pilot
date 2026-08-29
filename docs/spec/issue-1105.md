# Spec #1105 — App-Routes für alle Menüs (außer Dialoge)

## Ziel

Alle Haupt-Menüs der App sind unter eindeutigen, browser-nativen URLs erreichbar (React Router
v6): Browser-Back/Forward und Deep-Links funktionieren, Tab-Zustand wird aus der URL abgeleitet,
`/aufgaben` reagiert auf Query-Parameter. Dialoge bleiben Modals ohne URL-Effekt.

## Voraussetzungen

- Auth-Gate durchlässig (`/auth/me` gemockt in `frontend/e2e/fixtures.ts`).
- Vite SPA-Fallback liefert `index.html` für alle Pfade → Deep-Links laden die App.

## Schritte und erwartetes Ergebnis

### AK1 — 8 Routen rendern die zugehörige Ansicht

Direkter Aufruf (`page.goto`) jeder Route öffnet die richtige Ansicht:

| Route               | Ansicht (erkennbar an aktivem Tab / Panel)                       |
| ------------------- | ---------------------------------------------------------------- |
| `/`                 | Tab „Dashboard“ aktiv                                            |
| `/aufgaben`         | Tab „Aufgaben“ aktiv                                             |
| `/serien`           | Tab „Serien“ aktiv                                               |
| `/wald`             | Tab „Wald“ aktiv                                                 |
| `/hilfe`            | Hilfe-Seite (Markdown-Überschrift sichtbar)                      |
| `/settings/general` | Settings-Tab „Allgemein“ aktiv                                   |
| `/settings/pillars` | Settings-Tab „Säulen“ aktiv (Säulen-Gewichtungs-Editor sichtbar) |
| `/settings/llm`     | Settings-Tab „KI-Provider“ aktiv                                 |

### AK2 — Navigation ändert die URL, Back/Forward stellt die Ansicht wieder her

Tab-Klick ändert den Pathname auf die Route der gewählten Ansicht. `page.goBack()` zeigt die
vorige Ansicht mit voriger URL (kein Reload nötig), `goForward()` entsprechend.

### AK3 — Deep-Links inklusive Settings-Panel

Siehe AK1-Tabelle; `/settings/:tab` wählt das richtige Panel. (Teilweise bereits abgedeckt durch
`help.spec.ts` und `settings-page.spec.ts` — hier nur die noch fehlenden Routen.)

### AK4 — Zustand aus URL abgeleitet, handgestrickte Navigation entfernt

Aktiver Haupt-Tab und Settings-Tab sind reine Funktion der URL (bei Load und bei URL-Wechsel);
die pushState/popstate-Fragmente (`App.tsx` `openHelp`/`closeHelp`/`openSettings`/`closeSettings`,
popstate-Listener; `SettingsPage.tsx` Init aus `window.location.pathname`) sind durch React Router
ersetzt. Verhalten wird über AK1/AK2 e2e eingeklagt (kein Doppeltest auf Unit-Ebene).

### AK5 — `/aufgaben` Query-Parameter

- `/aufgaben?view=done` zeigt die erledigten Aufgaben (Umschalter geprüft, Tabelle statt Baum).
- Anwenden des Titel-Filters setzt `?q=<Begriff>` an die URL.
- Browser-Back stellt den vorherigen Filterzustand wieder her (URL + Ansicht).

### AK6 — Dialoge bleiben Modals

Öffnen und Schließen von Task-Dialog („Neuen Task anlegen“), Suche und Säulen-Berater ändern
Pathname und Query nicht (`page.url()` unverändert).

### AK7 — Bestehende Tests bleiben grün

Kein neuer Test: Regression läuft über `help.spec.ts`, `settings-page.spec.ts`,
`settings-tabs.spec.ts`, `tasks-tab-filter.spec.ts` und die Unit-Suites in CI.

### AK8 — Mobile-first 375 px

Alle Haupt-Routen sind bei 375 px Viewport ohne horizontalen Overflow nutzbar (Navigation
bedienbar, Inhalt `x + width <= 375`).
