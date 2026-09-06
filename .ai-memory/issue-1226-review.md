# Issue 1226 — Review (Phase 5), Stand 2026-09-06T00:52Z

**ERGEBNIS: VERDICT needs-fixup (🔴), 1. Runde Kreuzverhör.** Review 5123603060 gepostet (2 inline Blocker) + Sammelkommentar mit `<!-- ai-review -->` angelegt (neu — kein Marker vorhanden). PR-Titel wegen CC-Verstoß umbenannt: „feat(server): join a group via invite link (#1226)“.

## Erledigt
- MODE=CROSS-EXAMINATION (kein `<!-- ai-review -->`-Kommentar auf PR 1246). Closing-Issue #1226 vorhanden → AKs aus Harness-Kommentar (stand=2026-09-05T23:21:14Z, AK1–AK6).
- Diff gelesen (948 Zeilen, 12 Dateien): Nur Server-Teil. GroupJoinPage.tsx/Root.tsx-Weiche/GroupDetail-Link-Verwaltung/openapi.yml FEHLEN → AK5/AK6 unerfüllt.
- CI-Beleg: e2e Shard 1/4 (Run 34002056461, Job 101402569349) **2 failed** — `frontend/e2e/groups-invite-links.spec.ts:54` (AK5) + `:106` (AK6), „Gruppe beitreten“-Button nie sichtbar. verify/precheck grün.
- Finding 2: PR-Body behauptet GET-Listen-Route, GroupJoinPage, Root.tsx, GroupDetail, openapi-Pflege — nichts davon im Diff (Integrität). Beide Blocker = fixable.
- Nits: redeem-Check außerhalb der Transaktion (Muster `/invitations/:id/accept` groups.ts:400-410 prüft innen; Composite-PK (groupId,userId) verhindert Duplikate, Race → 500 statt 409).
- Positiv verifiziert: Spec-Tests zwischen Spec- (90612402) und Impl-Commit (edd82a5a) unverändert (`git diff` über beide Testdateien leer); TDD-Reihenfolge ok; `resolveGeoUser` = Bestandsmuster in groups.ts; Token 48 hex ≥ 32; 404/410 korrekt; Feldminimierung.

## Relevante Stellen
- `server/src/express/routes/inviteLinks.ts` — öffentlicher Router (GET+redeem), solide; einziger Nit bei Z.70-77.
- `server/src/express/routes/groups.ts:604-669` — POST/DELETE invite-links, Admin-Gates korrekt.
- `frontend/e2e/groups-invite-links.spec.ts:54,106` — rote AK5/AK6-Tests (Fixup-Ziel, NICHT abschwächen).

## Annahmen
- Fixup implementiert den Frontend-Vertrag aus `docs/spec/issue-1226.md` (Frontend-Vertrag: 4 Zustände inkl. 409-Info, Landung Gruppenansicht) — e2e-Tests bleiben unverändert.

## Verworfen
- Delegation an Subagents — MEMORY 2026-09-05: fallen mit API 400 aus; Recherche direkt gefahren.
- needs-human — keine Produktentscheidung offen; beide Findings fixable.
- Security-Finding gegen den öffentlichen GET — Token 192 bit, Feldminimierung beachtet, kein Befund.

## Offen
- Wegwerf-Artefakte im Working-Dir NICHT committen: `.ai-memory/issue-1226-review-{body,f1,f2,collected}.md`. Nur diese Datei (`issue-1226-review.md`) ist die Phasen-Notiz.

## Nächster Schritt
- Fixup-Runde: Frontend-Teil (AK5/AK6) + Body-Korrektur; danach Re-Review als FIXUP VERIFICATION (Marker `<!-- ai-review -->` existiert jetzt, F1/F2 stabil, Nit optional mitziehen).

## Fallstricke
- Titel-Gate: `false`-Tool existiert in dieser Umgebung nicht → Titel manuell geprüft (kein CC-Präfix) und per `gh pr edit --title` umbenannt.
- `.ai-memory/issue-1226-*.md` ist hier NICHT gitignore-gesichert (die Phasen-Notizen werden bewusst committed) — Wegwerf-Dateien also zwingend aus dem Commit lassen.
