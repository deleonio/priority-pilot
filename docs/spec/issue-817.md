# Spec-817: Guide-Sync-Liefermodell für Spec-Sync-Workflow

## Ziel

Der Workflow `.github/workflows/claude-spec-sync.yml` soll auf das Guide-Sync-Liefermodell umgestellt werden (1:1-Port). Jeder Lauf erzeugt maximal EINEN Sammel-PR über alle Spec-Drifts.

## Vorbedingung

- Repository ist auf `origin/main`
- Workflow-Datei `.github/workflows/claude-spec-sync.yml` existiert

## Schritte

### 1. Lauf mit Drift (≥ 2 Spec-Dateien)

- Agent arbeitet auf `chore/spec-sync-all` Branch (Reset von `origin/main`)
- Agent erstellt einen Sammel-PR über alle Dateien mit `ai:needs-review`
- Deliver-Step: `git push --force`, PR create-oder-edit
- PR-Body enthält: Kopfzeile + Pipeline-Hinweis + kompletter Per-Datei-Report
- Review wird per Re-Arm-Muster #536 angestoßen

### 2. Lauf ohne Drift

- Agent erkennt `VERDICT: synced` / 0 Commits
- Kein Push, kein PR (bestehender Pfad bleibt erhalten)

### 3. Lauf bei offenem Sammel-PR mit Pipeline-Label

- In-Flight-Guard-Step erkennt Label (z.B. `ai:needs-review`)
- Lauf bricht mit Notice ab (kein Force-Push)

### 4. Lauf bei offenem Sammel-PR ohne Pipeline-Label

- Lauf aktualisiert PR via `gh pr edit`
- Review wird erneut per Re-Arm angestoßen

## Erwartetes Ergebnis

### AK 1: Ein PR mit mehreren Specs

- Lauf mit Drift in ≥ 2 Spec-Dateien erzeugt genau EINEN PR
- Branch: `chore/spec-sync-all`
- Titel: `docs(spec): Ist-Stand-Sync <datum>`
- Body: kompletter Per-Datei-Report

### AK 2: Kein PR bei Sync

- `VERDICT: synced` → kein Push, kein PR

### AK 3: Aussetzen bei Label-Konflikt

- Offener PR mit Pipeline-Label → Lauf setzt aus mit Notice

### AK 4: Update bei Label-freiem PR

- Offener PR ohne Label → PR wird aktualisiert, Review angestoßen

## Testfälle

- TF 1: Lauf mit 2 geänderten Spec-Dateien → 1 PR mit beiden Reports
- TF 2: Lauf ohne Drift → 0 PRs
- TF 3: Lauf bei offenem PR mit `ai:needs-review` → Skip mit Notice
- TF 4: Lauf bei offenem PR ohne Label → PR wird aktualisiert
