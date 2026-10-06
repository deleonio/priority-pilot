# Spec #2295 — Admin löscht Abos und Rechnungen eines Nutzers

Ziel: Vor dem Go-live räumt ein Admin Test-Abos samt Rechnungen eines Nutzers vollständig ab.

## API (nur Admin, `requireRole('admin')`)

- `DELETE /admin/users/:id/subscriptions/:subscriptionId` — ein Abo.
- `DELETE /admin/users/:id/subscriptions` — alle Abos des Nutzers.

Ablauf je Abo: (1) PayPal-Kündigung, (2) in einer Transaktion Abo, Rechnungen mit dieser `subscriptionId`
(inkl. `pdfBytes`) und Gutschriften mit `creditForInvoiceId` auf gelöschte Rechnungen entfernen,
(3) `users.plan` neu berechnen: Paket eines verbleibenden laufenden Abos (offen, oder gekündigt mit
`currentPeriodEnd` in der Zukunft), sonst `free`. Antwort 200.

PayPal-Fehlerregel: 404/422 → trotzdem löschen; anderer Fehler (anderer 4xx, 5xx, Netz) → nichts löschen,
Fehlerstatus (>= 400) mit Meldung; bei „Alle" wird dann nichts gelöscht. Keine Erstattung.

Fehler: Nicht-Admin 403; unbekannter Nutzer, unbekannte oder fremde Abo-Id 404; fremde Daten unberührt.

## UI (Nutzerverwaltung, `AdminUsersSection`)

Je Nutzer Abo-Liste mit „Löschen" je Abo und „Alle Abos dieses Nutzers löschen". Klick öffnet
Bestätigungsdialog (`docs/ux-pattern-sequential-confirmation.md`); „Abbrechen" sendet nichts; Bestätigen
sendet DELETE und lädt neu; Fehler als Meldung. Bei 375 px ohne Überlauf bedienbar.
