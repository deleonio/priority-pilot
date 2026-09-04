# Issue 1211 / PR 1214 — Review (Kreuzverhör Runde 1 + Fixup-Nachweis Runde 2), Stand 2026-09-04

**ERGEBNIS Runde 2: VERDICT reviewed 🟢.** `<!-- ai-review -->`-Marker vorhanden → Fixup-Nachweis-Modus. Claim-Zeile #1 (`80053f2d`) gegen den Fixup-Diff verifiziert: PATCH validiert/übernimmt `name`/`description` nur bei Anwesenheit, abwesende Felder unverändert, vorhandener ungültiger Name bleibt 400; 2 Server-Tests + e2e-Edit-Schritt wie behauptet; keine neuen Probleme (übrige Post-Review-Commits b5189616/969fc393 nur .ai-memory). Sammelkommentar IC_kwDONloM188AAAABSfbYGg auf reviewed 🟢 aktualisiert (Finding #1 in Behobene-Tabelle, Nummern/Nits unverändert).

**Ergebnis Runde 1: needs-fixup** (1 Blocker, s. Erledigt). Titel auf `feat(frontend): add groups tab with CRUD, roles and delete confirmation` (71 Zeichen, CC-konform) konventionalisiert.

## Erledigt
- Modus bestimmt (Marker-Suche leer), Diff komplett gelesen (23 Dateien, +1614/−3), AKs aus Issue-1211-Harness-Kommentar geladen.
- **Blocker #1 gefunden:** `server/src/express/routes/groups.ts:156` — PATCH verlangt `name` zwingend (`validateName(body.name)` → 400 bei Abwesenheit), obwohl `openapi.yml` GroupUpdate „alle Felder optional / abwesende Felder bleiben unverändert“ deklariert und `frontend/src/components/GroupFormDialog.tsx:60-66` im Edit nur geänderte Felder sendet → Beschreibungs-only-Edit → 400. e2e testet den Edit-Pfad nicht (deshalb unentdeckt). Fix-Vorschlag im Inline-Kommentar: Server validiert name nur bei Anwesenheit, sonst Bestehenden behalten; + Test „PATCH nur description → 200, Name unverändert“.
- 4 Nits (nicht blockierend) im Sammelkommentar: N+1 memberCount in toDto (`groups.ts:44`), findMembership 2 Queries (`:58`), GroupsSection Array.isArray-Guard für Mocks (`GroupsSection.tsx:64`), GET /groups ohne `order`.
- requireAuth-Mount verifiziert (`express/index.ts:199` global, Router bei :230), sequelize.sync-Ansatz vom Spec abgedeckt, Spec-Test-Anpassungen (7 Stück) im PR-Body begründet und nur mechanisch — akzeptiert.
- Titel-Gate: PR-Titel war deutsch ohne type/scope → via `gh pr edit` umbenannt.

## Relevante Stellen
- `server/src/express/routes/groups.ts:75,156` — validateName-Aufrufe (POST ok da GroupInput name required; PATCH der Blocker).
- `frontend/src/components/GroupFormDialog.tsx:60-66` — diff-only groupUpdate-Bau (Trigger des Bugs).
- `.ai-memory/issue-1214-review-body.json` / `-comment.md` — gepostete Artefakte (Wegwerf, nicht committen).

## Annahmen
- CI e2e/verify pending zum Review-Zeitpunkt — Pipeline-Gate prüft Greensignal selbst (Skill: nicht 🟢 bei rot; needs-fixup unabhängig davon).
- Test-Aussagen (793 Server-Tests, 5/5 e2e) laut PR-Body, nicht lokal nachgefahren (Zeitnot) — plausibel, da pre-commit-Hook lief.

## Verworfen
- AK-Abdeckungsmängel-Befund — AK1–AK9 sind getestet (api/dataisolation/e2e-Dateien im Diff gelesen).
- Test-Pflege-Bedarf-Befund — die 7 Spec-Test-Änderungen sind begründet und rein mechanisch (error→message-Vertrag #1130, Locator-Technik), keine Abschwächung.
- MEMORY.md-Eintrag — Streitfall openapi-optional-vs-Server-required ist issue-spezifisch, Aufnahmekriterium (streng) nicht erfüllt.

## Offen
- -

## Nächster Schritt
- -

### Runde 2 (Fixup-Nachweis) — Erledigt
- Modus per Marker-Suche bestimmt (ai-review-Kommentar IC_kwDONloM188AAAABSfbYGg, updatedAt 2026-09-04T04:58:32Z); ai-fixup-decisions-Kommentar als Claim-Checkliste geladen (1 Zeile: #1 via `80053f2d`).
- Fixup-Diff `80053f2d` vollständig gelesen: `server/src/express/routes/groups.ts:156-173` (changes-Objekt, Anwesenheits-Validierung), `server/src/express/groups.api.test.ts:88-124` (2 Tests), `frontend/e2e/groups.spec.ts:86-105` (Edit-Schritt AK6), `.ai-memory/issue-1211-fixup.md`. Gate-Belege aus der Fixup-Notiz übernommen (274/0 Server-Tests, e2e 6 passed).
- Sammelkommentar per GraphQL updateIssueComment auf 🟢 gestellt (Review-Typ: Fixup-Nachweis); Artefakt `.ai-memory/issue-1214-review-comment.md` (Wegwerf, nicht committen).

## Fallstricke
- Beim Fix nicht den Frontend-Diff-only-Versand „reparieren“, indem immer alles gesendet wird — der openapi-Vertrag (optional) ist die Norm; der Server ist die Abweichung.
- Finding-Nummer #1 und die Nit-Liste im Sammelkommentar sind stabil — in Runde 2 nur abhaken, nicht umbenennen.
