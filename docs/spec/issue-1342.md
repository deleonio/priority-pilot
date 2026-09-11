# Spec: Standort-Favoriten (#1342)

Status: rot (Spec-Phase) — Tests in `server/src/express/place-favorites.test.ts`,
`frontend/src/components/AddressAutocomplete.test.tsx`, `frontend/src/components/TaskForm.test.tsx`,
`frontend/src/components/PlaceFavoritesSection.test.tsx`, `frontend/e2e/issue-1342-place-favorites.spec.ts`.

## Ziel

Gespeicherte Orte stehen im Adressfeld von Aufgabe und Serie oberhalb der Suchtreffer und
übernehmen mit einem Klick Adresse plus Koordinaten. Speichern gelingt direkt am Formular (Stern in
der Trefferzeile, Knopf „Als Favorit speichern" am ausgefüllten Feld); Verwalten (Anlegen,
Umbenennen, Löschen) läuft unter Einstellungen → Standort. Favoriten hängen am Konto und stehen auf
jedem Gerät nach der Anmeldung zur Verfügung.

## Datenmodell (Vertrag)

- `PlaceFavorite` (`server/src/models/placeFavorite.ts`, neu): `id`, `userId` (Pflicht, FK auf
  `users`, Datenisolation #207), `name` (nicht-leerer String, ≤ 60 Zeichen, analog `apiToken.ts`),
  `address` (String), `latitude`/`longitude` (nullable Float — ein Freitext-Favorit ohne
  Geocoding-Treffer hat beide `null`, AK4). Muster: `server/src/models/apiToken.ts` (schlankes
  Pro-User-Modell mit Soft-Delete-Präzedenz — hier jedoch Hard-Delete, da kein Nachvollziehbarkeits-
  bedarf wie beim API-Token-Rückzug besteht).

## API-Vertrag (Router `server/src/express/routes/placeFavorites.ts`, neu)

Hinter `requireAuth`:

| Route                        | Verhalten                                                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /place-favorites`       | Body `{name, address, latitude?, longitude?}`. 201 mit dem angelegten Favoriten; `latitude`/`longitude` fehlen im Body → `null` in der Antwort (AK4). Leerer/zu langer Name → 400. |
| `GET /place-favorites`        | Liste der eigenen Favoriten: je `{id, name, address, latitude, longitude}`.                                                            |
| `PATCH /place-favorites/{id}` | Body `{name}` — benennt um. Fremder/unbekannter Favorit → 404.                                                                          |
| `DELETE /place-favorites/{id}`| Entfernt den Favoriten endgültig; 204. Fremder/unbekannter Favorit → 404.                                                               |

Ohne Session antworten alle vier Routen mit 401 (kein Fallthrough).

## Frontend-Vertrag

- `AddressAutocomplete` (`frontend/src/components/AddressAutocomplete.tsx`) bekommt zwei neue
  optionale Props: `favorites: {id, name, address, lat, lon}[]` und
  `onSaveFavorite?: (hit: AddressSuggestion) => void`. Favoriten rendern als eigene
  `role="option"`-Zeilen VOR den Suchtreffern (gleiche Listbox, gleicher Auswahlpfad —
  `onSelect({address, lat, lon})`, `lat`/`lon` `null` bei Freitext-Favoriten, AK4). Jede
  Suchtreffer-Zeile bekommt zusätzlich ein Stern-Bedienelement (`role="button"`, Label „Als Favorit
  speichern …", eigener Klick-Handler) — es liegt als Geschwister-Element NEBEN der Option, nicht
  als deren Nachfahre (ARIA-1.2: `role="option"` darf keine interaktiven Nachfahren enthalten,
  KI-UX-Block zu #1342). Ein Klick auf den Stern ruft `onSaveFavorite` auf, OHNE `onSelect` zu
  feuern oder die Liste zu schließen.
- `TaskForm.tsx` lädt beim Mount `api.listPlaceFavorites()` und reicht die Liste als `favorites` an
  `AddressAutocomplete` durch (AK1). Ein Knopf „Als Favorit speichern" neben dem Adressfeld ist nur
  sichtbar, wenn die Adresse nicht leer ist; ein Klick ruft `api.createPlaceFavorite({name: address,
  address, latitude, longitude})` mit den aktuell im Formular stehenden Koordinaten auf (AK2). Nach
  Anlegen (Stern ODER Feld-Knopf) erscheint der neue Favorit ohne Neuladen in der Feld-Liste — dafür
  hält `TaskForm` die geladene Favoritenliste selbst im State und hängt den Server-Rückgabewert an,
  statt neu zu fetchen.
- `PlaceFavoritesSection.tsx` (neu, Einstellungen → Standort, `data-testid="place-favorite-row"` je
  Zeile): Formular zum Anlegen (Name + Adresse, ohne Koordinaten-Erfassung — dieser Weg ist für
  manuell erfasste Orte gedacht, AK4), Inline-Umbenennen (`KolInputText`, Button „Favorit
  umbenennen" öffnet, „Übernehmen"/„Speichern" bestätigt) und Löschen mit zweistufiger Bestätigung
  (Muster `ApiTokensSection.tsx`/`docs/ux-pattern-sequential-confirmation.md`). Nach Löschen
  verschwindet die Zeile ohne Neuladen; ein gelöschter Favorit erscheint nach einem Refetch nicht
  mehr im Adressfeld anderer Formulare (Server ist die Quelle der Wahrheit, AK3/AK5).
- Bei 375px Viewportbreite bleiben Favoritenzeilen im Adressfeld und die Verwaltungskarte
  vollständig im sichtbaren Bereich (Bounding-Box-Assertion statt `scrollWidth`, MEMORY
  2026-08-24/2026-09-10 — die App-Shell clippt mit `overflow-x: hidden`); jedes Bedienelement
  (Stern, Umbenennen, Löschen) hat ein Touch-Ziel von mindestens 44px Höhe (AK6).

## Akzeptanzkriterien → Tests

- AK1 → `frontend/src/components/AddressAutocomplete.test.tsx` (Favoriten vor Suchtreffern, Klick
  übernimmt address/lat/lon), `frontend/src/components/TaskForm.test.tsx` (geladener Favorit landet
  im Formularzustand + Speichern-Payload).
- AK2 → `frontend/src/components/AddressAutocomplete.test.tsx` (Stern ruft `onSaveFavorite` ohne
  `onSelect`), `frontend/src/components/TaskForm.test.tsx` (Feld-Knopf nur bei gefüllter Adresse,
  `api.createPlaceFavorite`-Aufruf).
- AK3 → `frontend/src/components/PlaceFavoritesSection.test.tsx` (Anlegen/Umbenennen/Löschen gegen
  gemockte `api`, gelöschter Eintrag verschwindet aus der Liste).
- AK4 → `server/src/express/place-favorites.test.ts` (POST ohne Koordinaten → 201 mit
  `latitude`/`longitude: null`), `frontend/src/components/AddressAutocomplete.test.tsx` (Auswahl
  eines koordinatenlosen Favoriten übergibt `lat`/`lon: null`).
- AK5 → `server/src/express/place-favorites.test.ts` (401 ohne Session, Liste nur eigener Einträge,
  404 bei PATCH/DELETE auf fremde Favoriten, Favoriten bleiben über eine zweite Sitzung desselben
  Kontos erhalten).
- AK6 → `frontend/e2e/issue-1342-place-favorites.spec.ts` (kompletter Weg bei 375px:
  Formular-Speichern → Settings-Umbenennen → Feld-Auswahl → Löschen; Bounding-Box- und
  Touch-Ziel-Prüfung je Bedienelement).

## Scope-Grenzen

- Keine Obergrenze der Favoritenzahl — nicht in den AKs verlangt (Annahme aus dem Analyse-Block).
- Keine eigene Umbenennen-Route am Adressfeld selbst — Umbenennen ist laut Ticket ausdrücklich Sache
  der Einstellungen (Analyse-Block, „Annahmen").
- `openapi.yml`/generierte `client`-Typen sind Teil der Implementierung, nicht der Spec-Phase (Spec-
  PR-Scope-Regel) — die Frontend-Tests mocken `../api` deshalb vollständig statt echte Typen zu
  importieren.
