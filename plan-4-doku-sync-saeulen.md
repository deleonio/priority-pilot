# Plan 4 — Doku-Sync: Säulen (`description`-Feld + „globale Stammdaten")

> Status: Entwurf · Risiko: niedrig (nur Doku, kein Code/kein Test) · Aufwand: ~15 min

## Ziel

Die Repo-Dokumentation hinkt dem aktuellen Stand hinterher. Mit `579a398` (feat: make life-balance
pillars global with descriptions) haben Säulen ein neues Pflichtfeld **`description`** und sind
explizit wieder **globale Stammdaten** (für alle Nutzer identisch, nicht pro Nutzer isoliert). Beides
ist in Code, OpenAPI, Migration und Tests sauber umgesetzt — nur in der menschenlesbaren Doku fehlt es.

Dieser Plan gleicht die Dokumentation an. **Kein Produktivcode, keine Tests, keine Migration.**

## Betroffene Dateien (komplett)

| Datei                      | Stelle                            | was fehlt                                                                                                                                               |
| -------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                | Z. 52–57 (Fachlogik → Modelle)    | `Pillar` wird beschrieben mit `weight`/`share`/`confidence`, aber **ohne `description`**; ebenso nicht erwähnt, dass Säulen **globale Stammdaten** sind |
| `README.md`                | Z. 141 (API-Liste)                | `GET /pillars` wird genannt — optional: Hinweis, dass `description` mitgeliefert wird                                                                   |
| `.ai-knowledge/project.md` | Z. 4–7 (Projekt-Kurzbeschreibung) | Säulen-Beschreibung erwähnt nur `task_pillars`-Mechanik, kein `description`-Feld                                                                        |
| `.ai-knowledge/project.md` | Z. 43 (`MISTRAL_API_KEY`)         | Kontext Säulen-Klassifikation — optional: Verweis auf `description` als Klassenfikations-Signal (aktuell nicht im Prompt genutzt)                       |

> Vorab zu prüfen (Completeness-Grep): `grep -rnE "Säule|pillar|description" README.md .ai-knowledge/`
> — ob weitere Stellen (z. B. `conventions.md`, `ticket-triage.md`) tangiert sind. Erwartung: nein.

## Schritte

1. **`README.md` Z. 52–57** — In der Pillar-Beschreibung `description` ergänzen und „globale
   Stammdaten" klarstellen. Formulierungsvorschlag:
   - „… einer **n:m**-Beziehung zu `Pillar` (eine der **fünf festen, für alle Nutzer identischen
     Lebensbalance-Säulen** mit **Kurzbeschreibung `description`** und prozentualem `weight`) über
     die Join-Tabelle `task_pillars` …"
2. **`.ai-knowledge/project.md` Z. 4–7** — analog: `description`-Feld benennen und „globale
   Stammdaten" aufnehmen (single source of truth für KI-Agents).
3. **(optional) `README.md` Z. 141** — falls die API-Liste präzisiert werden soll:
   „`GET /pillars` (Lebensbalance-Säulen inkl. Kurzbeschreibung)".
4. **Nicht tun:** keine Aussage zu „pro-Nutzer-Säulen" korrigieren — die Doku hat das **nie**
   behauptet (die Isolation aus #207 war undokumentiert in README eingeführt worden). Es gibt also
   keine falsche Stelle zum Streichen, nur Lücken zum Füllen.

## Test-Strategie

- Reine Doku-Änderung → **keine** Test-Ausführung nötig.
- Review per Augenschein: Links/Stellen noch stimmig, keine kaputten Querverweise.
- `pnpm format` laufen lassen (Prettier prüft auch `.md`), damit der Format-Check grün bleibt.

## Risiken / Rollback

- Risiko: minimal. Einzige Nebenwirkung: KI-Agents, die `.ai-knowledge/` lesen, sehen künftig das
  `description`-Feld — gewollt.
- Rollback: `git revert` des Doku-Commits.

## Abbruchbedingung

- Stellt sich beim Grep heraus, dass deutlich mehr Stellen tangiert sind (z. B. `docs/deployment.md`,
  weitere `.ai-knowledge/*.md`), wird der Plan vorher abgestimmt, statt still aufzublähen.

## Offene Frage an den Owner

- Soll `description` erwähnt werden als ** potenziell künftiges Klassifikationssignal** (im
  Mistral-Prompt aktuell _nicht_ genutzt)? Wenn ja, in `project.md` Z. 43 kurz anreißen; wenn nein,
  nur die reine Feld-Existenz dokumentieren.
