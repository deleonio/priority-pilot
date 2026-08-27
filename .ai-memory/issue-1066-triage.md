# Issue 1066 — Triage-Phase (2026-08-27)

## Erledigt
- Issue-Body analysiert, alle Datei-Behauptungen des Tickets gegen den Code verifiziert (alle zutreffend, zwei Pfad-Korrekturen notiert).
- KI-ANALYSE-Block (stand=2026-08-27T19:08:49Z) + ai-phase-routing-Tabelle in den Body geschrieben; alle 4 Marker per grep verifiziert (4/4).
- Labels: `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt (Ampel 🟢, ux=ja).
- Kein Ping-Kommentar (unambiguous outcome), kein Copyedit (Body war bereits quality-geprüft), Titel unverändert (treffend), kein Split (Begründung s. Fallstricke), kein autonomes Schließen (Anforderungen offensichtlich nicht erfüllt — kein lat/lon, kein /tasks/nearby).

## Relevante Stellen
- `server/src/models/task.ts:37,136` — `address`-Feld/-Spalte; lat/lon hier ergänzen.
- `server/src/models/series.ts:34,128` — Serien-`address`; lat/lon analog.
- `server/src/logics/migrate.ts:74-75` — Muster für nullable-Spalten-Nachzug (`address`, #1063).
- `server/src/logics/series.ts:142` — Snapshot-Zeile `address: series.address ?? null` in generateDueInstances; lat/lon daneben.
- `server/src/express/routes/tasks.ts:9,28` — `getUserId`/`ownerScope` (AK7-Muster), TaskAttributes-Validierung.
- `server/src/express/routes/reverseGeocode.ts` — fertige Reverse-Geocoding-Route (#866), 1-req/s-Rate-Limit + Fallback leere Adresse.
- `frontend/src/lib/useAddressSearch.ts` — wirft Koordinaten weg (`results.map((entry) => entry.address)`); Kern von AK1/AK10.
- `frontend/src/lib/useGeolocation.ts` — Präferenz (`pp-geolocation-enabled`), 5-Min-Intervall, `refresh()`; Basis AK4/AK8.
- `frontend/src/api.ts:509,526` — `reverseGeocode`/`geocodeSearch` existieren; Nearby-Client fehlt.
- `frontend/src/components/Dashboard.tsx:156` — KolCard-Muster der Nachbar-Cards; neue Card hier einfügen.
- `frontend/src/components/GeoBadge.tsx` — heute `address`-Prop; verwendet in `CompletedTasksTable.tsx:127` + `SeriesTab.tsx:148` (NICHT in TaskTree — Ticket-Behauptung leicht ungenau).
- `openapi.yml` — DTO-Quelle (Task-Schema `address` ~Zeile 1136); im Ticket genannter `server/src/api.d.ts` existiert nicht.
- `server/src/logics/series.test.ts:437-482` — rotes/gram-Spec-Muster für den address-Snapshot; Vorlage für lat/lon-Snapshot-Tests.

## Annahmen
- „Coordinates-only" (27.08., Ticket-Autor) ist bindend; DB speichert lat/lon, Adresse nur noch angezeigt via Reverse-Geocoding, kein DB-Adress-Cache.
- Kein Umkreis-Cap (Triage-Entscheidung, im Analyseblock dokumentiert): AK2 definiert Top-10 nach Distanz ohne Radius.
- Spaltennamen `latitude`/`longitude` vorgeschlagen (noch nichts fixiert — Spec/Impl kann `lat`/`lon` wählen).
- Verbleib der `address`-Spalten bewusst an die Spec-Phase delegiert (steht so im Ticket), kein needs-human-Grund.

## Verworfen
- Split in Sub-Issues: Kriterium „mehrere Layer" formell erfüllt, aber Teile sind streng sequenziell (Spalten → Endpoint → Card), eigenständige PR-fähige Sub-Tasks entstünden nicht; Vorbild #1063 (gleiche Form, Server+Frontend) wurde als EIN Ticket heute gemergt.
- needs-human: alle drei „Offenen Fragen" des Tickets sind vom Autor explizit an Triage/UX/Spec delegiert; bindende Grundsatz-Entscheidung (Coordinates-only) liegt vor.
- Copyedit/Title-Edit: Body quality-geprüft (ai-quality-Kommentar), Titel präzise — kein pro-forma-Edit.

## Offen
- (keine Blocker)

## Nächster Schritt
- UX-Phase (Label `ai:needs-ux-ui` gesetzt): Card-Platzierung im Dashboard + Ort der reverse-geocodeten Adresse entscheiden, KI-UX-Block schreiben, 375px/Mobile-Regeln beachten.

## Fallstricke
- Nominatim 1 req/s, kein Batch: Card-Auflösung (bis 10 Adressen) MUSS sequenziell/lazy + client-seitig pro Session cachen — kein DB-Cache (widerspräche der bindenden Coordinates-only-Entscheidung).
- SQLite-Migration: nullable Spalten brauchen kein NOT NULL/DEFAULT (migrate.ts-Kommentar Zeile 61); Bestand bleibt NULL, kein Bulk-Geocoding (explizit kein Scope).
- AK10: Freitext ohne Vorschlags-Auswahl darf Speichern nicht brechen — Validierung darf lat/lon nicht erzwingen.
- Body-Roundtrip lief über `.ai-memory/issue-1066-body.md` + `issue-1066-block.md` (gitignored, Write-Tool-kompatibel) — bei Re-Tiage denselben Weg gehen, nicht Heredoc.
