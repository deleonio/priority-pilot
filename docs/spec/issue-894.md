# Issue 894: Continue-Sweep — hängende Pipeline-Phasen fortführen

## Ziel

Stehengebliebene Pipeline-Workflows werden automatisch fortgesetzt: Alle 6 Stunden — jeweils
5 Minuten nach 0, 6, 12 und 18 Uhr Europe/Berlin — prüft ein Sweep, ob einer label-getriebenen
Phase (01–06) ein Trigger-Label klebt, ohne dass ein Lauf existiert, und feuert das Trigger-
Label dann neu.

## Hintergrund

Die Phase-Workflows (01-claude-triage … 06-claude-pr-fixup) laufen auf `labeled`-Events. Der
Soft-Abort-Selbstretrigger (Trigger-Label entfernen + sofort neu setzen) läuft **im sterbenden
Job**. Stirbt der Lauf davor (Runner-Ausfall, Cancel, hartes Timeout ohne Cleanup-Pfad,
API-Fehler), klebt das Trigger-Label am Issue/PR, ohne dass ein Folge-Event die Phase je wieder
weckt — die Arbeit steht still, bis ein Mensch eingreift. Gegenmaßnahme:
**Sicherheitsnetz-Continue-Sweep**, analog zum bestehenden `claude-pr-gate-sweep.yml` für das
Merge-Gate.

## Vorbedingung

- GitHub Repository ist verfügbar, GitHub Actions ist aktiviert
- GitHub-App-Secrets `APP_ID` + `APP_PRIVATE_KEY` sind gesetzt (Label-Writes mit `GITHUB_TOKEN`
  lösen keine Folge-Workflows aus — ohne App-Token wäre der Sweep wirkungslos und bricht bewusst rot)

## Schritte

### 1. Workflow-Datei anlegen

- Datei `.github/workflows/claude-continue-sweep.yml` erstellen (Eigennamen-Konvention wie
  `cache-cleanup.yml`, `renovate.yml` — keine Phasen-Nummerierung, kein Bestandteil der Kette)

### 2. Trigger konfigurieren

- `schedule` mit **zwei** Cron-Zeilen (GitHub-Cron ist UTC; Europe/Berlin wechselt zwischen
  CEST/CET): `5 22,4,10,16 * * *` (Sommer-Offsets) und `5 23,5,11,17 * * *` (Winter-Offsets)
- Laufzeit-Guard im Job: `TZ='Europe/Berlin' date +%H` ∈ {00, 06, 12, 18} — nur die 4
  Feuerungen laufen, die auf 00:05/06:05/12:05/18:05 Berlin fallen (DST-korrekt, 8
  Feuerungen/Tag, davon 4 No-ops)
- `workflow_dispatch` ergänzend, mit `dry-run`-Input (umgeht den Zeitfenster-Guard bewusst)
- Cron-Minute :05 kollidiert mit keinem bestehenden Schedule (:17/:23/:27/:32/:37/:57)

### 3. Kandidaten-Erkennung (pro Phase)

- Ruht die Phase? Jüngster Run des Phase-Workflows weder `queued`/`in_progress` noch jünger
  als 10 Minuten (schließt das Soft-Abort-Fenster zwischen altem Run-Ende und Folgelauf-Start ab)
- Kandidat: offenes Issue mit `ai:needs-analyse`/`ai:needs-ux-ui`/`ai:needs-spec`/`ai:needs-impl`
  bzw. offener, nicht-Draft-PR mit `ai:needs-review`/`ai:needs-fixup`
- Bewusster Ausschluss: `ai:to-big-issue` (Menschen-Signal), `ai:needs-human` (wartet auf
  Menschen), Draft-PRs

### 4. Nachfeuern

- Trigger-Label per GitHub-App-Token **entfernen + sofort neu setzen** (dokumentierte
  Selbst-Retrigger-Mechanik aus `docs/ci-architecture.md` „Weiches Zeitlimit")
- `ai:continued` wird **nie angefasst und nie als Detektions-Kriterium genutzt**: Der Marker
  signalisiert dem Folgelauf „fortsetzen statt neu starten" — ein vom Sweep geweckter Lauf
  liest ihn selbst
- `unlabeled`-Nebenwirkung des Removes ist harmlos: 01-claude-triage gatet `unlabeled` auf
  `ai:analysed`, der Sweep entfernt nur `ai:needs-*`
- Der geweckte Workflow entscheidet mit seinen eigenen Guards (Konsumiert-Check,
  Doppel-Run-Guard), ob er arbeitet — keine Logik-Duplikate im Sweep

### 5. Dokumentation

- Cron-Zeilen mit UTC-Wert + Deutsch-Kommentar zur Europe/Berlin-Zeit (Repo-Konvention)
- Spiegel-Doku: `docs/ci-architecture.md` (Unterkapitel Continue-Sweep) und
  `docs/pipeline-flow.md` (Schlüsselmechanik)

## Erwartetes Ergebnis

- Workflow-Datei existiert unter `.github/workflows/claude-continue-sweep.yml`
- Der Sweep läuft 4×/tag zur korrekten Berliner Zeit (00:05/06:05/12:05/18:05), DST-korrekt
- Ein Issue/PR mit klebendem Trigger-Label bei ruhender Phase wird innerhalb von ≤ 6 Stunden
  automatisch geweckt; der Folgelauf setzt bei `ai:continued` fort statt neu zu starten
- 0 Kandidaten ⇒ 0 Label-Toggles, 0 Folge-Runs (kein Run-Lärm)
- Manuell über GitHub UI ausführbar (`dry-run` für Erst-Beobachtung)
- Label `infrastructure` ist am Issue/PR gesetzt

## Hinweis zu Tests

⚠️ **ADR 0001**: Workflow-Definitionen werden nicht durch automatische Tests abgedeckt
(`docs/adr/0001-github-workflows-bleiben-ungetestet.md`). Strukturelle Prüfung: YAML-Parsbarkeit,
Cron-Kollisionsfreiheit, Zeitfenster-Guard-Logik (Negativ-Kontrolle: Berlin-Stunde außerhalb
{00,06,12,18} ⇒ No-op). Fehler fallen beim Ausführen des Workflows laut auf. Ein neuer
schedule-Workflow wirkt erst nach Merge auf main; der `workflow_dispatch`-Pfad ist am
Einführungs-PR testbar.
