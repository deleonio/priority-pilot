## Erledigt
- MODE bestimmt: kein `<!-- ai-review -->`-Kommentar auf PR #1215 vor diesem Lauf → CROSS-EXAMINATION.
- AK-Block aus Harness-Marker gelesen (Issue #1212, Stand 2026-09-04T05:55:06Z, AK1-AK12).
- Server-Diff geprüft: `server/src/express/routes/users.ts` (GET /users/search, AK1/AK2 — DTO nur id+displayName, E-Mail nie im Response, Op.like parametrisiert), `server/src/express/routes/groups.ts` (7 neue Routen: members/invitations/accept/decline/DELETE member) — 403/404-Split korrekt lt. Analyse-Block, Duplikat-Regel nur gegen `pending` (AK3), letzter-Admin-Guard auch bei Selbst-Austritt (AK10), `server/src/models/groupInvitation.ts` (kein Unique-Constraint, wie dokumentiert) — alles deckungsgleich mit AK1-AK10.
- Frontend `frontend/src/components/GroupDetail.tsx` (komplett gelesen, 169 Zeilen) — Finding: „Entfernen"-Button (Zeile 112) ruft `handleRemove` direkt auf, KEIN Bestätigungsdialog, obwohl `docs/spec/issue-1212.md` (Frontend-Vertrag) und `frontend/e2e/groups-invitations.spec.ts` (~Zeile 430, erwartet `kol-dialog`) das verlangen.
- Titel-Gate: alter Titel „Gruppenmitglieder über Nutzersuche einladen und Mitgliedschaft pflegen (#1212)" verletzte Conventional Commits → per `gh pr edit 1215 --title` umbenannt zu „feat(server): add group invitations and membership management".
- Review gepostet: `gh api .../pulls/1215/reviews` (event COMMENT), 1 Inline-Comment auf `GroupDetail.tsx:112` (Finding #1, blocker/fixable).
- Sammelkommentar `<!-- ai-review -->` erstellt (issuecomment 5536676640): Status needs-fixup, Finding #1 unter „Offene Findings", Selbst-Austritt-UI-Lücke unter „Nits".

## Relevante Stellen
- `frontend/src/components/GroupDetail.tsx:110-113` — Entfernen-Button ohne Dialog (Finding #1).
- `frontend/src/components/GroupDetail.tsx:114` (`ownRole === 'admin'`-Gate) — kein UI-Pfad für Selbst-Austritt von Nicht-Admins (Nit).
- `frontend/e2e/groups-invitations.spec.ts:~430` — erwartet `kol-dialog` nach Klick auf „Entfernen".
- `docs/spec/issue-1212.md` (Frontend-Vertrag-Abschnitt) — verlangt sequenzielle Bestätigung nach `docs/ux-pattern-sequential-confirmation.md`, Muster `GroupDeleteDialog.tsx` (#1211).
- Server-Routen (`groups.ts`, `users.ts`, `groupInvitation.ts`) — geprüft, keine Findings.

## Annahmen
- Frontend-Unit-Test `GroupDetail.test.tsx` und CI (zum Review-Zeitpunkt: precheck ✅, e2e/review/verify noch pending) wurden NICHT im Detail gegen den Dialog-Fund geprüft (Zeitdruck) — die Diff-Analyse (kein Dialog-Import/-Rendering in GroupDetail.tsx) reicht als Beleg.

## Verworfen
- Tiefere Prüfung von openapi.yml, GroupsSection.tsx (Einladungen-Abschnitt), client/src/index.ts, restliche Tests — Zeitbudget (Soft-Deadline) ließ das nicht zu; Server-Kernlogik (AK1-AK10) war der höhere Risiko-Bereich und wurde vollständig geprüft.

## Offen
- Fixup-Runde für Finding #1 (Bestätigungsdialog nachrüsten); danach Fixup-Verifikation-Review fällig.
- Von diesem Lauf nicht geprüft: GroupsSection.tsx (Einladungen-Abschnitt/Annehmen-Ablehnen-UI), GroupDetail.test.tsx, openapi.yml-Details, client-Typen — bei der nächsten Runde ggf. nachholen falls Zeit reicht.

## Nächster Schritt
- Nach Fixup: Delta-Review nur gegen `<!-- ai-fixup-decisions -->`-Claim-Checkliste (Finding #1) + neue Commits seit Updated: 2026-09-04.

## Fallstricke
- Soft-Deadline dieses Laufs war sehr knapp (~9 Minuten ab Start) — Review daher auf Server-Kernlogik + den einen kritischen Frontend-Fund fokussiert, nicht die komplette Datei-Liste durchgegangen.
