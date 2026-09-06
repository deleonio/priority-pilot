# Spec #1249 — Säulen-Beiträge gegen das Empfänger-Konto prüfen

## Ziel

Säulen-Beiträge (`pillars`) bei `POST /tasks`, `POST /series` und `PATCH /series/{id}` werden gegen
das Konto geprüft, dem die Aufgabe/Serie gehört — beim Anlegen für einen Empfänger also gegen das
Empfänger-Konto, nicht das Ersteller-Konto. Eine Prüfung ohne Kontobezug ist unzulässig.

## Voraussetzung

- Nutzer-eigene Säulen (`pillars.userId`, Unique-Index auf `name` + `userId`): derselbe Säulen-Name
  existiert pro Konto als eigene Zeile mit eigener Id.
- `POST /tasks`/`POST /series` erlauben optional `userId` im Body (Empfänger, geteilte Gruppe
  erforderlich, sonst 403) — Empfänger-Prüfung bleibt VOR der Säulen-Prüfung bestehen.
- `PATCH /tasks/{id}` prüft bereits korrekt gegen den Aufrufer (owner-scoped) und bleibt unverändert.

## Schritte / erwartetes Verhalten

1. **Task-Anlage mit Empfänger (AK1, AK2, AK6):** Alice (Erstellerin) legt per `POST /tasks` mit
   `userId: bobId` einen Task an.
   - Bezieht `pillars` eine Säule aus Alices Konto → **400**, es wird weder ein Task noch eine
     `task_pillars`-Verknüpfung angelegt.
   - Bezieht `pillars` eine Säule aus Bobs Konto → **201**; der Task gehört Bob (`tasks.userId`) und
     ist in `task_pillars` exakt mit der Säulen-Id des Empfängers verknüpft — selbst dann, wenn Alice
     eine gleichnamige Säule besitzt (AK6: Id-Orakel, nicht Namensgleichheit).
2. **Series-Anlage (AK3):** `POST /series` mit `userId` (Empfänger) und einer Säule, die weder dem
   Aufrufer noch dem Empfänger gehört → **400**, keine Serie angelegt. (Status quo: 201, globale Prüfung.)
3. **Series-Änderung (AK4):** `PATCH /series/{id}` prüft `pillars` gegen `series.userId` (Eigentümer
   der Serie), nicht gegen den Aufrufer. Säule eines Drittkontos → **400**. (Status quo: 200.)
4. **Pflichtparameter Konto (AK5):** `arePillarsExistent(pillarIds, userId)` verlangt den Kontobezug
   als Pflichtparameter; der optionale globale Fallback entfällt. Ein Aufruf ohne Konto ist nicht mehr
   kompilierbar (Absicherung über `tsc --noEmit` in den Gates, kein Laufzeit-Test möglich).
5. **Bestandsnachweis (AK7):** read-only SQL-Abfrage, die bestehende Fehlverknüpfungen findet
   (`task_pillars`/`series_pillars` gegen `pillars.userId` vs. `tasks`/`series.userId`), im
   Implementierungs-PR dokumentiert; keine automatische Bereinigung.

## Abgrenzungen

- `replaceContributions`/`task_pillars`/`series_pillars`-Tabellen und die Serien-Instanz-Erzeugung
  bleiben unberührt.
- Keine UI-Änderung: Das Frontend zeigt 400-Texte bereits über bestehende Fehler-States.

## Test-Dateien

- `server/src/express/pillar-ownership.test.ts` (AK1–AK4, AK6; rote API-Tests)
- `server/src/logics/pillarContributions.test.ts` (AK5: jeder Aufruf mit Konto; Signatur-Absicherung
  über tsc in den Gates)
