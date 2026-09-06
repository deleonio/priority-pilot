# Issue 1251 — Implement (spec mode), Stand 2026-09-06 — ABGESCHLOSSEN

## Erledigt
- Spec-Mode: Draft-PR #1263 (`ai/harness/1251`, rote Tests `26f81a30`) übernommen; Branch ausgecheckt, Ampel 🟢 (Quick-Check: alle Analyse-Dateien vorhanden).
- Implementiert in Commit **`5625297b`** (gepusht, pre-commit-Hooks normal durchgelaufen, kein --no-verify nötig):
  - `server/src/express/routes/groups.ts` — Helper `restCrossMemberSeries(ownerIds, creatorIds, tx)` (JS-Filter `createdById !== userId`, NULL-sicher, Muster groups.ts GET /groups/:id/tasks); DELETE /groups/:id räumt in der Tx GroupInvitation + Cross-Serien aller Ex-Mitglieder ab; DELETE /groups/:id/members/:userId jetzt in Tx: Serien stillagen (userId=Entfernter, createdById∈verbleibende), Einladungen (group, user) löschen, `target.destroy({transaction})`.
  - `server/src/logics/groupInvitationCleanup.ts` (NEU) — `cleanupOrphanedGroupInvitations()`, idempotent, loggt Anzahl.
  - `server/src/index.ts` — dynamischer Import + Aufruf nach seedDemoData (vor launchServer).
  - `frontend/src/components/SeriesTab.tsx` — `{entry.active === false && <KolBadge _label="Ruhend" className="series-tree-badge" />}` nach Rhythmus-Badge; kein CSS-Edit (`series-tree-row` hat flex-wrap).
- Alle AKs grün: API-Datei 6/6, Cleanup 1/1, Vitest SeriesTab 7/7, e2e 2/2 (375×812).
- Gate grün vor Push: format ✓, prettier ✓, lint ✓, knip ✓ (nur prä-existing hints), `pnpm test` server 894/0, frontend 599 pass/13 skip, scripts 274/0.
- PR #1263: Body um Implementierungs-Sektion erweitert (`.ai-memory/issue-1251-pr-body-new.md`), `gh pr ready 1263` → OPEN, isDraft=false.

## Relevante Stellen
- `groups.ts:~214` DELETE-Gruppe, `groups.ts:~575` DELETE-Member (Zeilen durch Formatierung verschoben), Helper über den DELETE-Routen.
- `server/src/index.ts:155` (Import) + nach seedDemoData (Aufruf).
- Bewusste Entscheidung (PR-Body dokumentiert): Member-Remove löscht Einladungen ALLER Status (Analyse nannte nur pending; AK1-Parallele „alle Status", verhindert Legacy-Geister wie in AK2).

## Annahmen
- Stilllegen auch bereits inaktiver Treffer (`active:false` idempotent überschrieben) — harmlos, kein Test unterscheidet.

## Verworfen
- Sequelize-`where(col, Op.ne, col)` für createdById≠userId — JS-Filter nach NULL-sicherem Muster.
- MEMORY.md-Eintrag — keine neue Fehlerklasse.
- Playwright-MCP-375/1280-Check — in dieser Sandbox nicht verfügbar; 375px deterministisch über die neue e2e abgedeckt (Begründung im PR-Body).

## Offen
- Review-Phase (Labels setzt der Workflow).

## Nächster Schritt
- -

## Fallstricke (für Fixup)
- Server-Tests brauchen `NODE_ENV=test DATABASE_STORAGE=:memory:` (blosses tsx --test → 401 im testLogin).
- Session.test.ts lief diesmal lokal GRÜN durch (Redis vorhanden) — der 2026-08-29-Eintrag gilt weiter sandboxabhängig.
- E2E-Title-Matching nutzt die truncateten 30-Zeichen-Titel (uniqueTitle).
