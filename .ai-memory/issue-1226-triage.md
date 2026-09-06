# Issue 1226 — Triage (Phase 1), Stand 2026-09-05T23:21:14Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar; einziger Kommentar = ai-quality-Bot 2026-09-04, keine Entscheidungen). Analyse-Block + Routing-Tabelle als neuer Harness-Kommentar angelegt, Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt (verifiziert). Kein Ping, kein Titel-/Body-Edit (ADR 0009), kein Split (Server+Frontend = ein zusammenhängender AK-Satz, ein PR, Präzedenz #1083), kein Auto-Close (kein InviteLink-Modell im Code).

## Erledigt
- Issue geladen, Trigger geprüft, Code-Recherche direkt selbst gefahren (MEMORY 2026-09-05: Subagent-Rollen fallen mit 400er aus).
- Harness-Kommentar erstellt via `.ai-memory/issue-1226-comment.md` (Wegwerf-Artefakt, NICHT committen) + `gh issue comment --body-file`; HID war leer (Neuanlage), Landing verifiziert (1 Marker, stand gesetzt).

## Relevante Stellen
- `server/src/express/routes/groups.ts` — Admin-Gate-403 + `findMembership` (Z. 72), Einladungs-Endpunkte Z. 265–350 als Muster für die 4 neuen; Issue will alle 4 dort.
- `server/src/express/index.ts:198,201` — `app.use(requireAuth)` bei 201; öffentlicher Teil-Router MUSS davor gemountet werden (Muster `/api/transit` :198) — Issue sagt das explizit.
- `server/src/models/groupInvitation.ts` — Muster für NEU `groupInviteLink.ts` (token unique, expiresAt, revokedAt); Registrierung in `server/src/models/index.ts`.
- `frontend/src/Root.tsx:145` — `/bahn`-Weige vor Auth-Gate = Muster für `/gruppen/beitreten`; returnTo-Pattern :109-113 (Token muss Login-Roundtrip überleben).
- `frontend/src/components/GroupDetail.tsx:151-183` — Bereich „Offene Einladungen"/`group-invite`: hier Link-Liste + Ungültig-Machen für Admins.
- `frontend/e2e/groups-invitations.spec.ts` — e2e-Muster: 2. Nutzer via `POST /auth/test-login`, eigener Context; 375px per Bounding-Box.
- `openapi.yml:1247-1499` — Gruppen-Pfade; Client-Typen (openapi-fetch) mitpflegen.

## Annahmen
- Routing-Tabelle (ux ja/sonnet/medium, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high) für Folgephasen bindend.
- „4 Endpunkte in groups.ts" = Datei; der öffentliche GET braucht trotzdem eigenen Export/Mount vor requireAuth (Detail-Entscheid der Impl).
- Edge-Fall „Redeem durch bereits anderweitig Mitglied Gewordenes" nicht im AK definiert → Spec-Entscheidung (im Block unter Randbedingungen vermerkt).

## Verworfen
- Titeländerung („Gruppe über einen Einladungslink beitreten") — trifft exakt, kein Edit.
- Split in Server-/Frontend-Sub-Issues — ein PR (Präzedenz #1083).
- MEMORY.md-Eintrag — kein neuer Fehler, Kriterium nicht erfüllt.

## Offen
- `.ai-memory/issue-1226-comment.md` = Wegwerf-Artefakt (Kommentar-Body), NICHT committen; nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- UX-Phase über `ai:needs-ux-ui` (gesetzt): Beitrittsseite `/gruppen/beitreten` + Admin-Link-Verwaltung in GroupDetail.

## Fallstricke
- GET /invite-links/{token} MUSS vor `requireAuth` (`express/index.ts:201`) hängen — sonst 401 vor der Anmeldung.
- Token aus `crypto.randomBytes` (AK1 nennt es explizit), nicht Math.random.
- 375px-AK per Bounding-Box prüfen, NICHT scrollWidth (App-Shell clippt overflow-x:hidden, MEMORY 2026-08-24).
- 410 für abgelaufen UND ungültig-gemacht; 404 nur unbekanntes Token.
- Redeem-409 nur für Zweit-Einlösen desselben Kontos — Mitgliedschafts-Check transaktional (Race mit #1212-Einladung beachten).
- OpenAPI/Client-Typen mitändern (Muster-Fallstricke #1098).
