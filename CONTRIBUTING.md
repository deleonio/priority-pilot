# Mitwirken an Priority Pilot

Danke, dass du zu Priority Pilot beitragen möchtest! Dieses Dokument beschreibt, wie du
Fehler meldest, Verbesserungen vorschlägst und Code beisteuerst.

## Verhaltenskodex

Mit deiner Teilnahme akzeptierst du unseren [Verhaltenskodex](CODE_OF_CONDUCT.md).
Bitte behandle alle Beteiligten respektvoll.

## Voraussetzungen

- **Node.js** `>=26`
- **pnpm** `11` (siehe `packageManager` in der `package.json`)

```bash
pnpm install   # Abhängigkeiten im gesamten Monorepo installieren
```

## Projektaufbau

Priority Pilot ist ein pnpm-Monorepo (siehe [README.md](README.md)):

- `server/` — Node.js + Express + Sequelize (SQLite), gesamte Fachlogik
- `client/` — aus `openapi.yml` generierte API-Typen
- `frontend/` — React 19 + KoliBri (Vite/PWA)

Der gemeinsame API-Vertrag liegt in [`openapi.yml`](openapi.yml).

## Fehler melden

Ein guter Fehlerbericht enthält:

- eine klare Beschreibung des erwarteten und tatsächlichen Verhaltens,
- eine möglichst kleine Schritt-für-Schritt-Reproduktion,
- Umgebung (Node-Version, Betriebssystem, betroffenes Package).

Sicherheitslücken bitte **nicht** öffentlich als Issue melden — siehe [SECURITY.md](SECURITY.md).

## Änderungen einreichen

**Spec-First:** Vor der Umsetzung wird die Spezifikation im Issue erstellt (Akzeptanzkriterien,
Testfälle). Erst wenn der Spec klar ist, folgen Tests und dann Code.

### Definition of Done

Eine Änderung gilt als fertig, wenn:

- [ ] Spezifikation im Issue aktualisiert (Akzeptanzkriterien geprüft, Testfälle vorhanden)
- [ ] Tests geschrieben und grün (test-first / Red-Green)
- [ ] Code umgesetzt
- [ ] `pnpm format`, `pnpm lint`, `pnpm test` bestanden
- [ ] Dokumentation aktualisiert (falls zutreffend)
- [ ] Code Review bestanden

1. **Branch** von `main` abzweigen (z. B. `feature/kurzbeschreibung` oder `fix/kurzbeschreibung`).
2. Änderungen umsetzen und – wo sinnvoll – mit Tests absichern.
3. Vor dem Commit prüfen:

   ```bash
   pnpm format   # Prettier über das gesamte Repo (eine zentrale Config)
   pnpm lint     # Lint über alle Packages
   pnpm test     # Tests über alle Packages
   pnpm build    # Client generieren + Server bauen
   ```

   Bevorzugt gezielt statt repo-weit prüfen, z. B.:

   ```bash
   pnpm --filter server build
   pnpm --filter server lint
   ```

4. **Pull Request** öffnen und mit dem zugehörigen Issue verknüpfen (`Closes #<nr>`).
   In der PR-Beschreibung bitte die Ergebnisse von `pnpm format`, `pnpm lint` und `pnpm test`
   dokumentieren.

## Commit-Konventionen

- Aussagekräftige, im Imperativ formulierte Commit-Nachrichten.
- Kleine, thematisch fokussierte Commits sind besser als große Sammel-Commits.
- TypeScript `strict`, ESM überall.

Weitere Details zu Konventionen stehen im Abschnitt [„Konventionen“ der Projekt-Wissensbasis](.ai-knowledge/project.md#konventionen).

## Lizenz der Beiträge

Priority Pilot steht unter der [EUPL-1.2](LICENSE). Mit dem Einreichen eines Beitrags
erklärst du dich einverstanden, dass dieser unter derselben Lizenz veröffentlicht wird.
