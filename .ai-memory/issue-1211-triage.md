# Issue 1211 — Triage (Phase 1), Stand 2026-09-04T02:47:00Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar; einziger Kommentar = github-actions-Qualitätscheck `<!-- ai-quality -->` 2026-09-04T02:22:55Z, keine Entscheidungen). Analyse-Block + Routing-Tabelle als neuer Harness-Kommentar erstellt (issuecomment-5534946395), Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt (Endstand verifiziert). Kein Ping-Kommentar, Titel/Body unangetastet, kein Split, kein Auto-Close (keine Gruppen-Dateien im Repo).

## Erledigt
- Issue + alle Kommentare geladen; Code-Recherche gebündelt selbst gefahren (kein `recherche`-Agent vorhanden, Scout-Umweg wegen überschrittener Soft-Deadline gespart).
- Muster verifiziert: `server/src/models/taskPillar.ts` (komposit-PK,.timestamps false — für group_members: groupId+userId PK, `role`, `joinedAt` explizit), `server/src/models/index.ts` (Registrierung), `server/src/express/index.ts:198` (`app.use(requireAuth)` — Router dahinter), `server/src/express/routes/tasks.ts:400-415` (fremd→404), `server/src/express/requireAuth.ts:34` (`ownerScope(undefined)` = `{}`), `frontend/src/App.tsx:63` (`SETTINGS_PATH_SEGMENTS = ['general','pillars','llm','standort']` → 'gruppen' ergänzen), `SettingsPage.tsx` (KolTabs + tab/onTabChange-Props), `server/src/express/series-dataisolation.test.ts` (applyTestAuthEnv, zwei Konten), `LektoratDiffModal.tsx` (sequenzielle Bestätigung). openapi.yml hat KEINE Group-Schemas (alles neu).

## Relevante Stellen
- `server/src/express/routes/groups.ts` — neu; Membership-Lookup statt ownerScope (Sichtbarkeit über group_members-Join), fremde Gruppe 404.
- `server/src/models/group.ts` / `groupMember.ts` — neu; groupMember nach taskPillar-Komposit-PK-Muster.
- `frontend/src/App.tsx:63` + `frontend/src/components/SettingsPage.tsx` — neuer Tab „Gruppen" (`/settings/gruppen`).
- Tests neu: `server/src/express/groups.api.test.ts`, `server/src/express/groups-dataisolation.test.ts`, `frontend/e2e/groups.spec.ts`.

## Annahmen
- Routing (ux ja/sonnet/medium, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high) folgt Präzedenz #1083 (ähnlicher Full-Stack-CRUD).
- Ersteller ist immer Admin → PATCH/DELETE-Rechte über role='admin'; „eigene Nicht-Admin-Gruppe bearbeiten" kann in diesem Ticket nicht auftreten (Mitgliedschaft entsteht nur durch Selbst-Anlegen oder Ticket-2-Einladung).
- `memberCount` aus COUNT über group_members.

## Verworfen
- Split — Backend+Frontend+OpenAPI = ein Vertrag, ein PR (Präzedenz #1083).
- Titel-Änderung („Gruppen anlegen und eigene Gruppen verwalten") — trifft exakt zu.
- MEMORY.md-Eintrag — kein Fehler, kein Umweg, Kriterium nicht erfüllt.

## Offen
- `.ai-memory/issue-1211-harness.md` = Wegwerf-Artefakt (gesendeter Kommentar-Body), NICHT committen. Nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- UX-Phase (Label `ai:needs-ux-ui` gesetzt): KI-UX-Block in denselben Harness-Kommentar (read-modify-write, KI-ANALYSE + Routing byte-genau erhalten).

## Fallstricke
- Gruppen-Isolation NICHT über ownerScope bauen — Group hat kein userId-Feld; Zugehörigkeit kommt aus group_members (Issue-Text: „Gruppen anderer Nutzer weder sichtbar noch erreichbar").
- AK8: scrollWidth-Assertion aus dem Issue funktioniert nicht (App-Shell clippt overflow-x:hidden) → Bounding-Box prüfen (MEMORY 2026-08-24).
- KolTabs-Eigenheiten: inaktive Panels bleiben gemountet ([hidden]); Slider-/Formular-Lokatoren auf den Gruppen-Tab scopen (MEMORY 2026-08-29); Panels via `[slot^="tabpanel-slot-"]`.
- sequelize.sync() legt Tabellen an — KEINE migrate.ts-Funktion (Issue sagt explizit).
- Pass-Through-Modus (ownerScope(undefined)) muss Gruppen-Router nicht brechen — Isolationstests laufen mit Auth-Env, api-Tests ohne.
