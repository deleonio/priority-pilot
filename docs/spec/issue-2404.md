# Spec #2404 — Serien-Anlage zentral in `POST /series`

**Ziel:** Defaults und Sofort-Instanzen liegen in der Route, nicht im MCP (`docs/fachlogik-inventar.md`).

| Schritt                                                    | Erwartung                                                                         |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `POST /series` ohne `priority`/`estimatedEffort`           | 201, `priority` 3, `estimatedEffort` 0.5 (Modell-Defaults von Task)               |
| `POST /series` mit `priority: 0` oder `estimatedEffort: 2` | 400                                                                               |
| `POST /series`, `autoCreate` true (Standard)               | fällige Instanzen bis `GENERATE_HORIZON_DAYS` sofort als Tasks mit `seriesId`     |
| `POST /series`, `autoCreate` false                         | keine Instanzen (Vorlage)                                                         |
| danach `POST /series/:id/generate`                         | keine Dubletten                                                                   |
| MCP `task_create` mit `series`                             | genau ein API-Aufruf `POST /series`; keine Defaults, kein `/generate` im Werkzeug |
