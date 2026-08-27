## Implementierung #1063 — Geo-Badge (Globus) in Serien- und Erledigt-Liste

Spec: `docs/spec/issue-1063.md` (AK1–AK6). Umsetzung nach dem bindenden KI-ANALYSE-Block (Option B) und dem KI-UX-Block im Issue-Body. Die roten Spec-Tests aus Phase 3 sind unverändert geblieben und jetzt grün.

### Umsetzung (Commit 9001fc73)

| Bereich | Datei | Änderung |
| --- | --- | --- |
| Modell | `server/src/models/series.ts` | `address?: string \| null` + Spalte (nullable, VARCHAR(255), `defaultValue: null`), analog `Task.address` |
| Migration | `server/src/logics/migrate.ts` | `address` in `SERIES_TABLE_COLUMNS` aufgenommen — `migrateSeriesTable` zieht die Spalte auf Bestands-DBs vor `sync()` nach (etabliertes Muster: `userId`/`autoDeleteAfterDeadline` liefen ebenso) |
| API | `server/src/express/routes/series.ts` | `validateSeriesFields`: address validieren (String ≤ 255 oder null, trim/leer → null, wie `routes/tasks.ts`); `serializeSeries`: zurückgeben; Kaskade `applyToInstances`: geändertes address auf offene (nicht erledigte) Instanzen |
| Generierung | `server/src/logics/series.ts` | `generateDueInstances` vererbt `address: series.address ?? null` als Snapshot auf jede Instanz |
| Vertrag | `openapi.yml` | `address` in `Series`/`SeriesCreate`/`SeriesUpdate` (nullable, maxLength 255); `applyToInstances`-Beschreibung um `address` erweitert; Client/Server-Typen regeneriert (gitignored) |
| Formular | `frontend/src/components/TaskForm.tsx` | Adressfeld (`KolCombobox` + `useAddressSearch`) gilt jetzt auch im Serie-Modus; `SeriesCreate`/`SeriesUpdate`-Payloads und `hasSeriesCascadeChange` (#553-Modal) um `address` erweitert; Vorbelegung aus `series.address` |
| Badge | `frontend/src/components/GeoBadge.tsx` (neu) | Icon-only Globus-Badge (Font Awesome `fa-solid fa-globe`), rein informativ, `aria-label="Standort: <adresse>"` (BITV), Anker `data-testid="geo-badge"` |
| Serienliste | `frontend/src/components/SeriesTab.tsx` | Badge in der `series-tree-row` hinter dem Rhythmus-Badge, nur bei `address` |
| Erledigt-Liste | `frontend/src/components/CompletedTasksTable.tsx` | Badge in der Titel-Zelle (per `render`/`renderIntoCell`, Datenwert `title` bleibt für Sortierung/Filter) |
| Styling | `frontend/src/app.css` | `.geo-badge` (dezent, `--pp-bg-muted`/`--pp-text-muted`, Metriken des Rhythmus-Badges) + `.done-title-cell` (Umbruch erlaubt → kein Überlauf bei 375px) |

TaskTree bleibt bewusst ohne Badge (bindende Entscheidung im Issue-Body); `TaskTable.tsx` (ungenutzt) unangetastet.

### Ergebnisse der Gates

| Befehl | Ergebnis |
| --- | --- |
| `pnpm format` | ✅ 0 |
| `pnpm exec prettier --check .` | ✅ All matched files use Prettier code style |
| `pnpm lint` | ✅ 0 (server + frontend) |
| `pnpm knip` | ✅ 0 (nur die bekannten pre-existing „Configuration hints") |
| `pnpm test` (server) | 713 pass / 0 fail — Exit 1 nur durch den bekannten umgebungsbedingten `AK-5 — Redis-Store`-Skip in `session.test.ts` (Redis ist nur als CI-Service vorhanden, siehe Dauergedächtnis 2026-08-27); mit meinen Änderungen nicht reproduzierbar verbunden |
| `pnpm test` (frontend) | ✅ 421 passed / 13 skipped (2 Spec-Dateien geskippt) |
| E2e `npx playwright test e2e/issue-1063-geo-badge.spec.ts` | ✅ 3/3 (AK4, AK5 inkl. TaskTree-Negativ, AK6 375px Bounding-Box) |

### UX-Berücksichtigung (KI-UX-Block)

- Icon-only, rein informativ, nicht klickbar — Font-Awesome-Globus statt 🌍-Emoji (Craft-Floor-Refuse-Liste).
- Bedeutung über `aria-label` mit „Standort" transportiert; Adresse selbst wird in Listen nicht angezeigt (Datensparsamkeit).
- Dezent statt Signal-Farbe (`--pp-bg-muted`/`--pp-text-muted`): Geolocation ist Information, keine Aktion.
- Mobile 375px: Badge wächst nicht mit Inhalt; `.done-title-cell` erlaubt Umbruch — AK6 per E2e-Bounding-Box verifiziert (App-Shell clippt `overflow-x`).

### KoliBri-Abweichung (Begründung)

Das Badge ist bewusst ein `<span role="img">` mit FA-Icon statt `KolBadge`: Der Test-/BITV-Vertrag verlangt `data-testid="geo-badge"` **und** `aria-label` auf demselben Element; `KolBadge` rendert sein Label aber im Shadow-DOM, ein host-seitiges `aria-label` wäre redundant bzw. das Hide-Label-Verhalten am Host nicht verlässlich greifbar. Die Spec hat die Komponenten-Wahl bewusst nicht vorgeschrieben (nur Testid + aria-label eingeklagt). Der Impeccable-Detector ist in diesem Repo nicht vorhanden (`.claude/skills/impeccable/` existiert nicht); stattdessen wurden die Layout-Regeln aus `docs/mobile-ui-rules.md` angewandt und 375px/1280 per E2e geprüft (AK6 läuft bei 375px, AK4/AK5 beim Config-Default 1280px).

### Abweichung vom Analyse-Umsetzungskontext

Der Analyse-Block schlug eine separate `migrateSeriesAddress`-Funktion vor (Vorbild `migrateTaskAddress`). Der bestehende `migrateSeriesTable`-Vertragstest (`server/src/logics/migrate.test.ts:226`, „Series.findAll() wirft nach Migration keinen SQLITE_ERROR") verlangt jedoch, dass `migrateSeriesTable` **alle** Modell-Spalten nachzieht — das etablierte Serien-Muster ist daher die gemeinsame `SERIES_TABLE_COLUMNS`-Liste (so wurden `userId` und `autoDeleteAfterDeadline` integriert). `address` wurde entsprechend dort aufgenommen; eine eigene Migrationsfunktion wäre redundant und hätte den Bestandstest rot gemacht. Kein Test wurde geändert.

### Test-Pflege-Bedarf

- keiner — keine bestehenden Tests widersprechen den AKs.

Closes #1063
