# Einstellungen: Tab-Reihenfolge nach Paketstufe

**Stand:** 2026-09-30

Die Tab-Leiste der Einstellungen ist nach Paketstufe sortiert: Free-Bereiche vor Plus, „Pakete & Abo" zuletzt. Inhalte und Adressen der Tabs bleiben unverändert; es ändern sich nur Reihenfolge, Panel-Slots und Index-Zuordnung.

## Vorbedingung

Angemeldet, Route `/settings/<segment>`.

## Soll-Reihenfolge

| Index | Tab (Segment)                          | Panel-Slot |
| ----- | -------------------------------------- | ---------- |
| 0     | Allgemein (`general`)                  | `tab-0`    |
| 1     | Säulen (`pillars`)                     | `tab-1`    |
| 2     | Kategorien (`kategorien`)              | `tab-2`    |
| 3     | Standort (`standort`)                  | `tab-3`    |
| 4     | Orte (`orte`)                          | `tab-4`    |
| 5     | KI (`llm`)                             | `tab-5`    |
| 6     | Gruppen (`gruppen`)                    | `tab-6`    |
| 7     | Pakete & Abo (`pakete`)                | `tab-7`    |
| 8     | Nutzerverwaltung (`nutzer`, nur Admin) | `tab-8`    |

## Schritte / erwartetes Ergebnis

1. Member öffnet die Einstellungen → Tab-Leiste zeigt Index 0–7 in obiger Reihenfolge, ohne „Nutzerverwaltung" (AK1).
2. Admin → zusätzlich „Nutzerverwaltung" als letzter Tab (AK2).
3. `/settings/<segment>` aktiviert den Tab mit dem passenden Inhalt (Kategorien, Orte, KI, Gruppen, Pakete & Abo); die Legacy-Adressen `abo` → „Pakete & Abo", `zugriff` → „KI" gelten weiter (AK3).
4. `docs/user-guide.md` nennt alle Bereiche inkl. „Orte" in dieser Reihenfolge (AK4, Doku ohne Test).

`BASE_SETTINGS_TABS` (SettingsPage) und `BASE_SETTINGS_PATH_SEGMENTS` (App) bleiben index-parallel; unbekannte Segmente fallen weiter auf Index 1 („Säulen").
