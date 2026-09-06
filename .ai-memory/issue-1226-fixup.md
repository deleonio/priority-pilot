# Issue 1226 — Fixup PR #1246 (Review-Kreuzverhör, 1. Runde), Stand 2026-09-06

## Erledigt
- Findings SCOPED gelesen: ai-review-Kommentar 5555911376 (2 Blocker + 1 Nit) + 2 Review-Threads
  (3942545797 e2e spec :54, 3942545800 docs/spec/issue-1226.md:34). Beide Blocker fixable, keine
  Entscheidungs-Findings → kein needs-human.
- Befund verifiziert: PR-Diff enthält NUR Server-Teil (12 Dateien); `frontend/src/components/GroupJoinPage.tsx`
  fehlt, `Root.tsx`-Weiche fehlt, GroupDetail-Admin-Bereich fehlt, `openapi.yml` unangetastet.
- Delegation-Entscheid: Gate/Suchen DIREKT gefahren, keine Agent-Rollen (MEMORY 2026-09-05:
  Subagents fallen hier mit `API Error 400 [1214] does not exist` aus). Abweichung vom
  Prompt-Delegation-Hinweis damit begründet.

## Relevante Stellen
- `docs/spec/issue-1226.md` — Frontend-Vertrag: 4 Zustände (Laden/Fehler/409/Erfolg), Route
  `/gruppen/beitreten` vor Auth-Gate (Muster `/bahn`, Root.tsx:186-196), Admin-Bereich „Einladungen“
  unterhalb der Nutzersuche, Modal-Muster `pendingRemoval` (GroupDetail.tsx:212-236).
- `server/src/express/routes/inviteLinks.ts` — öffentlicher Router (GET + redeem); Nit: Membership-Check
  Z.74-77 außerhalb der Transaktion → in die Transaktion ziehen (Muster Composite-PK, UniqueConstraint → 409).
- `server/src/express/routes/groups.ts:611,643` — POST `/groups/:id/invite-links` (201 {id,token,expiresAt}),
  DELETE `/invite-links/:id` (204). KEIN GET-Listen-Endpoint → Admin-Link-Liste nur als Session-State
  der UI (Token bleibt One-Time-Visible, Spec: „einmal voll sichtbar, danach maskiert“).
- `openapi.yml` — Pfade fehlen; Stil: `operationId`+`tags: [groups]`+`$ref Error`; Schemas ab Z.1857
  (GroupInvitation, InvitationResult). Client-Schema `client/src/schema.d.ts` ist UNGETRACKT
  (client/.gitignore) → nur openapi.yml committen + lokal `cd client && pnpm generate`.
- `frontend/src/api.ts:148` — Fassade über openapi-fetch (`client.GET/POST` + ResponseError);
  CSRF-Middleware Z.44-58 (nur Writes).
- `frontend/src/Root.tsx:186-196` — Weiche: `if (pathname === '/bahn') return <BahnPage/>` →
  hier `/gruppen/beitreten` ergänzen.
- `frontend/src/lib/auth.ts:20` `checkAuth()` — für Join-Seite: unauthentifiziert → Login-Redirect
  mit returnTo; `sanitizeReturnPath` (server/src/logics/silentReturnPath.ts) akzeptiert interne Pfade
  mit Query → `/auth/google/silent?returnTo=%2Fgruppen%2Fbeitreten%3Ftoken%3D…`.
- `frontend/e2e/groups-invite-links.spec.ts` — AK5 (:54 Button „Gruppe beitreten“, Text /beigetreten/i,
  Gruppenname + Inviter-Name sichtbar) und AK6 (:106 Bounding-Box ≤375px, Button + Kontexttext).
  Tests UNVERÄNDERT lassen.
- `frontend/src/app.css:1261+` — `.groups-*` Klassen als Stil-Referenz; `--a11y-min-size` existiert (Z.242,352).

## Annahmen
- Admin-Linkliste ohne Server-GET: Links werden im Komponenten-State (Session) gehalten — Spec-Forderung
  „danach maskiert + Ablaufdatum“ damit erfüllt, ohne einen neuen Endpoint zu erfinden (Spec-API-Vertrag
  listet bewusst nur POST/GET-public/redeem/DELETE). Kein Server-Endpoint ergänzt.
- Erfolgszustand OHNE Auto-Redirect (Spec: Weiterleitung advisory, KI-UX) — e2e prüft sichtbaren
  Erfolgstext, ein sofortiger Redirect würde AK5 rot machen.
- `/auth/google/silent?returnTo=…` als Login-Einstieg der Join-Seite (nicht `/auth/google`, das kein
  returnTo unterstützt) — Token überlebt den Roundtrip.

## Verworfen
- GET `/groups/{id}/invite-links` (Listen-Endpoint) nachbauen — steht NICHT im Spec-Vertrag; PR-Body-Behauptung
  wird stattdessen korrigiert (Finding #2). Neuer Endpoint wäre Scope-Ausweitung über den Review-Fix hinaus.
- Subagent-Delegation von Gate/Suche — Rollen in dieser Umgebung nicht lauffähig (s. o.).

## Offen
- -

## Nächster Schritt
- Implementierung: Nit-Transaktionsfix → openapi.yml + generate → api.ts-Methoden → GroupJoinPage +
  Root-Weiche + GroupDetail-Admin-Bereich + CSS → GATE (format/lint/knip/frontend tests/e2e AK5+AK6) →
  Commit+Push → ai-fixup-decisions-Kommentar (Nachweis-Tabelle) → Threads resolven → PR-Body korrigieren.

## Fallstricke
- e2e AK5: „Gruppe beitreten“-Button exakt dieser Name (getByRole button name); Erfolgstext muss
  /beigetreten/i matchen und sichtbar bleiben (kein Auto-Redirect).
- AK6: Bounding-Box ≤ 375px — kein overflow-x Test; Karte/Inhalt mit minmax(0,1fr) und Button volle Breite.
- JS-Tests: GroupDetail.test.tsx existiert — neue Admin-Sektion darf bestehende Assertions nicht brechen
  (Buttons gerendert nur für Admins; „Link erzeugen“ nur admin).
- redeem 409 als EIGENER Zustand („bereits Mitglied“), nicht als Fehler-Alert.
- Pre-commit lefthook läuft knip/tsc über Workspaces → client generate VOR Commit ausführen, sonst
  Unresolved-Imports/fehlende Pfade.
- Soft-Deadline 1788658817 (~21 min nach Start) — eng; GATE gezielt (frontend + gezielte e2e), kein Full-Run.
