# Spec — Issue #1566: Neue Rolle „Tester" — Admin ohne Nutzerverwaltung

Quelle: Akzeptanzkriterien AK1–AK6 aus dem KI-ANALYSE-Block des Harness-Marker-Kommentars von #1566 (kein KI-UX-Block — reine Wiederverwendung bestehender Komponenten). Verbindliche Auslegung aus der Analyse: „Möglichkeiten eines Admins" heißt, dass NUR die Nutzerverwaltung ausgeschlossen ist (Nutzerliste, Rollenvergabe, Paketänderung fremder Konten); alle übrigen Admin-Routen darf ein Tester nutzen, und Empfänger von Admin-Rundmails ist er nie.

## Ziel

Eine dritte Systemrolle `tester` arbeitet wie ein Admin — inklusive Pakete-Tab mit kostenfreiem Selbst-Wechsel über alle vier Pakete —, sieht die Nutzerverwaltung weder im Frontend noch per API und erhält keine Admin-Rundmails (Feedback, Status-Mail beim Serverstart).

## Voraussetzungen (Typen und Seams der Implementierung)

- `UserRole` (`server/src/models/user.ts:6`) wird um `'tester'` erweitert; ebenso das Enum in `openapi.yml` (AdminUser.role, Rolle-PATCH-Body) samt Client-Regeneration und der `AuthUser['role']`-Union in `frontend/src/lib/auth.ts:13`.
- `requireRole` (`server/src/express/requireAuth.ts:65`) akzeptiert neben einer einzelnen Rolle auch ein Rollen-Array (`requireRole(['admin', 'tester'])`); der frische DB-Rollenvread und die 403-Semantik bleiben unverändert.
- Routen-Gating in `server/src/express/routes/admin.ts`:
  - GET `/admin/users` und PATCH `/admin/users/:id/role` bleiben **admin-only** (`requireRole('admin')`).
  - PATCH `/admin/users/:id/plan` erlaubt `['admin', 'tester']`, wobei ein Tester **nur die eigene Id** setzen darf (Server-Check, 403 sonst) — Frontend-Gating allein reicht nicht (AK4).
  - PATCH `/admin/users/:id/role` akzeptiert `tester` als Zielrolle (200 + Persistenz); die Rückstufung des letzten verbleibenden Admins auf `tester` scheitert wie auf `member` mit 409 (Letzter-Admin-Guard bleibt wirksam).
- Alle übrigen `requireRole('admin')`-Routen (exemplarisch POST `/mail/test`, `routes/mail.ts:19`) werden auf `['admin', 'tester']` geöffnet.
- Frontend-Seam: `SettingsPage` erhält analog zu `isAdmin` ein neues optionales Prop `isTester?: boolean` (App: `user.role === 'tester'`). Das Gate der OwnPlanCard (`SettingsPage.tsx:823`) wird zu `(isAdmin || isTester) && typeof currentUserId === 'number'`; Tab „Nutzerverwaltung" und Panel `tab-8` bleiben ausschließlich an `isAdmin` gebunden. `App.tsx` behandelt das Segment `nutzer` für Tester wie für Member als unbekannten Pfad.
- `AdminUsersSection`-Rollen-Label (`AdminUsersSection.tsx:9`): `tester` → Badge „Tester".
- Empfangsfilter `role: 'admin'` in `notifyAdmins` (`routes/feedback.ts:118`) und `sendStartupStatusMail` (`logics/startupStatusMail.ts:31`) bleiben unangetastet — Tester fallen automatisch heraus.
- `resolveRole`/`ADMIN_EMAILS`-Auto-Promotion (`logics/auth.ts:31`) bleibt unberührt (kein E-Mail-Muster erzeugt Tester automatisch).

## Verhalten

### AK1 — Rolle tester vergeben und anzeigen

Ein Admin setzt die Rolle eines Nutzers über PATCH `/admin/users/:id/role` mit `{ role: 'tester' }` → 200; Response und DB tragen `tester`, `GET /auth/me` liefert die Rolle ohne Re-Login. In der Admin-Nutzerverwaltung erscheint die Rolle als Badge „Tester" (Text, nie nur Farbe). Die Rückstufung des letzten Admins auf `tester` liefert 409.

### AK2 — Nutzerverwaltung bleibt Admin-only

GET `/admin/users` mit Rolle `tester` → 403. Im Frontend sieht ein Tester den Tab „Nutzerverwaltung" nicht (weder Tab-Liste noch Panel `tab-8` wird gerendert); der Deep-Link `/settings/nutzer` fällt für Tester wie für Member auf den Default-Tab „Säulen" zurück. Alle übrigen Admin-Bereiche bleiben erreichbar — exemplarisch POST `/mail/test` mit Rolle `tester` → 200 (bzw. 503/502 ohne konfiguriertes/funktionierendes SMTP, niemals 403).

### AK3 — Paket-Selbstwechsel wie ein Admin

