# Spec #1213 — Aufgabe für ein Gruppenmitglied anlegen

Quelle: Issue #1213 (AK1–AK8) + KI-UX-Block (Harness-Kommentar) + Analyse #1213.
Rot-Tests: `server/src/express/tasks-created-by.test.ts` (TF1–TF6),
`frontend/src/components/TaskForm.test.tsx` und `frontend/src/components/QuickCaptureModal.test.tsx`
(TF7), `frontend/e2e/groups-foreign-task.spec.ts` (TF8).

## API-Vertrag (verbindlich für die Implementierung)

- `TaskCreate` (POST /tasks-Body) erhält ein **optionales** Feld `userId: number` — der Empfänger.
  Fehlt das Feld (oder ist es die eigene ID), ändert sich am bisherigen Ablauf nichts.
- Das `Task`-DTO (GET /tasks, GET /tasks/:id, POST-Antwort) erhält vier nullable Felder:
  - `createdById: number | null` — Konto des Erstellers; `null` bei Bestandsaufgaben ohne Ersteller.
  - `createdByName: string | null` — Anzeigename des Erstellers, Fallback E-Mail (`displayNameOf`-
    Muster `groups.ts`); `null` wenn `createdById` null ist.
  - `forUserId: number | null` — **nur** gesetzt, wenn die Aufgabe für ein anderes Mitglied angelegt
    wurde (`userId` der Aufgabe ≠ Ersteller); sonst `null`.
  - `forUserName: string | null` — Anzeigename des Empfängers (Fallback E-Mail); synchron zu
    `forUserId`.
- `openapi.yml` (Schemas `Task`, `TaskCreate`) und die generierten Client-Typen werden mitgepflegt.

## AK1 — POST ohne `userId` verhält sich wie bisher

- **Vorbedingung:** angemeldeter Nutzer, keine Gruppe nötig.
- **Schritte:** `POST /tasks` ohne `userId`-Feld.
- **Erwartet:** 201; `createdById` = eigenes Konto, `createdByName` = eigener Anzeigename,
  `forUserId`/`forUserName` = `null`.

## AK2 — POST mit fremder `userId` ohne gemeinsame Gruppe → 403

- **Vorbedingung:** Empfänger-Konto teilt mit dem Aufrufer keine Gruppe.
- **Schritte:** `POST /tasks` mit `userId` des fremden Kontos.
- **Erwartet:** 403; es wird kein Datensatz angelegt (Empfängerliste wie Aufruferliste enthalten
  den Titel nicht).

## AK3 — Fremde Aufgabe trägt Empfänger als Owner, Ersteller als Creator

- **Vorbedingung:** Aufrufer und Empfänger sind Mitglied derselben Gruppe.
- **Schritte:** `POST /tasks` mit `userId` des anderen Mitglieds; danach `GET /tasks` des Empfängers.
- **Erwartet:** 201; die Aufgabe erscheint in der Empfängerliste (Lese-Scope um `createdById`
  erweitert) mit `createdById` = Aufrufer und `createdByName` = dessen Anzeigename.
  Selbst-Empfänger (`userId` = eigene ID): `createdById` = `userId`, `forUserId` = `null`.

## AK4 — Empfänger sieht den Anzeigenamen des Erstellers

- **Schritte:** `GET /tasks` des Empfängers (aus AK3-Szenario).
- **Erwartet:** Antwort enthält die Aufgabe mit `createdByName` = Anzeigename des Erstellers
  (E-Mail-Fallback, wenn der Ersteller keinen Anzeigenamen hat).

## AK5 — Ersteller: lesend + Kennzeichen, schreibend 404; Drittkonto: unsichtbar

- **Schritte:** `GET /tasks` des Erstellers; `PATCH`/`DELETE /tasks/{id}` als Ersteller;
  `GET /tasks` und `GET /tasks/{id}` eines dritten Kontos ohne gemeinsame Gruppe.
- **Erwartet:** Ersteller-Liste enthält die Aufgabe mit `forUserId` = Empfänger-ID und
  `forUserName` = Empfänger-Name (UI: Hinweis „Für: Name“); PATCH und DELETE antworten 404
  (Schreib-Scope bleibt `ownerScope`); das Drittkonto sieht die Aufgabe nicht und erhält auf
  `GET /tasks/{id}` 404.

## AK6 — Bestandsaufgaben ohne `createdById` bleiben unverändert

- **Vorbedingung:** Aufgabe direkt am Modell ohne `createdById` angelegt.
- **Geschütztes Verhalten:** `GET /tasks` liefert sie weiterhin (200, enthalten),
  `createdById`/`createdByName`/`forUserId`/`forUserName` sind `null`, PATCH des Owners
  funktioniert weiter (kein Über-Scoping durch die Lese-Erweiterung).

## AK7 — Empfängerauswahl nur mit Gruppe, vorbelegt mit dem eigenen Konto

- **Vorbedingung:** Formular „Neue Aufgabe“ (auch Schnellerfassung → Formular-Schritt).
- **Datenquellen:** `GET /groups` (`api.listGroups`), `GET /groups/:id/members`
  (`api.getGroupMembers`), eigenes Konto aus `GET /auth/me` (`checkAuth`, `lib/auth.ts`).
- **Erwartet:**
  - Ohne Gruppe (leere Gruppenliste): keine Empfängerauswahl sichtbar — bisheriger Flow unverändert.
  - Mit ≥1 Gruppe: `KolSingleSelect` mit sichtbarem Label „Empfänger“ sichtbar; Optionen sind die
    Gruppenmitglieder (Personen aus mehreren Gruppen nur einmal — KI-UX); **vorausgewählt ist das
    eigene Konto** (Anzeigename). Während des Ladens deaktiviert mit Ladehinweis statt leerer
    Liste; bei Ladefehler `KolAlert`, Formular bleibt mit Default „eigenes Konto“ nutzbar (KI-UX).
- **Nicht getestet (UX-Empfehlung, nicht AK):** Gruppierung der Optionen nach Gruppe.

## AK8 — 375 px ohne horizontales Scrollen (e2e)

- **Schritte:** Gruppe mit zwei Mitgliedern (zweiter Account über `POST /auth/test-login`, eigener
  Browser-Context — Muster `groups-invitations.spec.ts`); Aufgabe über die UI für das andere
  Mitglied anlegen; Hinweise „Für: …“ (Ersteller-Sicht) bzw. „Erstellt von: …“ (Empfänger-Sicht)
  prüfen; Viewport 375 px.
- **Erwartet:** Beide Hinweise sind als `KolBadge`/umbrechfähiger Text in der bestehenden
  `.task-tree-badges`-Zeile sichtbar (KI-UX: Text, nie nur Farbe; muted, nicht signalfarbig);
  Empfängerauswahl und Hinweise bleiben per **Bounding-Box** (`x + width ≤ Viewport-Breite`)
  vollständig im Viewport — `scrollWidth` ist wegen `overflow-x: hidden` der App-Shell untauglich
  (Erfahrung 2026-08-24).

## Out of scope (Analyse #1213)

Aufgaben-Serien für andere, Gruppen-Übersicht, Benachrichtigungen; Migration des bestehenden
Geo-Local-Storage. Schreib-Scope (`PATCH`/`DELETE`) bleibt ausschließlich `ownerScope`.
