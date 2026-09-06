# Issue 1226 — PR-Documenter (PR #1246, gemergt), Stand 2026-09-06

## Erledigt
- PR #1246 vollständig analysiert: `gh pr diff 1246` (1889 Zeilen, 23 Dateien) + `gh pr view` (Titel „feat(server): join a group via invite link (#1226)", Labels ai:documented/release:engineering/ai:reviewed/ai:skip-commit-guard, Autor my-github-action-bot). Body (`.ai-memory/issue-1226-pr-body.md`-Inhalt) lieferte die fachliche Zusammenfassung; gegen Diff-Dateiliste kreuzgeprüft (stimmt überein).
- `/tmp/doc.json` geschrieben und per `jq -e .` validiert (jq OK). classification=new, title leer (Titel compliant=true, type/scope feat/server passen).
- Einzige Issue-Referenz: #1226 (keine „Closes/Fixes“-Zeilen im Body; Kontext-Issue übernommen).

## Relevante Stellen
- `server/src/models/groupInviteLink.ts` + `models/index.ts` — neues Modell (token unique, expiresAt, revokedAt).
- `server/src/express/routes/inviteLinks.ts` — öffentlicher Router (GET preview, POST redeem mit Transaktion + 409).
- `server/src/express/routes/groups.ts` — Admin-Endpunkte create/revoke.
- `server/src/express/index.ts` — Mount vor requireAuth.
- `frontend/src/components/GroupJoinPage.tsx`, `GroupDetail.tsx`, `Root.tsx` — Beitrittsseite, Admin-Verwaltung, öffentliche Weiche.
- `openapi.yml` + `client/src/index.ts` + `frontend/src/api.ts` — API-Vertrag und Fassaden.

## Annahmen
- Kein PR-Kommentar mit zusätzlichen „Closes #“-Referenzen nötig — Body nennt nur #1226, Kontext bestätigt.
- `.ai-memory/*`-Dateien im Diff sind Harness-Notizen und bewusst NICHT in `files` aufgenommen (nur die 8 fachlich relevanten).

## Verworfen
- Umbenennung des Titels — compliant=true (bindend) und „feat(server): join a group via invite link (#1226)“ ist konform; Titel leer gelassen.
- `app.css`/`docs/spec/issue-1226.md`/Testdateien in `files` — über der 8er-Grenze, weniger relevant als die Kern-Dateien.

## Offen
- Write-Tool kann nicht nach `/tmp` schreiben (bekanntes Muster, MEMORY 2026-08-26) → JSON zuerst nach `.ai-memory/issue-1226-doc.json` geschrieben, dann per `cp` nach `/tmp/doc.json` kopiert; Wegwerf-Kopie liegt im Repo-Verzeichnis (nicht committen).

## Nächster Schritt
- -

## Fallstricke
- Titel-Compliance nur bei exakt `true` vertrauen — hier gegeben; Titel-Feld muss leer + `title_reason` leer sein.
- PR-Bodies dieses Workflows enthalten bisweilen Umlaute/Anführungszeichen; JSON mit jq validieren (geschehen, jq OK).
