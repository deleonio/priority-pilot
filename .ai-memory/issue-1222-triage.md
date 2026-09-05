# Issue 1222 — Triage (Phase 1), Stand 2026-09-05T20:17:52Z

**ERGEBNIS: VERDICT spec-ready, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar, kein ai-triage-decision; einziger Kommentar = github-actions-Qualitätscheck, keine Entscheidungen). Analyse-Block + Routing-Tabelle als Harness-Kommentar ERSTELLT (HID leer → create), Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt (ux=ja, UI-Relevanz: Formular + Serien-Tab). Kein Ping, kein Titel-/Body-Edit, kein Split (Server+Frontend = ein zusammenhängender AK-Satz, Präzedenz #1083/#1098), kein Auto-Close (`series.createdById` existiert nicht im Modell).

## Erledigt
- Issue + sämtliche Kommentare geladen; #1213-Vorbild im Code verifiziert (nicht nur behauptet).
- Analyse-Block (stand=2026-09-05T20:17:52Z) + Routing-Tabelle via `gh issue comment --body-file` erstellt; Labels gesetzt.

## Relevante Stellen
- `server/src/express/routes/tasks.ts:460-489` — #1213-Empfänger-Muster: optionales `userId` im Body, Ganzzahl-Validierung, GroupMember-Schnittmengen-Check → 403, `createdById: requesterId`. 1:1 auf POST /series übertragbar.
- `server/src/express/routes/tasks.ts:164-169` — `taskReadScope` (`{userId} OR {createdById}`) = Vorlage für Serien-Lese-Scope; `loadUserNames`/`forUserId`/`forUserName` (tasks.ts:88-146) für AK5-Kennzeichen.
- `server/src/express/routes/series.ts:342` — POST setzt `userId: getUserId(req)`; `:316-320` GET mit `ownerScope` (nur eigene); PATCH/DELETE/`/:id/generate` über `findSeriesWithPillars`+`ownerScope` (:294) → Ersteller erhält dort natürlich 404 (AK6).
- `server/src/logics/series.ts:154` — **Kernfalle**: Instanz-`userId = options.userId ?? null`, NICHT `series.userId`. `:185` materializeDueSeries gibt Caller-userId weiter; Route `/series/:id/generate` (series.ts:544) gibt KEINE userId → für Empfänger-Serien müsste der Default auf `series.userId` fallen (AK4).
- `server/src/models/series.ts` — `createdById` als nullable INTEGER ergänzen (Muster `userId`-Spalte, :199-205 im init-Block).
- `server/src/logics/migrate.ts:481-496` — `migrateTaskCreatedById` = exakte Vorlage für `migrateSeriesCreatedById` (PRAGMA table_info, idempotent, kein Default nötig); Registrierung in `server/src/index.ts:136-140`.
- `frontend/src/components/TaskForm.tsx:921` — Sichtbarkeits-Bedingung `!isEdit && !isSeriesMode && recipientVisible` → `!isSeriesMode` streichen; `:668-682` seriesCreate-Payload um `userId` ergänzen (Muster `:711-714` Task-Zweig). Empfänger-Maschinerie (buildRecipientOptions, recipientId, ownUserId) existiert vollständig.
- `frontend/src/components/SeriesTab.tsx:143-152` — series-tree-row: „Für: Name"-Hinweis; Bearbeiten/Löschen-Toolbar für fremde Serien ausblenden (sonst 404-Sackgasse).
- `openapi.yml:2662/2745` — Schemas `Series`/`SeriesCreate`: `userId` (optional), `createdById`, `forUserId`, `forUserName`; danach `pnpm build:api` (generiert `server/src/api.d.ts` + client-Typen, sonst 12 knip-Fehler, MEMORY 2026-09-05).
- Tests: `server/src/express/tasks-created-by.test.ts` = Spec-Vorlage; Serie-Heimaten `series.api.test.ts`, `series-dataisolation.test.ts`, `series-generate-all-auth.test.ts`, `series.cascade.test.ts`; Frontend `TaskForm.test.tsx`, `SeriesTab.test.tsx`; e2e neu `issue-1222-series-recipient.spec.ts` (+ `series-tab.spec.ts`).

## Annahmen
- „gekennzeichnet als für ein anderes Mitglied angelegt" = `forUserId`/`forUserName` im Series-DTO wie beim Task-DTO #1213 (Soll-Text nennt Name → forUserName nötig).
- Ersteller sieht fremde Serien NUR in GET /series (Liste); GET /series/:id, PATCH, DELETE, generate bleiben ownerScope → 404 für Ersteller (AK-Konform; kein separates Lese-Recht auf Einzelserie gefordert).
- Keine Push-Benachrichtigung an den Empfänger einer neuen Serie gefordert (#1224-Äquivalent nicht im AK-Satz → nicht Scope; im Block als Abgrenzung vermerkt).

## Verworfen
- Titel-/Body-Copyedit — Titel „Aufgaben-Serie für ein Gruppenmitglied anlegen" trifft exakt; Body von hochwertiger Struktur (alle 10 AKs bereits prüfbar formuliert).
- Split — ein PR (Datenschicht+Route+Formular gehören zum selben Vertrag, DTO-Änderung durchgängig).
- Subagent-Recherche (`recherche`-Rolle) — laut MEMORY 2026-09-05 in dieser Umgebung defekt (API 400), Direktrecherche war billiger.

## Offen
- Wegwerf-Artefakte in `.ai-memory/`, NICHT committen: `issue-1222-body.md` (Issue-Body-Spiegel), `issue-1222-harness-comment.md` (gesendeter Kommentar). Nur `issue-1222-triage.md` ist die Phasen-Notiz.

## Nächster Schritt
- UX-Phase (`ai:needs-ux-ui` gesetzt): Empfängerauswahl im Serie-Modus (Position im Formular, Vorbelegung, Reihenfolge hinter dem Modus-Schalter) + „Für: Name"-Darstellung im Serien-Tab + ausgeblendete Aktionen für fremde Serien bewerten.

## Fallstricke
- **logics/series.ts:154 ist der Dreh-und-Angel-Punkt:** Instanz-userId muss auf `series.userId` defaulten (Aufrufstellen :185 + series.ts:544), sonst erzeugt `/series/:id/generate` für Empfänger-Serien userId-null-Instanzen und AK4 bricht bei generate-all nicht, aber beim Einzel-Generate.
- AK10 (375px): `scrollWidth <= innerWidth` ist laut MEMORY 2026-08-24 in dieser App strukturell immer grün (App-Shell clippt overflow-x:hidden) → e2e stattdessen Bounding-Box (x+width <= viewportWidth) auf Empfänger-Select und Für-Hinweis, Viewport 320px mitprüfen.
- migrate: Registrierung in index.ts VOR `sequelize.sync()`; frische DB = No-op, Bestand = ALTER TABLE. `migrateSeriesColumns` existiert schon für andere Spalten — nicht duplizieren, eigene Funktion nach tasks-createdById-Muster.
- openapi zuerst ändern + `pnpm build:api`, sonst Typfehler in TaskForm (SeriesCreate ohne userId) und knip.
- Serie-Bearbeitung im Formular (seriesEdit) muss die Empfängerauswahl weiter AUSBLenden (nur Anlege-Modus, wie Task-Zweig `!isEdit`).
- GET /series Lese-Scope-Erweiterung darf `undefined`-userId (Pass-Through) nicht brechen (Muster taskReadScope handhabt das).
