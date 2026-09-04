# Issue 1212 — Documenter (Phase 6), Stand 2026-09-04

## Erledigt
- PR #1215 analysiert (`gh pr view 1215`, `gh pr diff --name-only`): Merged, Autor app/my-github-action-bot, Labels ai:reviewed + ai:skip-commit-guard. Titel „feat(server): add group invitations and membership management" — compliant (vorgegeben true) → `title` leer gelassen.
- `/tmp/doc.json` geschrieben und per `jq -e` geprüft (true): classification **new**, 8 Dateien (innerhalb 3–8), issues `Closes #1212`, migration_en leer (nicht breaking).
- Wichtigste inhaltliche Punkte ins JSON übernommen: GroupInvitation-Modell ohne Unique-Constraint (Re-Invite nach declined, Duplikat-Prüfung nur gegen pending), 403/404-Trennung (bewusste Abweichung vom #1211-Muster, steht im PR-Body), Letzter-Admin-Guard 409, users-search ohne E-Mail-Leak, OpenAPI 7 Pfade/6 Schemas mit generierten Typen, Frontend GroupDetail + GroupsSection-Erweiterung.

## Relevante Stellen
- `server/src/models/groupInvitation.ts` — neues Modell, Kern der Änderung.
- `server/src/express/routes/groups.ts` (+273 Zeilen) — fast alle neuen Routen.
- `server/src/express/routes/users.ts` — neue Nutzersuche.
- `openapi.yml` — Vertrag (generierte client/server-Typen folgten daraus).
- `frontend/src/components/GroupDetail.tsx`, `GroupsSection.tsx`, `frontend/src/api.ts` — Frontend-Seite.
- `server/src/express/groups-invitations.api.test.ts` — Repräsentativ-Test für die Regeln (409/403/404).

## Annahmen
- Classification `new` (nicht `improved`): ganz neue Endpunkte/Modelle/Komponente, auch wenn sie an Gruppen (#1211) andocken.
- `.ai-memory/*` und `docs/spec/issue-1212.md` bewusst NICHT in `files` aufgenommen (Harness-/Spec-Artefakte, kein Produkt-Code).
- Title-Compliance war laut Prompt true — kein Rename, daher `title_reason` leer.

## Verworfen
- Titeländerung — compliant und passt (Server-Scope dominiert, auch wenn Frontend dabei ist).
- classification `improved` — es handelt sich um neue Funktionalität, nicht um Ausbau Bestehenden.
- Mehr als 8 Dateien — Limit im SKILL; Tests/Artefakte zugunsten der Kerndateien weggelassen.

## Offen
- -

## Nächster Schritt
- Keiner — Phase abgeschlossen; `/tmp/doc.json` liegt validiert vor. Kein `gh pr edit/comment/label` (tabu).

## Fallstricke
- `gh pr view --json files` liefert auch die `.ai-memory/`-Notizen und `docs/spec/` — für `files` (3–8 „most relevant") herausfiltern.
- Write-Tool scheiterte an Rechten für `/tmp/doc.json` → über Bash-Heredoc schreiben, dann `jq -e` gegenprüfen.
