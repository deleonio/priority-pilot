# Spec #2327 — Admin löscht ein fremdes Konto

Ziel: Ein Admin entfernt aus der Nutzerliste ein fremdes Konto (z. B. Testkonten vor dem Go-live) mit denselben Regeln wie die Selbstlöschung.

## API (nur Admin, `requireRole('admin')`)

`DELETE /admin/users/:id` ruft unverändert `deleteAccount(userId)` (`server/src/logics/deleteAccount.ts`).

| Fall                                                | Antwort                                        |
| --------------------------------------------------- | ---------------------------------------------- |
| Erfolg                                              | 204, Nutzer existiert nicht mehr               |
| Nicht-Admin                                         | 403                                            |
| Ungültige Id                                        | 400                                            |
| Eigene Id des Admins                                | 400 (Konto bleibt; Hinweis auf Selbstlöschung) |
| Unbekannte Id                                       | 404                                            |
| Laufendes Abo                                       | 409 `code: subscription_active`                |
| Letzter Admin einer Gruppe mit weiteren Mitgliedern | 409 `code: last_group_admin`                   |
| PayPal-Kündigung scheitert                          | 502 `code: paypal_unavailable`                 |

Bei jeder Ablehnung bleibt das Konto. Rechnungen und Abo-Datensätze bleiben nach erfolgreicher Löschung erhalten. Die Session des Admins bleibt bestehen.

## UI (`AdminUsersSection`)

- Je fremdem Nutzer ein Button `Konto löschen` (`_label`), beim eigenen Eintrag keiner.
- Bestätigung nach `docs/ux-pattern-sequential-confirmation.md`: ein Modal, Schritt 1 „Konto von {Name} ({E-Mail}) wirklich löschen?“ mit `Weiter`/`Abbrechen`, Schritt 2 mit `Konto endgültig löschen`/`Abbrechen`. Abbrechen sendet nichts.
- Client-Methode `api.deleteAdminUser({ id })`.
- Erfolg: Dialog zu, Nutzer verschwindet aus der Liste.
- 409/502: Dialog bleibt offen, `KolAlert` (error) mit fester Text-Map je `code` (Abo: nennt „Alle Abos dieses Nutzers löschen“; letzter Gruppen-Admin: „letzter Admin“; PayPal: „PayPal“), Nutzer bleibt in der Liste.
- 375 px: Schritt 2 vollständig im Viewport, Buttons erreichbar, kein horizontaler Überlauf.
