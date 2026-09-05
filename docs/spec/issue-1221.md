# Spec — Issue #1221: Rolle eines Gruppenmitglieds ändern

## Ziel

Ein Administrator kann ein Mitglied zum Administrator befördern oder einen anderen
Administrator zur normalen Mitgliedschaft zurückstufen, ohne die Gruppe dabei ohne
Administrator zurückzulassen.

## API — `PATCH /groups/{id}/members/{userId}`

Body: `{ "role": "admin" | "member" }`.

| Vorbedingung                                                       | Ergebnis                                                                                            |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Aufrufer nicht angemeldet                                          | 401                                                                                                 |
| Aufrufer ist nicht Mitglied der Gruppe                             | 404 (kein Existenz-Leak, Muster wie DELETE)                                                         |
| Aufrufer ist Mitglied, aber kein Administrator                     | 403                                                                                                 |
| `role` ist weder `"admin"` noch `"member"`                         | 400                                                                                                 |
| `role: "admin"` auf ein bestehendes Mitglied                       | 200; Mitglied erscheint danach in `GET /groups/{id}/members` mit `role: "admin"`                    |
| `role: "member"` auf einen Administrator, der NICHT der letzte ist | 200; Rolle danach `member`                                                                          |
| `role: "member"` auf den letzten verbleibenden Administrator       | 409 mit erklärender `message` (dieselbe Prüffunktion wie beim Entfernen, siehe `groups.ts:462-468`) |
| Zielnutzer ist kein Mitglied der Gruppe                            | 404                                                                                                 |

Die Prüfung "mindestens ein Administrator bleibt" wird aus der bestehenden DELETE-Route
(`groups.ts:462-468`) in eine gemeinsame Funktion extrahiert, die PATCH (Rückstufung) und
DELETE (Entfernen) beide nutzen — kein zweiter, abweichender Prüfpfad.

## Frontend — `GroupDetail`

- Nur wenn `ownRole === 'admin'`, erscheint neben jedem Mitglied ein Rollen-Button, dessen
  Label den Zielzustand nennt: „<Name> zum Administrator machen" (Mitglied) bzw.
  „<Name> zur Mitgliedschaft zurückstufen" (Administrator).
- Einfache Mitglieder (`ownRole === 'member'`) sehen ausschließlich die vorhandene
  Rollen-Badge (Text), keinen Button.
- Ein 409 vom Server (letzter Administrator) landet im bestehenden `error`-State/`KolAlert`
  (kein neuer Fehlerpfad, analog zu `handleRemove`).
- Bei 375 px Viewportbreite ist der neue Button ohne horizontales Scrollen bedienbar
  (`document.documentElement.scrollWidth <= window.innerWidth`).

## Testfälle

- TF1–TF6 (AK1–AK6): `server/src/express/groups-invitations.api.test.ts`, neue
  `describe('Rolle eines Gruppenmitglieds ändern (#1221)')`.
- TF7 (AK7): `frontend/src/components/GroupDetail.test.tsx` — Rollen-Button nur für Admins.
- TF8 (AK8): `frontend/e2e/groups.spec.ts` — 375-px-Viewport, `scrollWidth`-Assertion.
