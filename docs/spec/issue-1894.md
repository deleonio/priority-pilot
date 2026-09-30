# Spec #1894 — Gespeicherte Orte als eigener Tab

Die gespeicherten Orte (`PlaceFavoritesSection`, Adressbuch für Aufgaben) wandern aus dem Tab „Standort"
in einen eigenen Einstellungen-Tab „Orte". Fachlich ändert sich nichts (anlegen, löschen, Auswahl im
Adressfeld von Aufgabe und Serie, #1595).

## Tab-Reihenfolge und Routen

| Index | Label        | Segment      | Slot    |
| ----- | ------------ | ------------ | ------- |
| 3     | Standort     | `standort`   | `tab-3` |
| 4     | Orte (neu)   | `orte`       | `tab-4` |
| 5     | Gruppen      | `gruppen`    | `tab-5` |
| 6     | Kategorien   | `kategorien` | `tab-6` |
| 7     | Pakete       | `pakete`     | `tab-7` |
| 8     | Abo          | `abo`        | `tab-8` |
| 9     | Nutzerverw.  | `nutzer`     | `tab-9` |
| 9/10  | Access-Token | `zugriff`    | letzter |

Index-Parität `settingsTabs` (`SettingsPage.tsx`) ↔ `settingsPathSegments` (`App.tsx`); `PLANS_TAB_INDEX`
wird 7 („Pakete ansehen" im Abo-Tab springt weiter auf „Pakete").

## Verhalten

1. `/settings/orte` wählt „Orte"; das Panel `tab-4` zeigt `PlaceFavoritesSection` (AK1).
2. Das Standort-Panel `tab-3` enthält keine gespeicherten Orte mehr (AK2).
3. „Orte" hängt nicht am Geo-Schalter: bei ausgeschaltetem Standort voll bedienbar (AK3).
4. Adressfeld-Vorschläge unverändert (AK4, Bestandstest `issue-1342-place-favorites.spec.ts`).
5. Alle bisherigen Segmente wählen weiter den richtigen Tab, Member wie Admin (AK5).
6. 375 px: Tab per Klick erreichbar, Panel liegt in der Bounding-Box des Viewports (AK6).

## Test-Pflege

Index-Verschiebung um 1: `SettingsPage.test.tsx` und `App.test.tsx` (Slots `tab-6`→`tab-7`,
`tab-8`→`tab-9`, Tab-Liste), `issue-1342-place-favorites.spec.ts` (`/settings/standort` → `/settings/orte`).
