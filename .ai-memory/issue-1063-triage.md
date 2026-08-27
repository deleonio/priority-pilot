# Issue 1063 — Triage (Geo-Badge in Erledigt-/Serienliste)

## Erledigt
- Initial-Triage (Vorlauf): needs-human gestellt, Decision-Kommentar mit `<!-- ai-triage-decision -->` gepostet (2026-08-27T17:36:52Z).
- Menschenentscheidung erhalten (@deleonio, 2026-08-27T17:51:04Z, BINDEND): **Option B** (Series-Modell um `address` erweitern), **nicht im TaskTree** (Badge nur CompletedTasksTable + SeriesTab), **Font-Awesome-Icon** (`fa-solid fa-globe`).
- Re-Triage abgeschlossen (2026-08-27T17:54Z): Analyse-Block (🟢, stand=2026-08-27T17:54:18Z) + Routing-Tabelle in den Body geschrieben; Titel geaendert zu „Geo-Badge für Ortsbezug in Erledigt- und Serienliste (address für Serien)"; Labels: `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt (per gh verifiziert). Kein Ping-Kommentar (eindeutiger Ausgang).
- Code-Recherche verifiziert: Series hat kein address (`server/src/models/series.ts`); Migrations-Vorbild `migrateTaskAddress` (`server/src/logics/migrate.ts:424`); Einreihung vor sync() (`server/src/index.ts:157-187`); Kaskade `applyToInstances` (`server/src/express/routes/series.ts:393-402`); Instanz-Vererbung `generateDueInstances` (`server/src/logics/series.ts:136-152`); OpenAPI `Series`/`SeriesCreate`/`SeriesUpdate` (openapi.yml:1771/1829/1874); Client-Regeneration `pnpm --filter client generate` + `pnpm --filter server build:api`.

## Relevante Stellen
- `server/src/models/series.ts` — address-Feld + Spalte ergaenzen (Vorbild `task.ts:37`).
- `server/src/logics/migrate.ts:424` — `migrateTaskAddress` als Muster fuer neue `migrateSeriesAddress`.
- `server/src/express/routes/series.ts` — validateSeriesFields (~129), serializeSeries (~109), Kaskade (~393-402).
- `server/src/logics/series.ts:136-152` — `Task.create` im Generator: address vererben (Snapshot wie autoDeleteAfterDeadline).
- `openapi.yml:1771/1829/1874` — Series/SeriesCreate/SeriesUpdate um address erweitern; applyToInstances-Doku (~1912).
- `frontend/src/components/TaskForm.tsx` — SeriesUpdate (~541-550), SeriesCreate (~561-571), `hasSeriesCascadeChange` (~70), Adressfeld im Serien-Modus.
- `frontend/src/components/SeriesTab.tsx:146` — Rhythmus-Badge als Styling-Vorbild; Badge hier ergaenzen.
- `frontend/src/components/CompletedTasksTable.tsx` — Titel-Zelle/Renderer fuer Task-Badge.
- Test-Vorbilder: `server/src/express/tasks-address.test.ts`, `series.cascade.test.ts`, `server/src/logics/series.test.ts`.

## Annahmen
- Geolocation == `address`-String (Forward-Geocoding), keine Lat/Lon-Spalten.
- address wird kaskadierbar wie `description` (#553-Modal + #555 Done-Aussnivers); aus Option B als Konsistenz-Folge abgeleitet, nicht explizit vom Menschen entschieden.
- Ein PR reicht (Vertikal-Schnitt, Vorbild #523); kein Split.

## Verworfen
- Option A (Badge nur Aufgabenlisten) — vom Menschen zugunsten von Option B abgelehnt.
- TaskTree als Badge-Ort — explizit „Nicht in TaskTree" entschieden.
- Emoji 🌍 — vom Menschen zugunsten Font-Awesome abgelehnt.
- Split in Sub-Issues — kleiner Vertikal-Schnitt, ein PR reviewbar.
- `TaskTable.tsx` anpassen — unbenutzt/tot.

## Offen
- - (alles entschieden, Phase UX laeuft naechst an)

## Nächster Schritt
- Phase UX (Label `ai:needs-ux-ui` gesetzt): KI-UX-Block schreiben; danach Spec/Impl gemaess Routing-Tabelle (ux haiku/low, spec sonnet/medium, impl+review sonnet/high).

## Fallstricke
- Migration VOR `sequelize.sync()` einfuegen, sonst `no such column` auf Bestands-DBs.
- OpenAPI first, dann Client (`pnpm --filter client generate`) + `pnpm --filter server build:api`, sonst fehlt `address` im `Series`/`SeriesCreate`/`SeriesUpdate`-Typ.
- TaskTree nicht anfassen (Explizit-Entscheidung), TaskTable ist tot.
- „Kein horizontaler Überlauf"-AKs per Bounding-Box messen (App-Shell clippt `overflow-x: hidden`, scrollWidth unbrauchbar — MEMORY.md 2026-08-24).
