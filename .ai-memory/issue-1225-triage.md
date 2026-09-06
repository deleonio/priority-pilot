# Issue 1225 — Triage (Phase 1), Stand 2026-09-05

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar; einziger Kommentar = github-actions-Qualitätscheck, keine Entscheidungen). Analyse-Block + Routing-Tabelle als Harness-Kommentar angelegt (issuecomment-5555512117), Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt (ux=ja). Kein Ping, Titel unangetastet („Gruppenbild hinterlegen" — trifft), kein Body-Edit, kein Split (ein AK-Satz, ein PR, Präzedenz #1083), kein Auto-Close (`imageUrl` kommt in groups.ts/group.ts nirgends vor).

## Erledigt
- Issue geladen; Code-Recherche: alle vom Issue genannten Ziele existieren und verifiziert (s. Relevante Stellen). #1211 (Gruppen-Stack) ist CLOSED/gemergt.
- Harness-Kommentar via `gh issue comment --body-file -` (Heredoc, Zeilen Spalte 0) angelegt; Labels verifiziert: `ai:needs-ux-ui, ai:analysed`.

## Relevante Stellen
- `server/src/models/group.ts` — neues Feld `imageUrl: string | null` (Muster `server/src/models/user.ts:14,45` `avatarUrl`).
- `server/src/logics/migrate.ts:144-159` — `migrateUsersAvatarUrl` als Vorlage für idempotente `ALTER TABLE`-Nachziehung; Exportliste der Migrationen in `server/src/index.ts:136-143`.
- `server/src/express/routes/groups.ts:144-181` — PATCH-Handler, presence-basiert (abwesende Felder unverändert); `toDto` Z.43 muss `imageUrl` liefern; Z.152 `!found || role !== 'admin'` → heute 404 für ALLE Nicht-Admins, AK3 verlangt künftig 403 (Mitglied) / 404 (Nicht-Mitglied) — Muster Z.209-210 (invitations).
- `openapi.yml:1786` — Schema `GroupUpdate` (Felder optional), plus `Group` erweitern.
- `frontend/src/components/GroupsSection.tsx:156-200` — Gruppenliste (`groups-info`-Block, klickbare Karte #1212/#1223 — Avatar darf Klick nicht verschlucken).
- `frontend/src/components/GroupDetail.tsx` + `frontend/src/components/GroupFormDialog.tsx` — Detail-Anzeige bzw. Bearbeiten-Dialog (Eingabefeld Bildadresse).
- `frontend/src/App.tsx:665` — KolAvatar-Muster: `_label={name}` + `_src={url ?? undefined}`; ohne src rendert KoliBri Initialen aus `_label`.
- Tests: `server/src/express/groups.api.test.ts`, `server/src/express/groups-dataisolation.test.ts:75` (fremde Gruppe 404 — nicht rot machen), `frontend/src/components/GroupDetail.test.tsx`, `frontend/e2e/groups.spec.ts`.

## Annahmen
- Bildadresse statt Upload ist begründet im Issue (folgt `avatarUrl`-Muster) — nicht hinterfragt.
- 403/404-Trennung auf PATCH ist bewusste Verhaltensänderung gegenüber aktuellem Einheits-404 (Issue-AK explizit; Kommentar groups.ts:141-142 nennt historischen Grund).
- Routing: ux ja/sonnet/medium, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high (etabliertes Muster, z. B. #1083/#1098).

## Verworfen
- Split — Server+Frontend gehören zusammen (API-Vertrag Teil desselben Features).
- Titel-/Body-Edit — Issue präzise; ADR 0009 verbietet Body-Edit ohnehin.
- MEMORY.md-Eintrag — kein neuer Fehler, Aufnahmekriterium nicht erfüllt.

## Offen
- -

## Nächster Schritt
- UX-Phase (Label `ai:needs-ux-ui` gesetzt): KI-UX-Block in den Harness-Kommentar schreiben (read-modify-write, KI-ANALYSE + Routing byte-identisch lassen).

## Fallstricke
- Bestehender PATCH-404-Test für Nicht-Admin-Mitglied müsste auf 403 geändert werden — vorher `groups.api.test.ts` nach Nicht-Admin-PATCH-Fällen durchsuchen (bei Recherche keine gefunden, grep war leer).
- Migration nur für Bestands-DB wirksam: `findOrCreate`-Pfad frischer DBs braucht `imageUrl` im Model-Default (Muster `migrate.ts:147-148`), sonst `no such column`.
- KolAvatar braucht feste Größe, sonst Layout-Sprung beim Nachladen (AK4 „springt nicht").
- Gruppen-Karte ist ganzflächig klickbar (#1212/#1223) — Avatar-Container darf `onClick` nicht abfangen.
- Heredoc in CI: Zeilen Spalte 0, EOF-Terminator ebenfalls.
