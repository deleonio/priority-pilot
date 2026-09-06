# Issue 1225 — Impl-Phase, Stand 2026-09-06

## Erledigt
- Branch `ai/harness/1225` (Draft-PR #1245, spec-Commit 812a84fa), Ampel 🟢. ALLE roten Tests grün, Gate komplett grün, Commit+Push+PR-ready (Nr. s. git log).
- Server: `models/group.ts` (+`imageUrl` STRING nullable), `logics/migrate.ts` (+`migrateGroupImageUrl` hinter `migrateUsersAvatarUrl`), `index.ts` (Import + Aufruf vor sync()), `routes/groups.ts` (DTO+`toDto` mit imageUrl; PATCH-Split 404/403; imageUrl-Validierung: `null`→entfernen, Trim+`https://`-Präfix sonst 400 „Die Bildadresse muss beginnen mit https://."), `openapi.yml` (Group.properties.imageUrl nullable + GroupUpdate.imageUrl).
- `client/src/schema.d.ts` via `pnpm --filter client generate` regeneriert — Datei ist GITIGNORED (client/.gitignore:1), nichts zu committen.
- Frontend: `GroupsSection.tsx` (KolAvatar `className="groups-avatar"` `_label={group.name}` `_src={group.imageUrl ?? undefined}` als erstes Flex-Kind vor `.groups-info`; GroupDetail bekommt `group={group}`), `GroupFormDialog.tsx` (Edit-only Feld „Bildadresse", KolInputText `_type="url"` + `_hint`, clientseitige https-Prüfung mit bestehendem KolAlert-Error-Muster, leeres Feld → `imageUrl: null` nur bei Änderung), `GroupDetail.tsx` (OPTIONALER Prop `group?: Group` → Detailkopf Avatar+Name), `app.css` (`.groups-avatar` 2rem fix + `flex-shrink:0`, `.group-detail-head`).
- Teststände: groups.api.test.ts 13 ✔ (AK1 4), groups-invitations.api.test.ts 16 ✔ (AK3 1), migrate.test.ts 26 ✔ (AK2 3), GroupsSection+GroupDetail Vitest 12 ✔, e2e groups.spec.ts 10 ✔ (AK4 Bild+Initialen, AK5 375px Bounding-Box).
- Gate (gate-runner): format / prettier --check / lint / knip / test — alle exit 0, server+frontend 274 Tests pass.

## Relevante Stellen
- `server/src/express/routes/groups.ts` — PATCH: `!found`→404, `role!=='admin'`→403, danach imageUrl; DELETE behält bewusst 404-für-alle (AK3 nennt nur PATCH).
- `frontend/src/components/GroupsSection.tsx:169-178` — Click-Exclusion-Selektor bewusst NICHT erweitert (Avatar klickt auf die Karte, KI-UX).
- `frontend/src/components/GroupDetail.test.tsx` — rendert `<GroupDetail groupId ownRole />` ohne Gruppenobjekt in 5 Tests → deshalb `group?` optional, Detailkopf nur bei gesetzt.
- `frontend/src/app.css` `.groups-avatar` — kol-avatar Shadow-Host hat 100px-Fixbreite (kein Custom Property), deshalb width/height explizit (Muster `.app-header kol-avatar`, app.css:374).

## Annahmen
- Avatar-Größe `var(--pp-space-6)` (2rem, konsistent Kopfzeile mobil) statt der im KI-UX-Beispiel genannten 40px — 40px wäre kein --pp-space-Token („keine neuen Skalenwerte").
- Playwright-MCP-Layoutcheck (SKILL 3b) durch das e2e-Chromium-Run ersetzt: AK5-Test fährt echten 375px-Viewport mit Bounding-Box-Assertion; 1280px sind die Playwright-Defaults der übrigen Tests. Kein separater MCP-Browserlauf.

## Verworfen
- `group` als Pflicht-Prop in GroupDetail — hätte 5 Bestands-Tests gebrochen (nicht anfassbar).
- PATCH 403/404-Split auch auf DELETE anwenden — AK3 benennt nur PATCH; Minimal-Change.
- `_color` am KolAvatar — KI-UX-Verbot (Design-Sprache).

## Offen
- Knip gibt nur Konfigurations-Hinweise (stale ignore-Einträge) aus, exit 0 — bewusst nicht angefasst (kein Ticket-Scope).

## Nächster Schritt
- Review-Phase (`ai:needs-review`): Kreuzverhör auf PR #1245; falls Finding am `group?`-Prop oder Avatar-CSS: Kontext hier.

## Fallstricke
- `client/src/schema.d.ts` ist gitignored und wird bei build/prepare generiert — nicht versuchen, es zu committen.
- `imageUrl` im openapi `Group`-Schema UND required-Liste: Feld muss im DTO immer da sein (Tests lesen es ohne Optional-Guard).
- GroupFormDialog sendet imageUrl nur bei Diff vs. `group.imageUrl ?? ''`; leer→`null` explizit (presence-Vertrag).
- Lokale ungetrackte Phasen-Notizen blockieren den Branch-Wechsel (Branch enthält sie schon getrackt) → Kopie nach /tmp, `rm`, dann switch.
