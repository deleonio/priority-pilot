# Issue 1211 — Documenter (Phase 6), Stand 2026-09-04

## Erledigt
- PR 1214 analysiert (merged; Author app/my-github-action-bot; Labels ai:reviewed, ai:skip-commit-guard), `/tmp/doc.json` geschrieben und per `jq .` als validiert bestätigt.
- Klassifikation `new` (Feature komplett neu: Group/GroupMember-Modelle, /groups-Route, Settings-Tab).
- `title` leer gelassen — existierender Titel „feat(frontend): add groups tab with CRUD, roles and delete confirmation“ ist konform und typpassend (Input: title compliant = true).
- `files`: 8 Dateien (Route, beide Modelle, openapi.yml, GroupsSection/GroupFormDialog/GroupDeleteDialog, SettingsPage) — Tests/.ai-memory/costs bewusst weggelassen (SKILL: 3–8 relevanteste).
- `issues`: [{Closes #1211}] aus dem PR-Body; Migration leer (nicht breaking).
- Wegwerf-Artefakt `.ai-memory/issue-1211-doc.json.tmp` (Write-Tool kann nicht nach /tmp, daher Repo-Zwischendatei + `cp`) wieder gelöscht.

## Relevante Stellen
- `server/src/express/routes/groups.ts` — CRUD, Rechte nur über Membership, einheitlich 404 statt 403, Transaktion POST/DELETE.
- `server/src/models/group.ts` / `groupMember.ts` — Group ohne userId; GroupMember Komposit-PK groupId+userId.
- `openapi.yml` — Quelle der Client-Typen (Group/GroupInput/GroupUpdate); api.d.ts/schema.d.ts sind gitignored.
- `frontend/src/components/GroupsSection.tsx`, `GroupFormDialog.tsx`, `GroupDeleteDialog.tsx` — Liste, Modal, zweistufige Lösch-Bestätigung.
- `frontend/src/components/SettingsPage.tsx` — Tab „Gruppen“ (Index 4, Route /settings/gruppen) + Grid-Fix für 375px (AK8).

## Annahmen
- „1211 (context)“ = der in PR-Body enthaltene Spec/Impl-Kontext; eigener Issue-Lauf nicht nötig (Body enthält alle AK-Beschreibungen).
- Release Note auf Endnutzer-Sicht (Gruppen anlegen/verwalten, Rollen, Lösch-Bestätigung); Einladungs-Mechanik existiert nicht — Formulierung „invite context via member list“ bewusst weich gehalten.

## Verworfen
- Klassifikation `breaking` — nur additive Endpunkte/Modelle, keine Vertragsänderung Bestehender.
- `title`-Rename — vorhandener Titel bereits konform.
- `migration_en` — nur für breaking vorgesehen.

## Offen
-

## Nächster Schritt
- Keiner — Phase 6 ist die letzte Phase; Output liegt unter `/tmp/doc.json`.

## Fallstricke
- Write-Tool schreibt nicht nach /tmp (MEMORY 2026-08-26) → JSON im Repo als `.ai-memory/issue-1211-doc.json.tmp` Zwischenspeichern, `cp` nach `/tmp`, Datei danach entfernen.
- gh pr view --jq hängt 1 Newline an (Memory 2026-08-25) — hier irrelevant, da vollständiges JSON per Datei.
