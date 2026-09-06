# Issue 1225 — Spec-Phase, Stand 2026-09-05

## Erledigt
- Branch `ai/harness/1225` fortgeführt (triage/ux-Commits 3e0957e6/e53845f1), rote Tests + Spec in einem Commit: `docs/spec/issue-1225.md`, `server/src/express/groups.api.test.ts` (AK1: https 200 / http 400 / null entfernt / abwesend unverändert), `server/src/express/groups-invitations.api.test.ts` (AK3: member→403, Nicht-Mitglied→404, Muster des invitations-403-Tests), `server/src/logics/migrate.test.ts` (AK2: `migrateGroupImageUrl` Alt-Schema/idempotent/No-op), NEU `frontend/src/components/GroupsSection.test.tsx` (AK4: KolAvatar `_src`/Initialen via Mock), `frontend/e2e/groups.spec.ts` (AK4 Bild+Initialen, AK5 375px Bounding-Box).

## Relevante Stellen
- `server/src/express/routes/groups.ts` PATCH (`!found || role !== 'admin'` → 404; `changes`-Objekt) — AK1/AK3-Ziel.
- `server/src/logics/migrate.ts:150/468` — Migrationsmuster (`PRAGMA table_info` + ALTER).
- `frontend/src/components/GroupsSection.tsx` `.groups-info` (KolButton-Name) — Avatar-Ziel; kein GroupsSection-Test existierte vorher.
- `frontend/src/components/GroupFormDialog.tsx` — Feld „Bildadresse“ nur im Bearbeiten-Modus (KI-UX).
- e2e: `createGroupViaUi`/`openGroupsTab` in `frontend/e2e/groups.spec.ts` wiederverwendet.

## Annahmen
- DTO-Feldname `imageUrl` (string|null), `null` = kein Bild (KI-UX-Festlegung „leeres Feld = entfernen“).
- E2E-Avatar-Selektor `kol-avatar` (KoliBri custom element, Mock in Unit-Tests spiegelt `_src` als `data-src`).
- AK5 bewusst per Bounding-Box statt `scrollWidth` (Shell clippt overflow-x:hidden, Memory 2026-08-24) — im Spec/PR-Body dokumentiert.

## Verworfen
- Unit-Assertion „feste Avatar-Größe“ — jsdom hat kein Layout, zäh wäre sie nicht; Größe fließt über AK5-e2e (Bounding-Box) + CSS.
- GroupDetail-Unit-Test — Detail-Avatar über e2e abgedeckt; GroupDetail.test.tsx-Mocks nicht doppelt aufbauen.

## Offen
- —

## Nächster Schritt
- Impl-Phase: `imageUrl` an Model/DTO/PATCH/openapi, `migrateGroupImageUrl` + Verdrahtung `server/src/index.ts` (~Z.168), 403/404-Split im PATCH, Dialogfeld + Avatare; danach rote Tests grün.

## Fallstricke
- `migrateGroupImageUrl` existiert noch nicht → Import nur per Namespace+Cast (`migrateModule as unknown as {...}`), sonst stirbt tsc/Pre-Commit (Memory 2026-08-23).
- PATCH bleibt presence-basiert: `imageUrl` nur bei Anwesenheit validieren; `null` explizit als Entfernen-Signal.
- KI-UX: Feld nur im Bearbeiten-Modus, https-Fehler clientseitig inline, `_color` nicht setzen, `_label` immer Gruppenname.
