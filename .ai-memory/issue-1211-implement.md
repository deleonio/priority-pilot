# Issue 1211 — Impl (Phase 4), Stand 2026-09-04

**ERGEBNIS: VERDICT not-ready (Zeitnot).** Server-Seite komplett + grün (beide Spec-Suiten), Frontend (AK6/AK7/AK8) NOCH NICHT angefangen — Draft-PR #1214 bleibt Draft. Begründung im PR-Body. Nächster Impl-Lauf: nur noch Frontend + OpenAPI + Gate.

## Erledigt
- Branch `ai/harness/1211` ausgecheckt (Draft-PR #1214, Commit 341f726f = Spec).
- `server/src/models/group.ts` NEU: id/name(STRING 60)/description(TEXT, null) + Timestamps.
- `server/src/models/groupMember.ts` NEU: Komposit-PK groupId+userId, role (Default 'member'), joinedAt DATE, timestamps false (taskPillar-Muster).
- `server/src/models/index.ts`: Group + GroupMember importiert/exportiert (keine Assoziationen — Kommentar-Block ergänzt fehlt noch, nur Exportliste erweitert).
- `server/src/express/routes/groups.ts` NEU: POST/GET/GET :id/PATCH/DELETE — Nutzer-Auflösung über `resolveGeoUser` (Pass-Through-Dev-User für API-Tests ohne Auth-Env, Wiederverwendung aus geoConfig.ts statt Kopie), Sichtbarkeit NUR über `GroupMember`-Lookup (kein ownerScope), fremd/Nicht-Admin → 404; POST+DELETE in `sequelize.transaction` (pillars.ts:340-Muster); memberCount via COUNT.
- `server/src/express/index.ts`: `groupsRouter` importiert + hinter `requireAuth` nach seriesRouter gemountet.
- Beide Server-Suiten GRÜN: `NODE_ENV=test DATABASE_STORAGE=:memory: npx tsx --test src/express/groups.{api,dataisolation}.test.ts` (je 1 ✔ Suite). WICHTIG: `NODE_ENV=test` nötig, sonst ist /auth/test-login nicht registriert → Login-401 (Falle s.o.).
- **Test-Pflege (dokumentiert im PR-Body):** `groups.api.test.ts:59,70` — Spec-Phase hatte `body?.error`/`body.error.length` assertiert; Repo-Fehlervertrag ist seit #1130 zentral `{ message }` (http-error.ts sendError). Assertions auf `body?.message`/`body.message.length` geändert, sonst nichts.
- **Test-Pflege 2:** `groups.api.test.ts:13` `body: any` → struktureller Typ `GroupResponseBody` (eslint no-explicit-any blockierte lint; Assertions inhaltlich unverändert). **Test-Pflege 3:** `frontend/e2e/groups.spec.ts:72` Playwright-`toBe(false, 'msg')` → `expect(wert, 'msg').toBe(false)` (tsc TS2554 — Playwright nimmt die Nachricht auf expect, nicht auf toBe).
- `pnpm lint` komplett GRÜN (server+frontend), prettier-check über alle geänderten Dateien grün.

## Relevante Stellen
- `server/src/express/routes/groups.ts` — fertig implementierter API-Vertrag.
- `server/src/express/routes/geoConfig.ts:29` — `resolveGeoUser` (exportiert), Dev-Pass-Through-Nutzer.
- `frontend/src/App.tsx:63` (`SETTINGS_PATH_SEGMENTS` + 'gruppen') + `:355` Navigation + `frontend/src/components/SettingsPage.tsx:34` (`SETTINGS_TABS`) — Frontend-Einstiegspunkte, NOCH UNBERÜHRT.
- `frontend/e2e/groups.spec.ts` — unveränderter Vertrag für AK6/AK7/AK8 (Button-Texte „Gruppe anlegen“/„Anlegen“/„Löschen“/„Endgültig löschen“, Texte /wirklich löschen/, /Mitglieder-Einträge/, /1 Mitglied/, listitem-Karten, tabpanel-heading „Gruppen“).
- `docs/spec/issue-1211.md` — vollständiger Vertrag inkl. Frontend-Vertrag (KolBadge-Rolle, Modal, sequenzielle Bestätigung, EmptyState/KolSpin/KolAlert).

## Annahmen
- `resolveGeoUser`-Wiederverwendung statt eigenem Duplikat ist korrekt (gleiche Semantik: Session sonst Dev-User; Kommentar dort erwähnt `/tasks/nearby` als weiteren Konsumenten).
- openapi.yml + `server/src/api.d.ts`/`client/src/schema.d.ts` pflegen MIT dem Frontend (ein Schritt), nicht vorab — Server-Tests hängen nicht daran.

## Verworfen
- Frontend in diesem Lauf — Soft-Deadline (~19 min ab Laufstart) reichte nicht für Tab+Modal+sequenzielle Bestätigung+e2e+Gate; halbfertige UI wäre schlechter als sauberer Schnitt.
- Eigene Dev-User-Auflösung im groups-Router — `resolveGeoUser` deckt sie ab.

## Offen
- Frontend AK6/AK7/AK8 komplett (Tab, Karten-Liste, Anlegen-/Bearbeiten-Modal mit Inline-Validierung, sequenzielle Löschen-Bestätigung mit Fokus, Empty/Laden/Fehler-Zustände).
- `openapi.yml` Group-Schemas + Client-Typen regenerieren.
- Voller Gate-Lauf (`pnpm format/prettier/lint/knip/test`) + e2e `groups.spec.ts` + 375/1280-Check.
- Full-Suite-Nachweis: in diesem Lauf liefen nur die zwei Gruppen-Suiten (Zeitnot), nicht `pnpm test` komplett.

## Nächster Schritt
- Frontend bauen (App.tsx-Segmente + SettingsPage-Tab + Komponente), dann kompletter Gate + e2e, dann `gh pr ready 1214` + Beschreibung erweitern.

## Fallstricke
- Server-Tests NUR mit `NODE_ENV=test DATABASE_STORAGE=:memory:` starten (package.json-Skript tut das; `/auth/test-login` ist sonst nicht registriert → 401).
- Fehler-Body = `{ message }`, NIEMALS `{ error }` (#1130, error-contract.test.ts wacht darüber).
- `session.test.ts` ohne Redis rot (pre-existing, MEMORY 2026-08-29) — nicht jagen.
- Gruppe „groups“-Tabelle: sequelize.sync() legt an (verify in helpers — resetDb nutzt sync), KEINE migrate.ts-Änderung (Issue-Text).
- Nicht-Admin-Bearbeiten → 404 (nicht 403) — bewusste Einheitlichkeit gegen Existenz-Leak; kann in Ticket 2 (Einladungen) revidiert werden.
