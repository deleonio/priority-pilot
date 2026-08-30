# Spec-Sync-Workflow: Sammel-PR-Liefermodell

**Stand:** 2026-08-27

## Ziel

Der Workflow `.github/workflows/cron.sync.spec.yml` synchronisiert `docs/spec/` gegen die Implementation und liefert jeden Lauf mit Drift als EINEN Sammel-PR ab.

## Vorbedingung

- Repository ist auf `origin/main`
- Workflow-Datei `.github/workflows/cron.sync.spec.yml` existiert

## Schritte

### 1. Lauf mit Drift (≥ 2 Spec-Dateien)

- Agent arbeitet auf dem Branch `chore/spec-sync-all` (Reset von `origin/main`)
- Agent erstellt einen Sammel-Commit über alle Dateien
- Deliver-Step: `git push --force`, PR create-oder-edit
- PR-Body enthält: Kopfzeile + Pipeline-Hinweis + kompletter Per-Datei-Report aus `/tmp/spec-sync-report.md`
- Review wird per Re-Arm-Muster #536 angestoßen (Label `ai:needs-review` setzen)

### 2. Lauf ohne Drift

- Agent erkennt `VERDICT: synced` / 0 Commits
- Kein Push, kein PR

### 3. Lauf bei offenem Sammel-PR mit Pipeline-Label

- In-Flight-Guard-Step erkennt Label (z. B. `ai:needs-review`, `ai:needs-human`)
- Lauf bricht mit Notice ab (kein Force-Push)

### 4. Lauf bei offenem Sammel-PR ohne Pipeline-Label

- Lauf aktualisiert den PR via `gh pr edit`
- Review wird erneut per Re-Arm angestoßen

## Erwartetes Ergebnis

- Lauf mit Drift in ≥ 2 Spec-Dateien erzeugt genau EINEN PR: Branch `chore/spec-sync-all`, Titel `docs(spec): Ist-Stand-Sync <datum>`, Body mit komplettem Per-Datei-Report
- `VERDICT: synced` → kein Push, kein PR
- Offener PR mit Pipeline-Label → Lauf setzt mit Notice aus
- Offener PR ohne Label → PR wird aktualisiert, Review angestoßen
