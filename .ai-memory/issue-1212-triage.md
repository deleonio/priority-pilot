# Issue 1212 — Triage (Phase 1), Stand 2026-09-04T05:55:06Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar; einziger Kommentar = github-actions-Qualitätscheck `<!-- ai-quality -->` „bereit für Analyse", keine Entscheidungen). Analyse-Block + Routing-Tabelle als Harness-Kommentar erstellt (issuecomment 5536351305), Labels: `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt (Endstand verifiziert). Kein Ping-Kommentar, kein Titel-Edit („Gruppenmitglieder über Nutzersuche einladen und Mitgliedschaft pflegen" — präzise), kein Body-Edit, kein Split (ein AK-Satz = Einladungsfluss end-to-end, Präzedenz #1083/#1098). Kein Auto-Close: `server/src/models/groupInvitation.ts` existiert nicht, kein `users/search` im Code.

## Erledigt
- Issue geladen, Trigger geprüft, Code-Recherche: `server/src/express/routes/groups.ts` (komplett gelesen — #1211-Gruppen-CRUD live), `server/src/models/{group,groupMember}.ts`, `server/src/models/index.ts` (Registrierungsmuster), Tests `server/src/express/groups.api.test.ts` + `groups-dataisolation.test.ts` existieren, E2E `frontend/e2e/groups.spec.ts` existiert, `grep users/search` = 0 Treffer, Frontend `GroupsSection.tsx` (148 Z.)/`GroupFormDialog.tsx`/`GroupDeleteDialog.tsx` vorhanden.
- Harness-Kommentar per `gh issue comment --body-file .ai-memory/issue-1212-comment.md` erstellt; Marker-Landing verifiziert (1 Harness-Kommentar).

## Relevante Stellen
- `server/src/express/routes/groups.ts:66-77` — `findMembership(userId, groupId)` = Sichtbarkeitsschicht (fremde Gruppe → 404); Basis für alle neuen :id-Routen.
- `server/src/express/routes/groups.ts:29-40` — `resolveGeoUser`-Nutzer-Auflösung + 401-Muster; `toDto`-Muster für neue DTOs.
- `server/src/models/groupMember.ts` — Composite-PK-Muster (groupId+userId) für `groupInvitation.ts` (dort: eigenes `id` + Unique-Constraints je nach Spec-Entscheidung zu AK3).
- `server/src/models/index.ts:13-14,76-77` — Import + Export-Registrierung; neues GroupInvitation dort ergänzen.
- `server/src/express/index.ts:15,232` — `groupsRouter`-Registrierung; neuer `usersRouter` analog.
- `openapi.yml:1142-1252` — bestehende /groups-Pfade (GroupDto, GroupUpdate); 7 neue Pfade laut Issue ergänzen.
- `frontend/src/components/GroupsSection.tsx` — Gruppen-UI der Einstellungen; Gruppendetail + Mitgliederliste + Einladungs-UI kommen hierher; Annehmen/Ablehnen-Ansicht neu.
- `server/src/models/user.ts:11,13` — `email`, `displayName` (Default: E-Mail) — Basis für Usersuche (Op/where clause; nur id+displayName raus).

## Annahmen
- 404/403-Vertrag wie in den AKs: Einladungs-DELETE-Member unterscheidet sich bewusst vom #1211-PATCH/DELETE (dort 404 für Nicht-Admins) — im Analyse-Block als Randbedingung verankert.
- Offene Detailfragen (Einladen eines bestehenden Mitglieds; Re-Invite nach declined; exakte Form des Selbst-Austritts) sind Spec-Entscheidungen, keine Produktfragen → kein needs-human; Empfehlung im Block notiert.
- `sequelize.sync()` erzeugt `group_invitations` (Repo ohne Migrations-Setup) — so im Issue vorgegeben.
- Routing: ux ja/sonnet/medium (zwei neue UI-Flächen), spec ja/sonnet/medium, impl ja/opus/high (größer als #1083: neues Modell + 7 Endpunkte + 2 UI-Flächen), review ja/sonnet/high (Security-Fläche Nutzersuche/Dataisolation).

## Verworfen
- Split Server/Frontend — ein zusammenhängender AK-Satz, API-Vertrag Teil desselben Features (Präzedenz #1083/#1098).
- Titel-/Body-Copyedit — Issue präzise und valide (Qualitäts-Check grün).
- MEMORY.md-Eintrag — kein neuer Fehler/Experience-Kriterium erfüllt.

## Offen
- `.ai-memory/issue-1212-comment.md` ist Wegwerf-Artefakt (Kommentar-Body) — NICHT committen; nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- UX-Phase (Label `ai:needs-ux-ui` gesetzt): Gruppendetail mit Mitgliederliste/Einladungen, Ansicht empfangene Einladungen, Nutzersuche-Interaktion (Mobile-First 375px, AK12).

## Fallstricke
- AK4 verlangt 403 für Nicht-Admin-Mitglied + 404 für Nicht-Mitglied — NICHT das #1211-Muster (dort einheitlich 404) blind kopieren.
- Usersuche: E-Mail nur Volltreffer, nie im DTO; displayName-Suche ab 3 Zeichen; 0 Treffer = 200 + [].
- `displayName` fällt per Default auf die E-Mail zurück (user.ts) — Suche nach „E-Mail-Fragment" kann trotzdem displayName-Treffer liefern, das ist KEIN Leak.
- Letzter-Admin-Guard (AK10) muss bei DELETE prüfen, ob nach Entfernung noch ein Admin-Mitglied bleibt (Count über role='admin').
- E2E-375px-Kriterium per scrollWidth <= innerWidth (AK12), Bounding-Box- statt overflow-Checks (MEMORY 2026-08-24).
- Soft-Deadline des Laufs (1788500966) war beim Schreiben bereits überschritten — Phasen-Notiz direkt nachgeholt.
