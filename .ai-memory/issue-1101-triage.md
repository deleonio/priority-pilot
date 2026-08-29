# Issue 1101 — Triage (Re-Triage nach #1098-Merge), Stand 2026-08-29T03:23:31Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Block vorhanden (stand=2026-08-28T18:02:05Z) → Re-Triage-Pfad; genau 1 Delta-Kommentar (my-github-action-bot 2026-08-29T03:16:13Z: „Vorgänger #1098 gemergt, alle Blocker aufgelöst → Neu-Analyse angestoßen"). Analyse-Block komplett neu geschrieben (alle 4 offenen Fragen geklärt, 🟡→🟢), Routing-Tabelle neu (ux/spec = nein weil bereits durchlaufen), Labels `ai:needs-analyse` entfernt, `ai:needs-impl` gesetzt (Endstand verifiziert: ai:needs-impl + ai:analysed). Kein Ping-Kommentar, kein Titel-/Body-Copyedit („Adresse Interval" unangetastet — nicht substantiell falsch). Kein Auto-Close: `server/src/logics/geo-background-job.ts` existiert auf main nicht (ls-Beleg).

## Erledigt
- Trigger geprüft: KI-ANALYSE-Block ab stand; Delta = nur Bot-Kommentar (Qualitäts-Kommentar 17:52:10Z liegt VOR stand, ignoriert).
- `.ai-memory/issue-1101-spec.md` nachgelesen (war im Kontext-Deckel übersprungen): Spec-Phase lief bereits — rote Tests `1d069356` auf `ai/harness/1101`, Draft-PR **#1102** (OPEN, isDraft=true verifiziert).
- #1098-Lieferumfang verifiziert: `server/src/models/user.ts:16-18` (`displayDistanceKm`, `alarmDistanceKm`, `intervalMinutes`), `GEO_CONFIG_DEFAULTS` in `server/src/express/routes/geoConfig.ts:57` (5 km / 1 km / 5 min; Validierung Z.121), Settings-UI `frontend/src/components/SettingsPage.tsx`.
- Positions-Store geprüft: Koordinaten nur auf Task/Series (`server/src/models/task.ts:40-41`, `series.ts:38-39`), NICHT auf User → Positionsquelle bleibt Impl-Entscheid über injizierte `positions`.
- Neuer Analyse-Block + Routing-Tabelle via `.ai-memory/issue-1101-{block,routing,new}.md` + `gh issue edit --body-file` in den Body; alle 6 Marker (ANALYSE/UX/routing × START/END) im Ergebnis je 1× in richtiger Reihenfolge verifiziert.

## Relevante Stellen
- `server/src/models/user.ts:16-18` — Geo-Settings-Lesequelle für den Job (AK1/AK2).
- `server/src/express/routes/geoConfig.ts:57,99-101,121` — `GEO_CONFIG_DEFAULTS` + Validierungsgrenzen (alarmDistanceKm ∈ [1, displayDistanceKm], intervalMinutes ∈ [1, 60]).
- `server/src/logics/geo-background-job.ts` — fehlt noch auf main; Vertrag steht in `docs/spec/issue-1101.md`, rote Tests in `server/src/logics/geo-background-job.test.ts` (Branch `ai/harness/1101`, PR #1102).
- `server/src/logics/dueTaskReminders.ts` — Implementierungsmuster (collect → NotificationLog-Dedup → sendPushToUser, Aggregation).
- `server/src/logics/push.ts:19-26,56` — Payload-Vertrag `{title, body?, url?}` + `sendPushToUser`.
- `server/src/express/routes/tasks.ts:336` — `haversineKm`.
- `server/index.ts:210` — `startScheduler`-Eintrag (Verdrahtung).

## Annahmen
- Alle 4 offenen Fragen als geklärt bewertet: Q1 globaler Job + injizierte Positionen (Spec-Vertrag), Q2 PushSubscription-Modell existiert, Q3 Aggregation (tag-Coalescing erzwingt), Q4 #1098 gemergt. Positionsanbindung = technische Impl-Entscheid, keine Produktfrage → kein needs-human.
- ux/spec in der Routing-Tabelle auf `nein` gesetzt, weil beide Phasen bereits Outputs geliefert haben (KI-UX-Block im Body; Spec + Draft-PR #1102) — Präzedenz #1090.
- Impl/Effort unverändert aus der Erst-Analyse übernommen (opus/high, review sonnet/high).

## Verworfen
- needs-human wegen fehlendem Positions-Store — Spec-Seam (`positions` injiziert) + Issue-Text („Position wird clientseitig alle 5 Minuten ermittelt") machen es zurImpl-Entscheidung ohne Produktfrage.
- Titeländerung („Adresse Interval") — unpräzise, aber nicht substantiell falsch; pro-forma-Edit verboten.
- Erneuter Spec-Lauf — Vertrag durch #1098 nicht berührt (Seam antizipierte den Merge); Spec-Notiz sagt explizit „Verdrahtung der Impl-Phase überlassen".
- MEMORY.md-Eintrag — kein neuer Fehler, Kriterium nicht erfüllt.

## Offen
- Wegwerf-Dateien in `.ai-memory/` NICHT committen: `issue-1101-triage-input.json`, `issue-1101-triage-body.md`, `issue-1101-block.md`, `issue-1101-routing.md`, `issue-1101-new.md`. Nur `issue-1101-triage.md` (diese Datei) ist die Phasen-Notiz.

## Nächster Schritt
- Impl-Phase (Label `ai:needs-impl` gesetzt): Draft-PR #1102 aufgreifen, `geo-background-job.ts` nach Spec-Vertrag bauen (rote Tests grün), Scheduler-Eintrag + Positionsverdrahtung, Geo-Settings aus `User`-Modell lesen.

## Fallstricke
- s. `issue-1101-spec.md` Fallstricke (tag-Coalescing → Aggregation Pflicht; NotificationLog-Unique-Key Task+Fenster; Dedup nur bei sent>0 loggen; Tasks ohne Koordinaten aussortieren) — unverändert gültig.
- Impl muss Branch `ai/harness/1101` fortführen (Commit `1d069356` dort), nicht von main neu aufsetzen.
- AK3-Wortlaut wurde auf „genau eine aggregierte Push je User/Lauf" geändert — Einzel-Push-Tests wären damit bewusst falsch.
