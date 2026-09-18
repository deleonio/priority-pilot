# Spec — Issue #1556: Admin kann sich kostenfrei in ein beliebiges Paket versetzen

Quelle: Akzeptanzkriterien AK1–AK6 aus dem KI-ANALYSE-Block des Harness-Marker-Kommentars von #1556 (+ KI-UX-Block, advisory). Backend aus #1456 ist vollständig vorhanden (`PATCH /admin/users/:id/plan`, `server/src/express/routes/admin.ts:123-160`); dieses Ticket ist reine Frontend-Arbeit in `AdminUsersSection` + `api.ts`.

## Ziel

Die Admin-Nutzerverwaltung zeigt in jeder Zeile das Paket des Kontos als Badge. Nur in der Zeile des eigenen Kontos gibt es eine Auswahl (`KolSelect`, vier Pakete, aktuelles vorausgewählt), deren Wechsel unmittelbar `PATCH /admin/users/{id}/plan` auf der eigenen Id aufruft — ohne Zahlungs- oder Abo-Pfad, wirksam ohne Neu-Login und nach Neuladen.

## Voraussetzungen

- `AdminUser`-DTO trägt `plan` (`openapi.yml` → `AdminUser`, aus #1456); `GET /admin/users` liefert es.
- `frontend/src/lib/planOffers.ts` exportiert `planLabel(plan)` („Free/Pro/Max/Ultimate“) — einzige Textquelle der Badges, kein zweites Label-Array.
- Eigene Zeile: `user.id === <Id des eingeloggten Nutzers>`. Seam: `AdminUsersSection` erhält die eigene Id als neues optionales Prop `currentUserId?: number` (App → SettingsPage → AdminUsersSection durchreichen; solange undefined, verhält sich die Sektion wie bisher — nur Badges, keine Auswahl).
- Neu: `api.updateUserPlan({ id, plan })` in `frontend/src/api.ts` — PATCH `/admin/users/{id}/plan`, Muster `updateUserRole` (`frontend/src/api.ts:512`).

## Verhalten

### AK1 — Paket-Badge in jeder Zeile

Jede Zeile der Nutzerverwaltung zeigt ein `KolBadge` mit `planLabel(user.plan)` — bei allen Konten, nicht nur dem eigenen. Badge neutral (keine Statusfarbe, Text trägt die Information, WCAG 1.4.1).

### AK2 — Auswahl nur in der eigenen Zeile

In der Zeile mit `user.id === currentUserId` existiert eine Auswahl mit genau den vier Paketen `free | pro | max | ultimate` (Optionstexte via `planLabel`), aktuelles Paket vorausgewählt. Jede fremde Zeile enthält keine Auswahl, nur das Badge. Zugängliches Label der Auswahl mit Zeilenkontext (z. B. „Eigenes Paket“).

### AK3 — Wechsel wirkt sofort ohne Reload

Das Wählen eines Pakets ruft `api.updateUserPlan({ id: <eigene Id>, plan })` auf; nach Erfolg lädt die Sektion die Liste neu (`load()`) und die Zeile zeigt das neue Paket-Badge — ohne Seitenreload. Während des laufenden PATCH ist die Auswahl gegen weitere Wechsel gesperrt (`_disabled`). Fehler (z. B. 400 ungültiges Paket) landen als `KolAlert` nach dem `handleRoleChange`-Muster (`AdminUsersSection.tsx:35-46`), Liste bleibt stehen.

### AK4 — Kein Zahlungsweg; Persistenz + Session-Sync (Server-Vertrag)

Der Wechsel durchläuft keinen PayPal-/Bestell-Code: der einzige Call ist `PATCH /admin/users/:id/plan`. Danach liefern `GET /admin/users` und `GET /auth/me` (gleiche Session, ohne Re-Login) das neue Paket — der Session-Snapshot wird aus der DB synct (`server/src/express/routes/auth.ts:327-337`).

### AK5 — Wirksamkeit wie eine reguläre Buchung

Nach dem Wechsel (inkl. Seiten-Reload) zeigen Nutzerverwaltung und `/auth/me` das neue Paket; paketgebundene Funktionen evaluieren es über `getEntitlements(user.plan)` bzw. den `PlanProvider`-Kontext — der Selbst-Wechsel ist damit äquivalent zu einer regulären Buchung, ohne Zahlung.

### AK6 — Mobile 375px

Badge + Auswahl bleiben bei 375px ohne horizontalen Überlauf nutzbar: Bounding-Box jeder Zeile komplett im Viewport (`el.x + el.width <= viewportWidth`, nicht scrollWidth — App-Shell clippt `overflow-x: hidden`). Auswahl bedienbar (Touch-Target ≥ 44px).

## Abgrenzungen

- Die generische Server-Route bleibt universell (Admin darf fremde Pakete per API setzen, #1456 AK6); dieses Ticket blendet die Auswahl im UI nur für die eigene Zeile ein. Fremd-Vergabe über die UI ist explizit out of scope (T6/T7).
- `PlanBadge` aus #1458 wird nicht wiederverwendet (zeigt Feature-Entitlement, nicht den Kontostand).

## Testkonzept

| AK  | Test                                                                                                          | Datei                                                |
| --- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| AK1 | Vitest: gemischte Liste → je Zeile Badge mit `planLabel`-Text                                                 | `frontend/src/components/AdminUsersSection.test.tsx` |
| AK2 | Vitest: eigene Zeile hat Combobox mit 4 Optionen + Vorauswahl, fremde Zeilen keine                            | ebenda                                               |
| AK3 | Vitest: Change ruft `updateUserPlan({id, plan})` + Liste neu geladen; Fehler → `KolAlert`                     | ebenda                                               |
| AK4 | node:test: PATCH auf eigenes Konto → `GET /admin/users` + `GET /auth/me` liefern neuen Plan (gleiche Session) | `server/src/express/admin.api.test.ts`               |
| AK5 | E2E: Wechsel auf „Pro“, Badge-Update ohne Reload, nach `page.reload()` weiterhin „Pro“                        | `frontend/e2e/issue-1556-admin-plan-switch.spec.ts`  |
| AK6 | E2E bei 375px: Zeilen-Bounding-Boxen im Viewport, Auswahl bedienbar                                           | ebenda                                               |

Der AK4-Server-Test ist als grüner Vertragstest angelegt (Backend aus #1456 existiert bereits); die Frontend-Tests (AK1–AK3, AK5, AK6) sind rot bis zur Implementierung.
