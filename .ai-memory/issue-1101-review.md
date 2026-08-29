# Issue 1101 — Review (Kreuzverhör PR #1102), Stand 2026-08-29T04:02Z

**ERGEBNIS: VERDICT needs-fixup, Ampel 🔴→🟡 (5 Findings F1–F5).** Review-ID 5056826627, Sammelkommentar `5460229838` (erster `<!-- ai-review -->`), Titel per TITLE GATE auf `feat(server): notify users about nearby tasks via push (#1101)` umbenannt (vorher „Adresse Interval (#1101)"). CI: `verify` = FAILURE (Log-Zugriff verweigert, Ursache ungeklärt — Fixup muss ihn grün machen), e2e (1–4) grün, review = pending.

## Erledigt
- MODE bestimmt: Marker `<!-- ai-review -->` fehlte → Kreuzverhör; `closingIssuesReferences` = [#1101] → AKs aus dem KI-ANALYSE-Block (stand=2026-08-29T03:23:31Z).
- Kompletten Diff gelesen (13 Dateien; `.ai-memory/*` ausgenommen) + Neighborhood-Research an Haiku-Subagent delegiert (Intervall-Konfigurierbarkeit, Hook-Instanzen, `resolveGeoUser`, Test-Coverage, NotificationLog-Retention, `PushSender`-Signatur).
- 5 Findings als ein gebündeltes Review (event=COMMENT) mit Inline-Ankern gepostet; Sammelkommentar mit Footer `Review-Typ: Kreuzverhör`, `Updated: 2026-08-29`.

## Relevante Stellen
- `server/src/express/routes/geoConfig.ts:144` — F1: `NaN` fällt durch die Bereichsprüfung (`NaN < -90` ist false) → 400 für „keine Zahl" unerreichbar; `401` fehlt in openapi.
- `server/src/logics/geo-background-job.ts:19,86,113` — F2 Dedup-Fenster fest 5 min statt `User.intervalMinutes`; F3 keine Absicherung gegen parallele Läufe (read-before-write auf NotificationLog); F4 `url:'/'` im Aggregationsfall (AK5).
- `frontend/src/lib/useGeolocation.ts:230-237` — neue Positionsmelde-Effekt; Hook läuft als 3 Instanzen (Footer/NearbyCard/SettingsPage) → F3-Race real.
- `server/src/logics/geo-config.test.ts` (nur GET/PUT, Z.92-129) + `useGeolocation.test.ts` — F5: neuer Endpunkt und neuer Effekt ungetestet.

## Annahmen
- Client-getriggerter Job statt Scheduler (`server/index.ts` unberührt) gilt als akzeptierte Impl-Entscheid — Analyse-Block nennt „Positionsmeldung/Trigger des Clients" ausdrücklich als Verdrahtungsweg.
- `verify`-Failure ist im PR-Code begründet (nicht Infrastruktur) — nicht verifizierbar, Log-Download scheiterte.

## Verworfen
- needs-human — alle Findings sind technisch entscheidbar, keine Produktfrage.
- Eigenes Nachfahren des `verify`-Logs — Job-Log-API verweigerte den Zugriff (rc=1, 0 B); Zeitbudget.
- Anmerkung zu `dedupeKeyFor`-Epochen-Bucket — mit sentAt-Fenster konsistent (kein echter Fehler).

## Offen
- `verify` rot: Ursache unbekannt (Log-Zugriff `gh api .../jobs/99047935730/logs` → rc 1, leer).

## Nächster Schritt
- Fixup: F1 NaN-Check + openapi 401, F2 `intervalMinutes` als Fenster (Query + dedupeKey), F3 Transaktion/Serialisierung, F4 Deep-Link auf nächste Aufgabe + Multi-Task-Test, F5 Route-/Hook-Tests; danach `verify` grün ziehen. Findings-Nummern F1–F5 bleiben stabil.

## Fallstricke
- Review-Kommentar-Anker: Pfade müssen im PR-Diff liegen (`geo-config.test.ts` ist nicht im Diff → 422 „Path could not be resolved"); stattdessen `geo-background-job.test.ts:12` ankern.
- Zeilen-Anker für neue Dateien: File-Zeile = Diff-Zeile − (Diffkörper-Start − 1) rechnen, sonst verankert man daneben.
- `gh pr comment` hat kein `--jq`, `gh pr edit` auch nicht — IDs über die Rückgabe-URL bzw. ohne jq abfragen.
- `gh pr diff` akzeptiert nur 1 Argument (keine Pfadliste) → ganz in Datei umleiten und mit awk extrahieren.