Ein Tester sieht im Tab „Pakete" dieselbe OwnPlanCard wie ein Admin (`OwnPlanCard`, Karte „Eigenes Paket") und wechselt kostenfrei in jedes der vier Pakete `free | pro | max | ultimate` — einschließlich Rückwechsel zu Free. Der einzige Call ist PATCH `/admin/users/:id/plan` auf die eigene Id; der Wechsel wirkt sofort (`/auth/me`-Refresh) und überlebt ein Neuladen.

### AK4 — Server erzwingt die Grenze der Nutzerverwaltung

Als Tester: PATCH `/admin/users/:id/plan` auf eine **fremde** Id → 403; PATCH `/admin/users/:id/role` (jedwede Zielrolle, eigene oder fremde Id) → 403; PATCH `/admin/users/:id/plan` auf die **eigene** Id → 200.

### AK5 — Keine Admin-Rundmails

Feedback-Rundmail (`notifyAdmins`) und Status-Mail beim Serverstart (`sendStartupStatusMail`) gehen ausschließlich an Konten mit `role: 'admin'` — ein vorhandenes Tester-Konto erhält keine dieser Mails (Filter bleibt `role: 'admin'`).

### AK6 — Mobile 375px

AK2 und AK3 gelten auch bei 375px Viewport: Der Tab „Nutzerverwaltung" fehlt auch in der gestapelten Tab-Leiste, die Paketkarte bleibt vollständig im Viewport (Bounding-Box, nicht scrollWidth — die App-Shell clippt `overflow-x: hidden`) und ist bedienbar (Paketwechsel klappt).

## Abgrenzungen

- Migration bestehender Konten auf `tester` (UI-seitiger Rollen-Button-Text, z. B. „zum Tester machen") ist Teil der Umsetzung der Rollen-Buttons, aber nicht akzeptanzkritisch — der Rollenwechsel läuft über den bestehenden Button-Mechanismus (`handleRoleChange`), getestet wird der API-Vertrag und das Badge.
- Der Empfangsfilter der Rundmails wird bewusst NICHT auf Tester erweitert (Auslegung der Analyse).
- Tab-Struktur/Indizes bleiben unverändert („Nutzerverwaltung" hängt weiterhin nur für Admins an Index 8 an).

## Testkonzept

| AK  | Test                                                                                                        | Datei                                                              | Rot?                             |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------- |
| AK1 | PATCH role→tester: 200, DB-Persistenz; Letzter-Admin→tester: 409                                            | `server/src/express/admin.api.test.ts` (#1566-Block)               | rot (heute 400)                  |
| AK1 | Zeile mit Rolle tester zeigt Badge „Tester"                                                                 | `frontend/src/components/AdminUsersSection.test.tsx`               | rot (heute „Mitglied")           |
| AK2 | tester GET /admin/users → 403                                                                               | `server/src/express/admin.api.test.ts`                             | Guard (bleibt grün)              |
| AK2 | tester POST /mail/test → 200, Sender aufgerufen                                                             | `server/src/express/mail.test.ts`                                  | rot (heute 403)                  |
| AK2 | Tester: kein Tab „Nutzerverwaltung", kein Admin-Panel; Deep-Link-Fallback „Säulen"                          | `SettingsPage.test.tsx` (Seam `isTester`) + e2e                    | Unit-Guard / e2e rot             |
| AK3 | isTester → OwnPlanCard-Auswahl im Panel tab-6 (ohne Admin-Tab)                                              | `frontend/src/components/SettingsPage.test.tsx`                    | rot (Karte fehlt für isTester)   |
| AK3 | E2E: Tester wechselt durch alle vier Pakete inkl. Rückweg zu Free, PATCH nur auf eigene Id, überlebt Reload | `frontend/e2e/issue-1566-role-tester.spec.ts` (neu)                | rot (Karte fehlt ohne isTester)  |
| AK4 | tester PATCH plan eigene Id → 200; fremde Id → 403; PATCH role → 403                                        | `server/src/express/admin.api.test.ts`                             | rot (eigene Id heute 403)        |
| AK5 | admin + tester angelegt → nur admin erhält Feedback-Rundmail / Status-Mail                                  | `server/src/express/feedback.test.ts`, `startupStatusMail.test.ts` | Guard (Filter bleibt role:admin) |
| AK6 | E2E 375px: Tab fehlt, Paketkarte im Viewport und bedienbar                                                  | `frontend/e2e/issue-1566-role-tester.spec.ts`                      | rot                              |

Dedup (bewusst nicht erneut getestet): Tab-Sichtbarkeit für admin/member (`issue-1300-admin-users.spec.ts`), Admin-Paketwechsel-Flow und 375px-Kartenlayout (`issue-1565-package-switch-tab.spec.ts`), 403 für Member auf plan/role-PATCH (`admin.api.test.ts` #1456-Block). Die #1566-Tests prüfen ausschließlich das Tester-Delta.
