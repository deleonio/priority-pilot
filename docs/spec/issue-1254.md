# Spec #1254 — Gruppenübersicht der füreinander angelegten Serien

Quelle: Issue #1254 (AK1–AK7) + KI-ANALYSE-Block + KI-UX-Block (Harness-Kommentar).
Rot-Tests: `server/src/express/groups-series.api.test.ts` (TF1–TF3),
`frontend/e2e/groups-series-for-each-other.spec.ts` (TF4/TF5).

## API-Vertrag (verbindlich für die Implementierung)

- Neuer Endpunkt **`GET /groups/{id}/series`** im groups-Router (hinter dem globalen
  `requireAuth`), getrennt von `GET /groups/{id}/tasks` (#1223 bleibt unangetastet).
- Sichtbarkeit über `findMembership` (Muster `GET /groups/:id/tasks`, `routes/groups.ts`):
  Nichtmitglied → **404** mit „Gruppe nicht gefunden."; unauthentifiziert → **401**.
- Geliefert werden genau die Serien, bei denen
  1. `userId` und `createdById` beide gesetzt sind und voneinander abweichen
     (Selbst-Anlagen und Altbestand ohne Ersteller fehlen — auch für Admins, kein
     Rollen-Sonderweg), und
  2. `userId` und `createdById` beide Mitglieder dieser Gruppe sind.
- `active:false`-Serien („ruhend", z. B. nach `restCrossMemberSeries`) sind enthalten
  und werden im DTO mit `active: false` gekennzeichnet.
- Jeder Eintrag enthält **genau** die Felder:
  - `id: number`, `title: string`, `rhythm: string`, `active: boolean`
  - `ownerName: string` — Anzeigename des Eigentümers (`displayNameOf`-Muster)
  - `creatorName: string` — Anzeigename des Erstellers
  - **Nicht** enthalten: `description`, `address`, `latitude`, `longitude` (Datenisolation
    über die Gruppenmitgliedschaft würde sonst ausgehebelt), keine E-Mail-Adressen,
    kein `userId`/`createdById`.
- Sortierung stabil: `ownerName` aufsteigend (akzent-/case-unempfindliches
  `localeCompare`), darin `title` aufsteigend (ebenso), Tiebreaker `id` aufsteigend.
- `openapi.yml` (Pfad `/groups/{id}/series` + Schema `GroupSeries`, Tag `groups`) und die
  generierten Client-Typen (`frontend/src/api.ts` → typisierte Methode `getGroupSeries`)
  werden mitgepflegt — Konfigurationspflege, per ADR 0001 ohne eigenen String-Match-Test;
  die clientseitige Wirkung (Abschnitt lädt im selben Ladevorgang) deckt TF4 ab.

## AK1 — nur füreinander angelegte Serien der Gruppe

- **Vorbedingung:** Gruppe mit Admin Alice und Mitgliedern Bob/Anna; Carol ohne
  Mitgliedschaft. Serien mit verschiedenen Eigentümer/Ersteller-Kombinationen geseedet
  (auch eine Serie eines Nicht-Mitglieds für ein Mitglied, eine Selbst-Anlage und eine
  Altbestands-Serie ohne `createdById`).
- **Schritte:** `GET /groups/{id}/series` als Mitglied.
- **Erwartet:** 200; genau die Serien, deren Eigentümer und Ersteller beide Mitglieder
  sind und auseinanderfallen — Selbst-Anlage fehlt auch für den Admin, Fremd-Ersteller
  und Altbestand ebenso.

## AK2 — reduzierter Feldsatz

- **Erwartet:** Jeder Eintrag hat exakt `id`, `title`, `rhythm`, `active`, `ownerName`,
  `creatorName`; keine Beschreibung, Adresse, Koordinaten, E-Mails.

## AK3 — Nichtmitglied → 404, unauthentifiziert → 401

- **Erwartet:** Authentifiziertes Konto ohne Membership → 404 „Gruppe nicht gefunden.";
  Request ohne Session → 401.

## AK4 — stabile Sortierung

- **Vorbedingung:** Eigentümer, deren Anzeigenamen in case-insensitiver und Byte-
  Sortierung auseinanderlaufen („anna …“ vor „Bob …“); je Eigentümer mehrere Titel,
  davon ein Titel-Paar mit Gleichstand (Tie per `id`).
- **Erwartet:** ownerName case-insensitive aufsteigend; darin title case-insensitive
  aufsteigend; Gleichstand nach `id` aufsteigend.

## AK5 — OpenAPI/Client/Parallel-Laden

- `openapi.yml` + Codegen liefern `getGroupSeries` (Vertrag, s. o.); GroupDetail lädt
  Aufgaben und Serien **im selben** `Promise.all` (KI-UX Regel 7: kein zweiter
  Spinner-Lauf, kein Springen von leer auf voll).
- Prüfbar von außen (e2e): der Serien-Abschnitt erscheint mit derselben
  Detail-Ansicht wie der Aufgaben-Abschnitt, ohne zusätzliche Nutzer-Interaktion.

## AK6 — Abschnitt „Füreinander angelegte Serien“ im Gruppendetail

- **Vorbedingung:** aufgeklappte Gruppe in Einstellungen → Gruppen.
- **Erwartet:** eigener Abschnitt (DOM-Reihenfolge: Aufgaben-Block, dann Serien-Block,
  dann Admin-Bereich) mit Überschrift „Füreinander angelegte Serien“; Liste als
  `<ul class="group-series">` mit Einträgen `li.group-series-entry`; je Eintrag der
  Titel, der Rhythmus (sichtbar, z. B. „weekly“/„Wöchentlich“), der Eigentümer als
  Haupteintrag und der Ersteller als Sekundärzeile „von {name}“ (KI-UX); Einträge
  nicht klickbar.
- **Leerzustand:** Ohne füreinander angelegte Serien steht der Hinweis
  „Noch hat niemand eine Serie für ein anderes Mitglied angelegt.“ statt einer leeren
  Liste.
- **Ruhend:** Einträge mit `active:false` tragen ein Badge mit dem Text „Ruhend“ —
  nie nur Farbcodierung (WCAG 1.4.1).

## AK7 — 375 px ohne horizontales Scrollen

- **Erwartet:** Bei 375 px Viewport bleiben Überschrift und jeder Listeneintrag im
  Viewport — per Bounding-Box geprüft, **nicht** per `scrollWidth` (App-Shell clippt
  `overflow-x:hidden`, Erfahrung 2026-08-24).
