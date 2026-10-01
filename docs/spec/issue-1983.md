# Spec: Issue 1983 — Einladung/Delegation an unbekannte Adresse (Zulassung mit Herkunft)

Ziel: Eine Einladung (Gruppe) oder Aufgaben-Übergabe an eine noch nicht registrierte
E-Mail-Adresse legt einen persistenten Zulassungs-Eintrag mit Herkunft an, benachrichtigt
per E-Mail mit direktem Konto-Zugang (Magic-Link-Muster) und macht die Adresse damit
anmeldungsfähig — unabhängig von der späteren Warteliste (#1982). Die Env-Allowlist
wirkt daneben unverändert weiter (ADR 0019).

## Vertrag (von der Spec-Phase festgelegt)

- **Modell `AllowedEmail`** (`server/src/models/allowedEmail.ts`, Migration im üblichen Muster):
  - `email` — normalisiert (trim + lowercase), **unique**.
  - `origin` — `'einladung' | 'delegation' | 'admin'` (Herkunft, Pflichtfeld).
  - Zeitstempel wie die Nachbar-Modelle.
- **Neuer Export `isDbEmailAllowed(email: string): Promise<boolean>`** in
  `server/src/logics/allowedEmails.ts` — DB-Prüfung gegen `AllowedEmail`, normalisierend
  (trim + lowercase). **`isEmailAllowed` (Env) bleibt unverändert sync** — die Aufrufstellen
  (Auth-Gate `auth.ts`, `requireAuth.ts`, Magic-Link `magicLink.ts`) kombinieren:
  `(await isDbEmailAllowed(email)) || isEmailAllowed(email)`.
  Damit bleiben die bestehenden Env-Tests (AK7) grün und die bestehenden Aufrufmuster intakt.
- **AK2 — Gruppen-Einladung:** `POST /groups/:id/invitations` akzeptiert alternativ zum
  bestehenden `userId` ein Body-Feld `email`. Bei unbekannter Adresse (kein Konto): 201,
  pending-Einladung wird angelegt, `AllowedEmail` mit `origin: 'einladung'` entsteht.
  Bekanntes Konto verhält sich wie heute (userId-Pfad, kein Doppelpfad).
- **AK3 — Gate:** Login/Session-Gate und Magic-Link (`POST /auth/magic-link`,
  `POST /auth/magic-link/verify`) akzeptieren eine per AK1/AK2 freigeschaltete Adresse
  (vorher 400/401, danach Zugang inkl. Session).
- **AK4 — Einladungs-Mail:** Die Einladungs-Benachrichtigung an die neue Adresse ist eine
  E-Mail (`sendMailToUser`-Muster, `logics/mail.ts`) mit direktem Konto-Zugang
  (`buildMagicLinkUrl`-Muster, beschreibender Linktext, `docs/fuersorge-tonalitaet.md`).
- **AK5 — Delegation:** Aufgaben-Übergabe akzeptiert alternativ zum bestehenden
  `userId`-Empfänger ein Body-Feld `recipientEmail`. Unbekannte Adresse → Aufgabe wird mit
  Empfänger angelegt, `AllowedEmail` mit `origin: 'delegation'` entsteht, Benachrichtigung
  mit direktem Zugang.
- **AK6 — Admin-Sicht:** `GET /admin/allowed-emails` listet zugelassene Adressen mit
  `origin` (Admin-Rolle pflichtig, wie die Nachbar-Routen in `routes/admin.ts`). Die
  Bestands-Nutzerliste bleibt unverändert; Frontend zeigt Herkunft als Text-Badge
  (KI-UX: `KolBadge`-Muster der `AdminUsersSection.tsx`).
- **AK7 — Regression:** Env-Allowlist (`GOOGLE_ALLOWED_EMAIL[S]`) wirkt unverändert;
  bestehende `allowedEmails.test.ts` bleiben grün (deshalb keine Sync-Änderung an
  `isEmailAllowed`).

## Verbindliche UX-Vorgaben aus dem KI-UX-Block

- Unbekannte Adresse darf in der Gruppen-Einladung nicht mehr als Fehler enden, sondern als
  Erfolg mit Rückmeldung (`KolAlert _type="success"` im bestehenden Muster) — dasselbe
  Feedback-Muster für die Delegation, keine zweite Variante.
- Admin-Sicht: zugelassene Adressen als Listeneinträge im bestehenden Karten-Listenmuster
  (`<ul class="admin-user-list">`, 375px-fest), Herkunft als Text-Badge (nie nur Farbe,
  WCAG 1.4.1), keine neue Signal-Farbe.
- Mail: Zugangslink als echter `<a>` mit beschreibendem Linktext (BITV 2.4.4), Betreff nennt
  Absender/Kontext.
