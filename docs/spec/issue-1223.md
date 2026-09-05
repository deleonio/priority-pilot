# Spec #1223 — Gruppenübersicht der füreinander angelegten Aufgaben

Quelle: Issue #1223 (AK1–AK8) + KI-ANALYSE-Block + KI-UX-Block (Harness-Kommentar).
Rot-Tests: `server/src/express/groups-tasks.api.test.ts` (TF1/TF2),
`frontend/e2e/groups-for-each-other.spec.ts` (TF3/TF4).

## API-Vertrag (verbindlich für die Implementierung)

- Neuer Endpunkt **`GET /groups/{id}/tasks`** im groups-Router (hinter dem globalen
  `requireAuth`, Muster `GET /groups/:id/members`).
- Sichtbarkeit ausschließlich über die bestehende Membership-Lookup-Schicht
  (`findMembership`, `routes/groups.ts:55-61`): Nichtmitglied → **404** mit dem bestehenden
  Fehlertext-Muster; unauthentifiziert → **401** (globales requireAuth).
- Geliefert werden **genau** die Tasks, bei denen
  1. `userId != createdById` (Selbst-Aufgaben bleiben privat — auch für Admins), und
  2. `userId` und `createdById` beide Mitglieder dieser Gruppe sind (`createdById` `null`
     ⇒ Altbestand ohne Ersteller ⇒ nicht enthalten), und
  3. `status != 'Done'` (Abschnitt zeigt per Definition nur offene Aufgaben).
- Jeder Eintrag enthält **genau** die Felder:
  - `id: number`, `title: string`, `deadline: string | null` (ISO), `status: string`
  - `recipientName: string` — Anzeigename des Empfängers (Fallback E-Mail, `displayNameOf`-Muster)
  - `creatorName: string` — Anzeigename des Erstellers (Fallback E-Mail)
  - **Nicht** enthalten: `description`, `checklist`, jegliche E-Mail-Adressen, `userId`,
    `createdById` (reduzierter Feldsatz, Datenisolation — Issue begründet es selbst).
- Sortierung stabil: `recipientName` case-insensitive aufsteigend, dann `deadline`
  aufsteigend (ohne deadline zuletzt), dann `id` aufsteigend.
- `openapi.yml` (Pfad + Response-Schema, Tag `groups`) und die generierten Client-Typen
  werden mitgepflegt.

## AK1 — nur füreinander angelegte Aufgaben der Gruppe

- **Vorbedingung:** Gruppe mit Mitgliedern; Tasks für verschiedene Empfänger/Ersteller
  geseedet (auch ein Task eines Nicht-Mitglieds für ein Mitglied).
- **Schritte:** `GET /groups/{id}/tasks` als Mitglied.
- **Erwartet:** 200; Antwort enthält genau die Tasks, deren Ersteller und Empfänger beide
  Mitglieder sind und auseinanderfallen.

## AK2 — Selbst-Aufgaben bleiben privat

- **Erwartet:** Ein Task mit `userId == createdById` erscheint nicht — auch nicht für
  Gruppen-Admins; ein Altbestand ohne `createdById` ebenso nicht.

## AK3 — Done-Aufgaben erscheinen nicht

- **Erwartet:** Tasks mit `status = 'Done'` fehlen in der Antwort.

## AK4 — reduzierter Feldsatz

- **Erwartet:** Jeder Eintrag hat exakt `id`, `title`, `deadline`, `status`,
  `recipientName`, `creatorName`; Anzeigenamen statt E-Mails; kein `description`,
  kein `checklist`.

## AK5 — Nichtmitglied → 404, unauthentifiziert → 401

- **Erwartet:** Authentifiziertes Konto ohne Membership → 404 (keine Existenz-Leckage);
  Request ohne Session → 401.

## AK6 — stabile Sortierung

- **Vorbedingung:** Zwei Empfänger, deren Anzeigenamen sich in case-insensitiver und
  Byte-Sortierung unterscheiden (z. B. „anna …“ vor „Bob …“); je Empfänger Tasks mit
  verschiedenen, gleichen und fehlenden Deadlines.
- **Erwartet:** Empfänger case-insensitive aufsteigend; innerhalb dessen `deadline`
  aufsteigend, ohne deadline zuletzt; Gleichstand nach `id` aufsteigend.

## AK7 — Abschnitt „Füreinander angelegt“ im Gruppendetail

- **Vorbedingung:** aufgeklappte Gruppe in Einstellungen → Gruppen.
- **Erwartet:** Abschnitt mit der Überschrift „Füreinander angelegt“; je Eintrag der
  Task-Titel, der Empfängername und der Ersteller als Sekundärzeile „von {name}“
  (KI-UX: Empfänger als Haupteintrag, Ersteller als Sekundärzeile; Einträge nicht klickbar).
- **Leerzustand:** Solange niemand etwas für ein anderes Mitglied angelegt hat (auch, wenn
  nur Selbst-Aufgaben existieren), steht der Hinweistext
  „Noch hat niemand eine Aufgabe für ein anderes Mitglied angelegt.“ statt einer leeren Liste.

## AK8 — 375 px ohne horizontales Scrollen

- **Erwartet:** Bei 375 px Viewport bleibt der Abschnitt (Überschrift und jeder Listeneintrag)
  innerhalb des Viewports — per Bounding-Box geprüft, **nicht** per `scrollWidth`
  (App-Shell clippt `overflow-x:hidden`, Erfahrung 2026-08-24).
