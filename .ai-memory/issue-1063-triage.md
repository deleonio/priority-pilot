# Issue 1063 — Triage (Geo-Badge in Listen)

## Erledigt
- Issue-Body + Kommentare geladen (nur 1 Bot-Kommentar `ai-quality`, keine Entscheidungen) — Initial-Triage.
- Code-Recherche Geolocation: `address` existiert NUR am Task (`server/src/models/task.ts:37`, Spalte wird in `server/src/index.ts:182` nachgezogen). Serie hat KEIN address-Feld (`server/src/models/series.ts:20-45`, nichts); `SeriesCreate` in `frontend/src/components/TaskForm.tsx:560-570` schickt kein address.
- Listen-Recherche: `TaskTable.tsx` ist ungenutzt (kein `<TaskTable` im Repo ausser Test). Live: `TaskTree` (App.tsx:573+587) und `CompletedTasksTable` (App.tsx:600+610). Serienliste: `SeriesTab.tsx` (series-tree-row, Zeile ~146 Rhythmus-Badge als Vorbild).
- Verdict: needs-human (siehe Offen), Decision-Kommentar mit Marker gepostet, Label `ai:needs-human` gesetzt, `ai:needs-analyse` entfernt. Body/Title unveraendert.

## Relevante Stellen
- `server/src/models/task.ts:37` — `address?: string | null`, einzige Geolocation-Datenquelle.
- `frontend/src/components/TaskForm.tsx:579` — TaskUpdate setzt address (Geocoding via `useAddressSearch`).
- `frontend/src/components/SeriesTab.tsx:146` — Serien-Zeile: `series-tree-badge--rhythm` = Styling-Vorbild fuer Badge.
- `frontend/src/components/TaskTree.tsx` / `CompletedTasksTable.tsx` — die echten Aufgabenlisten.
- `frontend/src/components/TaskTable.tsx` — ungenutzt/tot (nur eigener Test).

## Annahmen
- Geolocation == `address`-Feld (String aus Forward-Geocoding), keine Lat/Lon-Spalten.

## Verworfen
- Analyse-Block + Ampel schreiben: verboten bei Unklarheit (Skill Schritt 3/5) — Serien-Teil der AKs ist mit heutigem Modell unerfuellbar.
- Titel-Edit: "Geo badge an aufgabenliste" ist unvollständig (Serie fehlt), aber Scope-Entscheidung steht aus → nicht vorweggenommen.

## Offen
- Menschenentscheidung ausstaendig (Option A nur Tasks vs. Option B Series-Modell um address erweitern; welche Zaehlen als Aufgabenlisten). Blockiert alles weitere.

## Nächster Schritt
- Re-Triage nach Decision-Kommentar: nur DIESEN Kommentar + alle danach lesen (binding), dann Analyse-Block + Routing-Tabelle in den Body, Label gemaess Ampel setzen.

## Fallstricke
- Bei Option B: DB-Spalte analog `server/src/index.ts:182` (address-Spalte nachziehen) + OpenAPI-Client neu generieren, sonst fehlt `address` im `Series`-Typ.
- Nicht fälschlich `TaskTable` anpassen — Komponente ist unbenutzt; wirksame Stellen sind TaskTree/CompletedTasksTable.
- Emoji 🌍 vs. KoliBri-Icon: KolIcons-Font kennt vermutlich keinen Globus; Font Awesome (`fa-solid fa-globe`) ist im Projekt etabliert (SeriesTab nutzt `fa-solid fa-pen`) — Empfehlung im Decision-Kommentar steht.
