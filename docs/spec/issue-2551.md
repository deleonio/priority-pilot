# Gemeinsamer Dedupe-Helfer für Push-Benachrichtigungen – Issue 2551

**Stand:** 2026-10-14
**Ziel:** Alle fachlichen Push-Trigger protokollieren ihren Versand über einen gemeinsamen Helfer
`sendDedupedPush` (`server/src/logics/dedupedPush.ts`), statt das Muster
„`NotificationLog.findOne` → `sendPushToUser` → `NotificationLog.create` bei `sent > 0`“ zehnmal
kopiert zu halten (AK1). Das von außen beobachtbare Verhalten bleibt identisch: gleiche Pushes,
gleiche Log-Einträge, kein Doppelversand — die bestehenden Suiten der zehn Push-Pfade bleiben grün
(AK2).

---

## Vertrag: `sendDedupedPush`

### Ziel

Ein Helfer kapselt Dedupe-Prüfung, Versand und Protokollierung in einer Aufrufreihenfolge, die kein
Push-Pfad mehr selbst zusammensetzen muss. Injektions-Signatur wie das darunterliegende
`sendPushToUser` (`logics/push.ts`): letzter Parameter `send?: PushSender`, Tests reichen einen Mock
herein.

### Vorbedingung

- In-Memory-Datenbank mit `NotificationLog` (Unique-Index auf `kind` + `dedupeKey`)
- Signatur: `sendDedupedPush(userId, kind, dedupeKey, payload, send?)` → `{ sent, removed }`
  (`userId: number | undefined` wie in `sendPushToUser`, `payload` im `PushPayload`-Format des
  Service Workers: `title`/`body?`/`url?`)

### Schritte (Verhalten des Helfers)

1. **Dedupe-Check zuerst:** `NotificationLog.findOne({ where: { kind, dedupeKey } })` — existiert
   bereits ein Eintrag, wird **nicht gesendet** und kein Log-Eintrag geschrieben (frühe Rückkehr).
2. **Versand:** `sendPushToUser(userId, payload, send)` — der Helfer ergibt selbst keinen
   Sendeversuch ohne diesen Aufruf.
3. **Protokollierung nur bei Zustellung:** `sent > 0` → genau ein
   `NotificationLog.create({ userId, kind, dedupeKey, sentAt: new Date() })`.
4. **Kein Log bei `sent: 0`:** keine zustellbare Subscription schreibt **keinen** Log-Eintrag —
   sonst würde der Schlüssel dauerhaft blockiert, obwohl nie zugestellt wurde.
5. **Rückgabe:** `{ sent, removed }` des Versands, unverändert aus `sendPushToUser`.

### Erwartetes Ergebnis

- Erster Aufruf sendet und schreibt genau einen Log-Eintrag (AK3a).
- Zweiter Aufruf mit gleichem `kind` + `dedupeKey` sendet nicht erneut und schreibt keinen zweiten
  Log-Eintrag (AK3a).
- Gleicher `kind`, anderer `dedupeKey` sendet erneut — die Sperre gilt pro Schlüssel, nicht pro Art.
- `sent: 0` (keine Subscription) schreibt keinen Log-Eintrag (AK3b).

### Randbedingungen (ohne eigenen Test)

- **AK1** (alle zehn Stellen nutzen den Helfer, `express/routes/push.ts` bleibt ohne Dedupe) ist
  Struktur-Nachweis per grep im Implementierungs-PR — kein eigener Test (Refactoring-Struktur,
  ADR 0001).
- **AK2** ist der Lauf der zehn bestehenden Suiten im kanonischen Gate des
  Implementierungs-PR — kein neuer Test.
- Bulk-Pfade (`dueTaskReminders`, `geo-background-job`) behalten ihre Gruppen- und
  Serialisierungslogik; für Versand und Protokollierung nutzen sie die Bulk-Geschwister
  `sendDedupedPushBulk` (Review-Finding zu AK1 in #2598): `findAll`-Vorcheck über alle Schlüssel →
  ein Versand → `bulkCreate({ ignoreDuplicates: true })` je offenem Schlüssel. Allein der
  Nur-Mail-Fall von `dueTaskReminders` protokolliert weiter im Aufrufer — der Helfer kennt nur
  Push-Kanäle („ein Log-Eintrag pro Auslöser, nicht pro Kanal“).
- Ob der Payload als Objekt oder lazily (Thunk, z. B. `taskCreatedNotification` liest `User.sprache`
  erst nach dem Dedupe-Check) übergeben wird, ist Implementierungsfreiheit ohne beobachtbaren
  Unterschied (zusätzlicher DB-Griff) — bewusst nicht im Vertrag festgezurrt.
