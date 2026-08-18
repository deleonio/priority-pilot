# ADR 0003: Label-Schema-Refactoring

## Status

Akzeptiert und implementiert (Issue 851 + 854)

## Kontext

Die Label-Kette der Pipeline war historisch gewachsen und inkonsistent:

- **Inkonsistente Trigger-Muster:** Phasen triggerten auf unterschiedliche Labels (`ai:spec-ready`, `ux:ready`, `ai:ready`, `ai:needs-review`, `ai:needs-changes`)
- **Keine klare Trennung:** Ergebnis-Labels mischten sich mit Trigger-Labels (`ai:ready-to-merge` war Trigger UND Outcome)
- **Uneinheitliche Done-Labels:** `ai:analyzed` (US) vs. geplante Vergangenheitsform
- **Race-Bedingungen:** Review konnte starten, obwohl gleichzeitig `ai:needs-changes` auf dem PR lag

## Entscheidung

Vereinheitlichung auf ein Schema mit klarer Trennung:

### Trigger-Labels `ai:needs-*`

Jede Phase reagiert auf GENAU EIN Startlabel:

| Phase      | Neuer Trigger                    | Alter Trigger                   |
| ---------- | -------------------------------- | ------------------------------- |
| Triage     | `issues.opened`                  | `issues.opened` (unverändert)   |
| UX         | `ai:needs-ux-ui`                 | `ai:spec-ready`                 |
| Spec       | `ai:needs-spec`                  | `ux:ready`                      |
| Implement  | `ai:needs-impl`                  | `ai:ready`                      |
| Review     | `ai:needs-review`                | `ai:needs-review` (unverändert) |
| Fixup      | `ai:needs-fixup`                 | `ai:needs-changes`              |
| Documenter | `pull_request.closed` + `merged` | unverändert                     |

### Done-Labels `ai:<Vergangenheitsform>`

Jede erfolgreiche Phase setzt ihr Done-Label UND den Trigger der nächsten Phase:

| Phase      | Done-Label       | Alter Done-Label              |
| ---------- | ---------------- | ----------------------------- |
| Triage     | `ai:analysed`    | `ai:analyzed`                 |
| UX         | `ai:ux-reviewed` | — (neu)                       |
| Spec       | `ai:specified`   | — (neu)                       |
| Implement  | `ai:implemented` | — (neu)                       |
| Review     | `ai:reviewed`    | — (neu)                       |
| Fixup      | `ai:fixed`       | — (neu)                       |
| Documenter | `ai:documented`  | `ai:documented` (unverändert) |

### Info-Labels

Keine Trigger, nur Status-Signale:

- `ai:needs-human` — Stop + Kommentar mit WARUM
- `ai:to-big-issue` — Signal: Aufgabe zu groß, keine automatische Aktion

### Entfallende Labels

- `ai:spec-ready` → `ai:needs-ux-ui` (UX-Phase) + `ai:needs-spec` (Spec-Phase)
- `ux:ready` → `ai:needs-spec`
- `ai:ready` → `ai:needs-impl`
- `ai:needs-changes` → `ai:needs-fixup`
- `ai:ready-to-merge` → Gate-Merge triggert auf `ai:reviewed`

## Konsequenzen

### Positive

- **Klare Trennung:** Trigger-Labels starten Phasen, Done-Labels markieren Abschluss
- **Keine Races:** Jede Phase hat genau einen Trigger; koexistierende Labels sind unmöglich
- **Konsistente Naming:** Alle Trigger folgen dem Muster `ai:needs-*`, alle Done-Labels der Vergangenheitsform
- **Bessere Verständlichkeit:** Neue Teammitglieder verstehen den Flow schneller

### Negative

- **Breaking Change:** Alle Dokumentationen mussten aktualisiert werden (Issue 854)
- **Workflow-Anpassungen:** Alle 7 Phasen-Workflows mussten angepasst werden (Issue 851)
- **Migrationsaufwand:** CI-Konfiguration und Dokumentation benötigten Updates

## Migration

### Altes → Neues Schema

```
ALTES SCHEMA                     → NEUES SCHEMA
ai:analyzed                      → ai:analysed
ai:spec-ready                    → ai:needs-ux-ui (UX-Trigger)
ux:ready                         → ai:needs-spec (Spec-Trigger)
ai:ready                         → ai:needs-impl (Implement-Trigger)
ai:needs-changes                 → ai:needs-fixup (Fixup-Trigger)
ai:ready-to-merge                → ai:reviewed (Review-Done)
```

### Implementierung

- **Issue 851:** Workflow-Refactoring (CI-Konfiguration)
- **Issue 854:** Dokumentations-Update (docs/, AGENTS.md, .ai-knowledge/)

### Rollback

Nicht möglich — Breaking Change mit abhängigen Systemen.

## Referenzen

- Issue 851: `refactor(ci): Label-Schema vereinheitlichen`
- Issue 854: `docs(ci): Label-Schema-Dokumentation aktualisieren`
- [docs/pipeline-flow.md](../pipeline-flow.md) — Aktualisierter Pipeline-Flow
- [docs/ci-architecture.md](../ci-architecture.md) — CI-Architektur mit neuen Labels
