# Spec #2358 — Serien als Vorlage (Frontend)

Server-Vertrag aus #2355: `autoCreate` (Default `true`); `rhythm: none` nur mit `autoCreate: false`; fehlendes `startDate` setzt der Server.

## Anlegen (TaskForm, Serien-Modus)

- Ziel: Serie als Vorlage ohne Automatik anlegen.
- Vorbedingung: Serien-Modus, Anlegen.
- Schritte/Erwartung:
  1. Schalter „Automatisch anlegen" über dem Rhythmus, standardmäßig an (AK1).
  2. Schalter an: Rhythmus-Optionen ohne „Ohne Rhythmus"; aus: „Ohne Rhythmus" (`none`) wählbar (AK2).
  3. Wahl `none`: Startdatum-Feld ausgeblendet; Speichern sendet `autoCreate: false`, `rhythm: none`, kein `startDate` (AK3).
  4. Schalter wieder an bei `none`: Rhythmus springt auf `weekly`, Startdatum wieder sichtbar; Speichern ohne 400 (AK4).

## Bearbeiten

- Schalter zeigt den gespeicherten `autoCreate`-Wert; Änderung geht im PATCH mit und bleibt nach erneutem Öffnen erhalten (AK5).

## Serien-Tab

- Serien mit `autoCreate === false` tragen das Text-Badge „Vorlage" (Reihenfolge Rhythmus, Vorlage, Ruhend); bei `none` entfällt das Rhythmus-Badge (AK6).
- Tab-Label `navigation:tabs.series`: de „Serien & Vorlagen", übrige 9 Sprachen eigene Übersetzung (AK7).
- Schalter und Rhythmus-Auswahl per Tastatur bedienbar, bei 375 px ≥ 44 px hoch (AK8, E2E).
