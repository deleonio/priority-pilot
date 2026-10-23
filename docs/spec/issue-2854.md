# Spec #2854 — Gruppen-Pushes (Einladung, Beitritt, Challenge) und Gruppen-Anker

Vertrag für die Umsetzung (rote Tests: `server/src/logics/groupPush.test.ts`, Erweiterungen in `groups-invitations.api.test.ts`, `groups-invite-links.api.test.ts`, `pushBudget.test.ts`, `pushTargets.test.ts`, `GroupsSection.test.tsx`, neu `frontend/e2e/issue-2854-group-push-targets.spec.ts`). Vier beobachtbare Push-Ereignisse (Konzept §7.2): Einladung erhalten, neues Mitglied, Challenge-Start/-Ende. Alle Pushes laufen durch `sendDedupedPush` (`dedupedPush.ts`) — Budget-Tor und Fach-Log inklusive. API-DTOs bleiben unverändert.

## Ziel: `server/src/logics/groupPush.ts` (neu)

Muster `taskCreatedNotification.ts` (sofortige Ereignis-Pushes) + `aboPush.ts` (stündlicher Sweep). Injizierbarer Sender (`send?: PushSender`), Sweep mit injizierbarer Uhr (`now?: Date`). Empfängerdaten (Sprache, Zeitzone, Schalter) lädt das Modul selbst über `User.findByPk`.

| Funktion                                                     | Auslöser                                                                                                   | Empfänger                  | Kind               | Dedupe-Key                                 | URL                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------ | ------------------------------------------ | ----------------------------------- |
| `notifyGroupInvitation(invitation, send?, now?)`             | POST /groups/:id/invitations (nach Commit)                                                                 | `invitedUserId`            | `group-invitation` | `invitation:<id>`                          | `PUSH_TARGETS.groupInvitations`     |
| `notifyGroupMember(group, beigetreten, empfaengerId, send?)` | POST /invitations/:id/accept (→ `invitedByUserId`), POST /invite-links/:token/redeem (→ `createdByUserId`) | Einladender/Link-Ersteller | `group-member`     | `member:<groupId>:<beigetreten.id>`        | `PUSH_TARGETS.groupDetail(groupId)` |
| `notifyChallengeStarted(challenge, send?)`                   | POST /groups/:id/challenge (nach Commit)                                                                   | alle Mitglieder der Gruppe | `group-challenge`  | `challenge-start:<challengeId>:<memberId>` | `PUSH_TARGETS.groupDetail(groupId)` |
| `runGroupPush(now?, send?)`                                  | stündlicher Scheduler                                                                                      | je Ereignis                | `group-challenge`  | `challenge-end:<challengeId>:<memberId>`   | `PUSH_TARGETS.groupDetail(groupId)` |

- `invitation` = `{ id, groupId, groupName, invitedUserId, invitedByName }` (groupName/Einladender als Schnappschuss vom Aufrufer), `group` = `{ id, name }`, `beigetreten` = `{ id, displayName }`, `challenge` = `{ id, groupId }`.
- **Challenge-Keys tragen den Mitglied-Suffix** (`:­<memberId>`): `sendDedupedPush` dedupet global über UNIQUE `(kind, dedupeKey)` — ohne Suffix würde Mitglied 2 den Push von Mitglied 1 wegdeduppen. Der AK-4-Präfix `challenge-start:<id>`/`challenge-end:<id>` bleibt erkennbar.
- **Schalter:** Empfänger mit `users.groupPushEnabled = false` erhält nichts — kein Versand, kein NotificationLog-Eintrag (Muster `taskCreatedNotification`, #2850 AK3).
- **Ruhezeit (AK2, nur Einladungs-Push):** `istRuhezeit(now, nutzerZeitzone(empfänger.zeitzone))` (21–7 Ortszeit) → kein Versand, kein Log. `runGroupPush` holt nach: pending-Einladungen ohne Log-Eintrag erhalten im ersten Tagesfenster-Tick ihren Push. Beitritt, Challenge-Start und Challenge-Ende sind nicht ruhezeitgeprüft (AK2 nennt nur die Einladung; das Challenge-Ende ist durch den stündlichen Sweep von selbst nachholend).
- **Sweep-Lieferumfang:** (a) `status = 'pending'`-Einladungen ohne Log-Eintrag (Catch-up nach Ruhezeit), (b) Challenges mit `endsAt <= now` → je Mitglied genau ein Ende-Push. Laufende Challenges und Zwischenstände (§7.2 „ändern“) senden nichts.
- **Fehlfestigkeit:** Push-Trigger in den Routen erst nach Commit, nicht awaited bzw. abgefangen — Anlegen/Annahme/Start darf niemals am Push scheitern (Muster #1224 AK4). Versandfehler behandelt `sendDedupedPush` je Subscription.
- **Texte (§7.2):** de/en nach `spracheVon(user.sprache)` — „Anna lädt dich in die Gruppe „Familie“ ein.“ / „Ben ist jetzt in „Familie“ dabei.“ / Challenge-Start / Challenge-Ende analog (Titel + Text, kein Werbesatz).
- **Scheduler:** `runGroupPush` in die `startScheduler`-Triggerliste (`server/src/index.ts`) mit `{ rang: vorrangVon('group-challenge'), trigger }`.

## AK6 — Budget-Registrierung

- `VORRANG` (`pushBudget.ts`): `group-invitation` in §4-Stufe 1 neben `task-created` (vor `geo-nearby-task`); `group-member` und `group-challenge` registriert (vor `daily-digest`). Unregistrierte Kinds rangieren in `waehleImBudget` mit `indexOf −1` nach vorn — Registrierung ist Pflicht.
- `TAGS`: alle drei Kinds → `pp-gruppen` (§2.3).

## AK6 — Push-Ziele (`pushTargets.ts`)

- `PUSH_TARGETS.groupInvitations = '/settings/gruppen#einladungen'`
- `PUSH_TARGETS.groupDetail = (id) => \`/settings/gruppen#gruppe-${id}\``
- Spiegel-Test gleicht beide Anker mit den `id="…"`-Zielen in `GroupsSection.tsx` ab.

## AK7 — Anker im Gruppen-Tab (Frontend)

- Die Karte der empfangenen Einladungen bekommt einen flachen Wrapper `<section id="einladungen" tabIndex={-1}>` (Muster `SubscriptionSection.tsx:338`, #2852 — KoliBri-Hosts überschreiben `focus()`).
- Das Gruppen-`<li>` bekommt `id={`gruppe-${group.id}`}` + `tabIndex={-1}`.
- Hash-Behandlung nach #2848-Muster (`useSettingsAnchor`): `#gruppe-<id>` klapppt die Gruppe auf (`setOpenGroupId(id)`, dann springen, wenn das Ziel rendert), `#einladungen` springt zur Karte (rendert nur mit offenen Einladungen — fehlendes Ziel still ertragen). Fokus + EIN `scrollIntoView` ohne Animation, danach `history.replaceState` entfernt den Anker; auch bei 375 px.
