# Issue 1249 — Triage (Phase 1), Stand 2026-09-06T10:09:23Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar; einziger Kommentar = github-actions-Qualitätscheck 2026-09-06T10:00:05Z, keine Entscheidung). Analyse-Block + Routing-Tabelle als neuer Harness-Kommentar erstellt (issuecomment-5558530011), Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-spec` gesetzt (ux=nein → direkt Spec). Kein Ping, Titel unangetastet, kein Auto-Close (Bug am Code verifiziert vorhanden).

## Erledigt
- Issue + alle Kommentare geladen (Initial-Triage: 1 Bot-Kommentar, irrelevant).
- Alle Behauptungen des Issues am Code verifiziert (s. Relevante Stellen).
- Harness-Kommentar per `.ai-memory/issue-1249-block.md` + `gh issue comment --body-file` erstellt; Label-Endstand verifiziert: `bug`, `ai:needs-spec`, `ai:analysed`.

## Relevante Stellen
- `server/src/express/routes/tasks.ts:454` — POST /tasks: `arePillarsExistent(pillarIds, userId)` mit `userId = getUserId(req)` (Ersteller); `:492` Anlage mit `userId: recipientId ?? userId ?? null` (Empfänger #1213) → Fehlbezug.
- `server/src/express/routes/tasks.ts:555` — PATCH /tasks prüft gegen Aufrufer, Task aber via `findOwnTask` (:538) owner-scoped geladen → bereits korrekt, NICHT anfassen.
- `server/src/express/routes/series.ts:395` (POST) und `:499` (PATCH) — `arePillarsExistent(pillarIds)` ganz ohne Kontobezug; POST-Anlage `:432` mit `recipientId ?? getUserId(req) ?? null` (#1222); PATCH-Serie via `ownerScope` geladen, Fix soll gegen `series.userId` prüfen (AK4).
- `server/src/logics/pillarContributions.ts:70` — `arePillarsExistent(pillarIds, userId?)`: optionaler Parameter, ohne ihn GLOBALER Check (Abwärtskompatibilitäts-Fallback) → AK5 macht ihn pflicht.
- `server/src/models/pillar.ts:66` — Unique-Index `pillars_name_user_id` auf (`name`, `userId`): gleiche fachliche Säule = andere Id je Konto.
- `server/src/express/groups-tasks.api.test.ts:58` — `seedGroup` (Alice/BOB/ANNA/CAROL + GroupMember): Seed-Muster für Zwei-Konto-Tests.
- `server/src/express/pillar-per-user-seed.test.ts`, `pillars-dataisolation.test.ts` — Vorbilder nutzer-eigene Säulen / Dataisolation.
- `server/src/logics/pillarContributions.test.ts` — einziger bisheriger Testort von `arePillarsExistent`; für AK5 anpassen.
- `frontend/src/components/QuickCaptureModal.tsx:131` — KolAlert-Fehler-State zeigt 400-Texte → keine UI-Änderung nötig (ux=nein begründet).

## Annahmen
- Reihenfolge 403 (Empfänger ohne geteilte Gruppe) vor 400 (fremde Säule) bleibt erhalten — bestehendes #1213/#1222-Verhalten, im Block als Randbedingung verankert.
- AK7 („auffindbar") minimal als read-only SQL im PR umgesetzt, keine automatische Bereinigung — Autor hat Bereinigungsumfang ausdrücklich der Umsetzung überlassen; Vorschlag im Block dokumentiert.
- Routing sonnet/medium (spec), sonnet/high (impl+review) — konsistent mit Security/Dataisolation-Vorgänger-Tickets.

## Verworfen
- UX-Lauf — reine Server-Validierung, Fehleranzeige bereits vorhanden.
- Split — ein serverseitiger PR (3 Dateien + Tests).
- Titel-/Body-Copyedit — Titel treffend, Body präzise; Body-Edit verboten (ADR 0009).
- MEMORY.md-Eintrag — kein neuer Fehler/Umweg, Kriterium nicht erfüllt.

## Offen
- `.ai-memory/issue-1249-block.md` ist Wegwerf-Artefakt (Kommentar-Body), NICHT committen; nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Spec-Phase (Label `ai:needs-spec` gesetzt): rote API-Tests in `server/src/express/pillar-ownership.test.ts` (AK1–AK4, AK6) + `pillarContributions.test.ts`-Anpassung (AK5); danach Impl: Prüfung gegen `recipientId ?? userId` (POST /tasks), `series.userId` (PATCH) bzw. Eigentümer (POST /series), Parameter pflicht.

## Fallstricke
- POST /tasks: Säulen-Check steht VOR der Empfänger-Auflösung (~:469) — Prüfung muss NACH `recipientId`-Auflösung gegen `recipientId ?? userId` laufen, sonst bleibt der Bug; 403-Pfad unverändert davor.
- `arePillarsExistent` auf Pflicht umstellen erfasst ALLE 4 Callsites (tasks :454/:555, series :395/:499) — tsc deckt fehlende Stellen auf, keine vergessen.
- Zwei gleichnamige Säulen je Konto per Modell-Seed anlegen (Unique-Index verhindert nur Gleichheit innerhalb EINES Kontos, nicht kontouebergriff).
- `validation.pillars !== undefined`-Guard (leere Liste = trivial true) beibehalten — `[]` muss weiter erlaubt sein.
