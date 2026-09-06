# Spec #1262 — `GET /auth/me` liefert die User-Id (`id`)

## Ziel

`GET /auth/me` antwortet zusätzlich mit dem Feld `id` (positive Ganzzahl, identisch zur
`id` des Session-Users). Damit ist die Empfängerauswahl im TaskForm (#1213/#1222) mit dem
eigenen Konto vorausgewählt, und das Anlegen von Aufgabe und Serie für das eigene Konto
funktioniert ohne Validierungsfehler (aktuell ist `own.id` `undefined` → `recipientId`
`"undefined"` → `userId: null` → API-Validierung bricht das Speichern ab).

## Voraussetzungen

- Session-Pfade (Login, Google-Callback, `test-login`) tragen `id` bereits in der Session.
- Dev-Pass-Through-Modus ohne Auth (`isAuthActive() === false`) bleibt bewusst ohne `id`
  (synthetischer Nutzer ohne Eigentümer-Bindung; Kommentar in `auth.ts` ist verbindlich).
- Frontend-Typ `AuthUser` und TaskForm-Logik sind bereits korrekt — nur der Server-Vertrag
  hinkt.

## Ablauf / erwartetes Verhalten

- **AK1/TF1** Nach Login liefert `GET /auth/me` 200 mit `id` als positive Ganzzahl, die
  exakt der `id` des User-Datensatzes in der DB entspricht (Erweiterung des bestehenden
  AC-4-Tests in `server/src/express/auth.test.ts`).
- **AK2/TF2** Mit mindestens einer Gruppe ist im Anlege-Formular (Task-Modus) das Feld
  „Empfänger" mit dem eigenen Anzeigenamen vorausgewählt; Anlegen einer Aufgabe ohne
  Eingriff in die Auswahl endet mit einem erfolgreichen POST `/api/v1/tasks` (2xx) und
  ohne Fehlermeldung (E2E gegen echtes Backend, Erweiterung
  `frontend/e2e/issue-1222-series-recipient.spec.ts`).
- **AK3/TF3** Dasselbe im Serie-Modus: Vorauswahl des eigenen Kontos, POST
  `/api/v1/series` erfolgreich (2xx) ohne Eingriff in die Auswahl.
- **AK4/TF4** Wählt man ein anderes Gruppenmitglied, enthält der create-/createSeries-
  Payload dessen `userId` — bestehende Unit-Tests in `TaskForm.test.tsx` (#1213/#1222)
  decken das ab und müssen grün bleiben (Regressionsschutz, keine neuen Tests).

## Abgrenzungen / Test-Pflege

- Die Unit-Tests in `TaskForm.test.tsx` stubben `checkAuth` mit `id` und sind heute grün;
  eine zusätzliche Schärfung (Wert `!== "undefined"`) wäre gegen den Stub grün-und-grün
  ohne Aussagekraft (Mutationstest fehlgeschlagen) — bewusst nicht geschrieben. Die echte
  Lücke schließt TF1 (Server-Vertrag) plus TF2/TF3 (E2E gegen echte `/auth/me`-Antwort).
- `auth-avatar.test.ts` (prüft nur `avatarUrl`) und AC 4/5 in `auth.test.ts` dürfen durch
  das additive Feld nicht brechen.

## Erwartetes Ergebnis

Anlegen von Aufgabe und Serie klappt mit Gruppen ohne Fehlermeldung; „Empfänger" ist mit
dem eigenen Anzeigenamen vorausgewählt; Fremd-Auswahl legt beim gewählten Konto an.
