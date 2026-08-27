# Continue-Sweep — hängende Pipeline-Phasen fortführen

**Stand:** 2026-08-27

## Ziel

Stehengebliebene Pipeline-Workflows werden automatisch fortgesetzt: Alle 6 Stunden — jeweils 5 Minuten nach 0, 6, 12 und 18 Uhr Europe/Berlin — prüft der Sweep-Workflow `claude-continue-sweep.yml`, ob einer label-getriebenen Phase (01–06) ein Trigger-Label klebt, ohne dass ein Lauf existiert, und feuert das Trigger-Label dann neu.

## Hintergrund

Die Phase-Workflows (01-claude-triage … 06-claude-pr-fixup) laufen auf `labeled`-Events. Der Soft-Abort-Selbstretrigger (Trigger-Label entfernen + sofort neu setzen) läuft im sterbenden Job. Stirbt der Lauf davor (Runner-Ausfall, Cancel, hartes Timeout, API-Fehler), klebt das Trigger-Label am Issue/PR, ohne dass ein Folge-Event die Phase wieder weckt. Der Continue-Sweep ist das Sicherheitsnetz dafür (analog zum Merge-Gate-Sweep `claude-pr-gate-sweep.yml`).

## Vorbedingung

- GitHub Repository ist verfügbar, GitHub Actions ist aktiv
- GitHub-App-Secrets `APP_ID` + `APP_PRIVATE_KEY` sind gesetzt (Label-Writes mit `GITHUB_TOKEN` lösen keine Folge-Workflows aus — ohne App-Token wäre der Sweep wirkungslos und bricht bewusst rot)

## Verhalten

- **Trigger:** `schedule` mit zwei Cron-Zeilen (GitHub-Cron ist UTC; Europe/Berlin wechselt zwischen CEST/CET): `5 22,4,10,16 * * *` (Sommer-Offsets) und `5 23,5,11,17 * * *` (Winter-Offsets); ergänzend `workflow_dispatch` mit `dry-run`-Input (umgeht den Zeitfenster-Guard bewusst)
- **Laufzeit-Guard:** `TZ='Europe/Berlin' date +%H` ∈ {00, 06, 12, 18} — nur die 4 Feuerungen laufen, die auf 00:05/06:05/12:05/18:05 Berlin fallen (DST-korrekt, 8 Feuerungen/Tag, davon 4 No-ops)
- **Kandidaten-Erkennung (pro Phase):** Phase ruht (jüngster Run des Phase-Workflows weder `queued`/`in_progress` noch jünger als 10 Minuten) UND offenes Issue mit `ai:needs-analyse`/`ai:needs-ux-ui`/`ai:needs-spec`/`ai:needs-impl` bzw. offener, nicht-Draft-PR mit `ai:needs-review`/`ai:needs-fixup`. Ausgeschlossen: `ai:to-big-issue` (Menschen-Signal), `ai:needs-human` (wartet auf Menschen), Draft-PRs
- **Nachfeuern:** Trigger-Label per GitHub-App-Token entfernen + sofort neu setzen. `ai:continued` wird nie angefasst und nie als Detektions-Kriterium genutzt — der Marker signalisiert dem Folgelauf „fortsetzen statt neu starten". Der geweckte Workflow entscheidet mit seinen eigenen Guards (Konsumiert-Check, Doppel-Run-Guard), ob er arbeitet

## Erwartetes Ergebnis

- Der Sweep läuft 4×/tag zur korrekten Berliner Zeit (00:05/06:05/12:05/18:05), DST-korrekt
- Ein Issue/PR mit klebendem Trigger-Label bei ruhender Phase wird innerhalb von ≤ 6 Stunden automatisch geweckt; der Folgelauf setzt bei `ai:continued` fort statt neu zu starten
- 0 Kandidaten ⇒ 0 Label-Toggles, 0 Folge-Runs (kein Run-Lärm)
- Manuell über GitHub UI ausführbar (`dry-run` für Erst-Beobachtung)
