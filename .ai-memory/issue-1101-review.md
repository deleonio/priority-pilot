# Issue 1101 — Review (PR #1102), Stand 2026-08-29T07:0xZ — Runde 2: Fixup-Nachweis

**ERGEBNIS: VERDICT reviewed, Ampel 🟢.** MODE = FIXUP VERIFICATION (Marker `<!-- ai-review -->` in Sammelkommentar `5460229838` gefunden, updatedAt 2026-08-29T04:05:06Z). Fixup-Commit `ab3b4021` (06:41:33Z) bearbeitet F1–F5; alle 5 als behoben abgehakt, `Behobene Anmerkungen`-Tabelle gefüllt, `Offene Findings` geleert, Footer `Review-Typ: Fixup-Nachweis`. Kein neuer Kommentar — PATCH auf ID 5460229838.

## Erledigt
- Delta-Review auf Commit `ab3b4021` beschränkt (6 Dateien, +227/−15); 2 memory-Commits davor ignorierbar.
- F1 ✅ `Number.isNaN(lat)||Number.isNaN(lon)` in `server/src/express/routes/geoConfig.ts:151` (`parseCoord` liefert für Nicht-Zahl/∞ zuverlässig NaN); 401 in `openapi.yml` (~Z.1136) dokumentiert; generierte `api.d.ts`/`schema.d.ts` sind NICHT im PR (gitignored → kein Drift).
- F2 ✅ `intervalMsFor()` (User.intervalMinutes, Default 5) steuert jetzt NotificationLog-Fenster UND `dedupeKeyFor`-Bucket; Test „F2: Dedup-Fenster folgt User.intervalMinutes (60 min)" prüft 10 min (kein 2. Push) und 61 min (2. Push).
- F3 ✅ In-Memory-Queue `runningUserPushes: Map<number, Promise<void>>`; `get`→`set` ohne dazwischenliegendes await → kein TOCTOU im Event-Loop; Test mit `Promise.all([run, run])` erzwingt Overlap → 1 Push.
- F4 ✅ `buildPayload` linkt per `reduce` die nächstgelegene Aufgabe; Multi-Task-Test erweitert um `payload.url === /tasks/{apotheke.id}` (Apotheke 0,33 km < Bäckerei 0,45 km).
- F5 ✅ `geo-config.test.ts`: 401, 3× NaN-400, 4× Range-400, 204+leerer Body; `useGeolocation.test.ts`: 2 Hook-Tests (meldet bei aktiviert, meldet nicht bei Default). Mock-Default `reportGeoPosition.mockResolvedValue(undefined)` behebt die 4 roten Bestands-Tests = Ursache des roten `verify` aus Runde 1.
- Zusätzlich umgesetzt: `userId`-Filter auf die NotificationLog-Abfrage (war „ergänzend" in F4).

## Relevante Stellen
- `server/src/logics/geo-background-job.ts:23` — Queue-Map; `:150-160` — processUserGroup + finally-Cleanup.
- `server/src/express/geo-config.test.ts:131-185` — neue Route-Testgruppe (#1101 F5/F1).
- `frontend/src/lib/useGeolocation.test.ts:9-26` — vi.hoisted-Mock mit Default-Auflösung (Kommentarblock #1101).
- CI beim Review-Zeitpunkt: `verify`/e2e(1–4) = pending (nicht rot), review = pending → Gate entscheidet ai:ready-to-merge.

## Annahmen
- Tests wurden NICHT lokal ausgeführt (kein node_modules im Runner-Sandbox, Server-Tests bräuchten DB/Redis); Grün-Behauptung stützt sich auf Diff-Logik + CI-Pending. Der Gate-Job ist die verbindliche Instanz.
- Queue-Drop-Verhalten (zweiter, überlappender Lauf verwirft seine Positionen statt zu mergen) als akzeptiert: Best-Effort-Fire-and-forget, erster Lauf pusht bereits; im Code kommentiert.

## Verworfen
- Eigenes Finding zur Validation-Reihenfolge (400 wird vor 401 geprüft → unauthentifizierter Caller sieht 400): rein kosmetisch, kein Fix-Bedarf.
- Eigenes Finding zum doppelten `User.findByPk` (`intervalMsFor` in collect + processUserGroup statt Feld an `GeoPushGroup`): Nit, als nicht-blockierenden Hinweis im Sammelkommentar vermerkt.
- Kritik am In-Memory-Queue (Prozess-Restart): im Code als akzeptiert dokumentiert; single-process-Scheduler macht es irrelevant.
- needs-human — keine Produktfrage aufgetreten.

## Offen
- `.ai-memory/issue-1101-review-comment.md` (Abruf des Sammelkommentars) = Wegwerf-Artefakt, NICHT committen.

## Nächster Schritt
- Merge-Gate: nach Grün von verify/e2e setzt der Workflow `ai:ready-to-merge`; keine weitere Review-Runde nötig.

## Fallstricke
- Erhält aus Runde 1: Review-Anker nur auf im-Diff-liegende Pfade; `gh pr diff` ohne Pfadargument; Diff-Zeile → File-Zeile umrechnen.
- `gh pr diff <n> --json` existiert nicht (rc 1, „cannot iterate over: null") — Commits/Files über `gh api repos/.../commits/<sha>` (`.files[].patch`) holen.
- Fixup-Verifikation: nur `commits[].committedDate > updatedAt` des Sammelkommentars lesen; memory-Commits (`memory: …`) überspringen.
