# Spec: Warteliste mit Referral-Rang (#1982)

Grundlage: ADR 0019 (Zugang zum Launch: Warteliste). Unbekannte E-Mail-Adressen landen auf einer
Warteliste, sehen sofort ihre Position und einen persönlichen Empfehlungs-Link; geworbene
Anmeldungen verbessern die Position; Admins schalten einzelne Adressen oder die Top N frei.

## Datenmodell

- Neues Modell `WaitlistEntry` (`server/src/models/waitlistEntry.ts`, Kopiervorlage
  `groupInviteLink.ts`): `email` (unique, normalisiert trim+lowercase), `referralCode`
  (unique, `crypto.randomBytes`), `referredByCode` (nullable), `status`
  (`waiting` | `activated`), `createdAt`. Side-Effect-Import in `models/index.ts`.

## API-Vertrag (öffentlich)

`POST /auth/waitlist` — Body `{ email, ref? }`:

- E-Mail wird normalisiert (trim + lowercase) gespeichert; ungültige E-Mail → 400.
- Antwort `{ position, referralCode }` — `position` ist die **1-basierte** Position im aktuellen
  Rang, `referralCode` der persönliche Empfehlungs-Code.
- **Idempotenz (AK1):** wiederholter Aufruf mit derselben normalisierten Adresse erzeugt keinen
  Zweit-Eintrag und liefert dieselbe Position (Duplikat ist Erfolg, kein Fehler).
- **Referral (AK2):** gültiger `ref`-Code eines anderen Eintrags setzt `referredByCode`; ein
  unbekannter oder eigener Code wird still ignoriert (kein Fehler).
- **Rangformel:** Position = Rang in der Sortierung (Anzahl geworbener Anmeldungen absteigend,
  `createdAt` aufsteigend). Ein neuer Referral verbessert die Position des Werbenden sofort.

## API-Vertrag (Admin, `requireRole('admin')`)

- `GET /admin/waitlist` — Liste `{ id, email, status, position, referralCount, createdAt }`.
- `POST /admin/waitlist/:id/activate` (AK3) — setzt `status = 'activated'`.
- `POST /admin/waitlist/activate-top` — Body `{ count }` (AK4, „Welle“): schaltet die Top-N-Einträge
  nach Position frei; Antwort `{ activatedCount }` zählt bereits freigeschaltete nicht doppelt.

## Freischaltung wirkt auf den Login (AK3)

`isEmailAllowed` (`server/src/logics/allowedEmails.ts`) bleibt die zentrale Login-Prüfung: Nebst
env-Allowlist und `OPEN_SIGNUP` akzeptieren **alle** ihrer Aufrufer
(`express/index.ts:227`, `routes/auth.ts`) ab sofort auch Adressen mit `status = 'activated'` in
der Warteliste. Nicht freigeschaltete Adressen bleiben abgelehnt.

## Anmeldeseite (AK5/AK6)

- Neuer Wartelisten-Block **unterhalb** der bestehenden Login-Wege (kein Modal, keine neue Route),
  im etablierten rohen-Elemente-Muster der LoginPage (`.login-page-*`, **keine** KoliBri-Komponenten
  — dokumentierte Ausnahme, siehe KI-UX-Block).
- Zustandsmaschine `idle → sending → done/failed` wie Magic Link: nach dem Eintrag erscheinen
  Position (als `role="status"`, Satz mit Kontext) und der kopierbare Empfehlungs-Link
  (readonly lesbar + Copy-Button mit `aria-label`).
- Bestehende Login-Zustände (Google, Magic Link, `?error=*`-Meldungen) bleiben unberührt.
- Mobile 375 px: Block ohne horizontales Scrollen; langer Link bricht um
  (`overflow-wrap: anywhere`).

## Testfälle

- TF1 `server/src/express/waitlist.test.ts` (AK1) — neue Adresse → Position 1; Wiederholung mit
  anders normalisierter Schreibweise → dieselbe Position, kein Duplikat; ungültige E-Mail → 400.
- TF2 dito (AK2) — Referral-Entry des Werbers rückt auf Position 1 vor älteren Einträgen ohne
  Referrals; unbekannter/eigener Code ohne Fehler.
- TF3 dito (AK3) — Admin-Aktivierung → `test-login` (=`isEmailAllowed`-Aufrufer) nimmt die Adresse
  an; nicht freigeschaltete bleibt 401.
- TF4 dito (AK4) — Top-2-Welle trifft genau die zwei Höchstplatzierten, `activatedCount = 2`,
  Wiederholung zählt 0.
- TF5 `frontend/src/components/LoginPage.test.tsx` (AK5) — Eintragsfeld-Zustandsmaschine,
  Positions- und Link-Anzeige, Fehlerfall; bestehende Magic-Link-Tests unverändert.
- TF6 `frontend/e2e/issue-1982-warteliste.spec.ts` (AK5/AK6) — Eintrag über die echte API,
  Positions-Anzeige, Referral-Link-Fluss, 375 px ohne horizontales Scrollen.
