

<!-- KI-ANALYSE:START stand=2026-08-27T19:08:49Z -->
### Umsetzungskontext
- Betroffene Dateien (verifiziert):
  - `server/src/models/task.ts` — neue `latitude`/`longitude`-Spalten (nullable) neben `address` (Feld Zeile 37, Spaltendef. Zeile 136)
  - `server/src/models/series.ts` — `latitude`/`longitude` analog `address` (Feld Zeile 34, Definition Zeile 128)
  - `server/src/logics/migrate.ts` — Spalten-Nachzug nach dem `address`-Muster (Zeilen 74–75, SQLite: nullable braucht kein NOT NULL/DEFAULT)
  - `server/src/logics/series.ts` — Koordinaten-Snapshot in `generateDueInstances` neben `address: series.address ?? null` (Zeile 142)
  - `server/src/express/routes/tasks.ts` — Validierung/Persistenz von lat/lon (Validierung analog `address`, Zeile 28 ff.) + neuer `GET /tasks/nearby` (Haversine, `getUserId`/`ownerScope` aus `requireAuth.js`, Zeile 9)
  - `openapi.yml` — DTO-Quelle aller Typen (Routes importieren `components` daraus); Task-/Series-Schemas um lat/lon erweitern, Nearby-Endpoint neu. Hinweis: der im Ticket genannte Pfad `server/src/api.d.ts` existiert nicht — Schema-Quelle ist `openapi.yml`
  - `frontend/src/lib/useAddressSearch.ts` — Vorschläge künftig `{address, lat, lon}` statt reiner Strings (heute verwirft `results.map((entry) => entry.address)` die Koordinaten)
  - `frontend/src/components/TaskForm.tsx` — Koordinate des gewählten Vorschlags übernehmen; Leeren des Standorts → NULL/NULL
  - `frontend/src/components/Dashboard.tsx` — neue Card „In der Nähe" nach dem KolCard-Muster der Nachbar-Cards (Zeile 156)
  - `frontend/src/components/GeoBadge.tsx` — Keying auf lat/lon, Anzeige-Adresse per Reverse-Geocoding (aktuelle Verwendung: `CompletedTasksTable.tsx:127`, `SeriesTab.tsx:148`; `TaskTree` nutzt den Badge heute nicht)
  - `frontend/src/api.ts` — Client für `/tasks/nearby` neu; `reverseGeocode` (Zeile 509) und `geocodeSearch` (Zeile 526) existieren bereits
  - `frontend/src/lib/useGeolocation.ts` — Präferenz-Schalter, localStorage-Spiegel, 5-Minuten-Intervall existieren (AK8-Basis)
- Betroffene Komponenten: Task/Series-Modelle, Serien-Generator (Snapshot), neuer Nearby-Router (Haversine + Owner-Scope), `useAddressSearch`, `useGeolocation`, Dashboard-Card, `GeoBadge`
- Vorhandenes Muster: `server/src/express/routes/reverseGeocode.ts` (#866) für Koordinaten-→Adresse inkl. Rate-Limit-Fallback; `address`-Nachzug + Serien-Snapshot (#1063, heute gemergt) für Migration und Vererbung; `ownerScope`-Datenisolation (#207/#244) für den neuen Endpoint
- Randbedingungen: Nominatim 1 req/s, kein Batch — Adress-Auflösung der Card-Einträge sequenziell/lazy + client-seitiger Session-Cache; **kein** Adress-Cache in der DB (bindende Entscheidung Coordinates-only, 27.08.); Bestand ohne Koordinaten bleibt NULL (kein Bulk-Geocoding, explizit kein Scope); kein Umkreis-Cap (Triage-Entscheidung zu der offenen Frage im Ticket: AK2 definiert Top-10 nach Distanz ohne Radius, ein Cap wäre eine neue Anforderung; AK9 deckt den Dünn-Bestand ab); Verbleib der `address`-Spalten ist Spec-Entscheidung (siehe offene Fragen)
- Erwartetes Ergebnis: Standort wird ausschließlich als lat/lon gespeichert (bei Vorschlags-Auswahl); Dashboard-Card zeigt max. 10 offene Tasks aufsteigend nach Distanz mit #id, Titel, km; jede im UI gezeigte Adresse stammt aus Reverse-Geocoding der Koordinaten

### Akzeptanzkriterien
- AK1: Vorschlags-Auswahl speichert ausschließlich lat/lon; Leeren setzt beide auf NULL; keine Adress-Zeichenkette als Geo-Datensatz.
- AK2: Dashboard-Card mit max. 10 offenen Tasks (`Open`/`In process`), aufsteigend nach Distanz zur aktuellen Position; ohne Koordinaten/erledigte erscheinen nicht.
- AK3: Je Eintrag Distanz in km mit einer Nachkommastelle.
- AK4: Verweigerte/nicht verfügbare Freigabe → klarer Hinweis in der Card, Rest-Dashboard unbeeinträchtigt.
- AK5: Bei 375px kein Layoutbruch (docs/mobile-ui-rules.md), KolCard-Muster, Positionserhebung erst nach Freigabe.
- AK6: Neu generierte Serien-Instanz trägt Template-Koordinaten als Snapshot; spätere Template-Änderung ändert Bestandsinstanzen nicht (#553-Muster).
- AK7: `GET /tasks/nearby` auth-geschützt, liefert nur Tasks des eigenen Users (#207/#244).
- AK8: Geolocation-Präferenz aus → keine Positionsabholung, dezenter Hinweis mit Verweis auf die Einstellung.
- AK9: Keine/<10 Tasks mit Koordinaten → Leer-Aussage bzw. weniger Einträge, kein Fehlerzustand.
- AK10: Freitext-Adresse ohne Vorschlags-Auswahl → keine Koordinate, erscheint nicht in der Card, Speichern schlägt nicht fehl.
- AK11: Im UI gezeigte Adresse stammt aus Reverse-Geocoding; Fehlschlag degradiert kontrolliert („Adresse nicht verfügbar"), kein Fehlerzustand.

### Testfälle
- AK1 → Vitest-Unit `frontend/src/lib/useAddressSearch.test.ts` (Vorschlag trägt lat/lon) + API-Test `server/src/express/api.test.ts` (POST/PUT mit lat/lon persistiert Koordinaten; Leeren → NULL; Freitext ohne Koordinate bleibt speicherbar, deckt auch AK10)
- AK2/AK3 → API-Test für den Nearby-Endpoint (Sortierung aufsteigend, max. 10, nur offene Status, Distanzfeld in km) + e2e `frontend/e2e/nearby.spec.ts`
- AK4/AK8/AK9 → e2e `frontend/e2e/nearby.spec.ts` (Freigabe verweigert → Hinweis statt Fehler; Präferenz aus → Hinweis mit Einstellungs-Verweis; 0 bzw. <10 Tasks → Leer-Aussage/verringerte Liste)
- AK5 → e2e bei 375px-Viewport: kein Layoutbruch, Card folgt KolCard-Muster, keine ungefragte Positionsabholung
- AK6 → node:test `server/src/logics/series.test.ts` (Koordinaten-Snapshot analog dem `address`-Block ab Zeile 450)
- AK7 → API-Test Datenisolation nach Muster `server/src/express/api-auth-protection.test.ts` (User A sieht keine Tasks von User B, unauth → 401)
- AK11 → Vitest-Unit für die Adress-Anzeige (Reverse-Geocoding-Ergebnis; Fehlschlag → „Adresse nicht verfügbar")

### Ampel
- Ampel: 🟢
- Begründung: Bindende Entscheidung (Coordinates-only) liegt vor; 11 bereits prüfbare AKs; alle Bausteine existieren (Reverse-Geocoding-Route, Adresssuche mit lat/lon im Server-Response, Geolocation-Präferenz, Migrations- und Snapshot-Muster aus #1063). Umfang groß (Server + Frontend), aber kohärent in einem PR umsetzbar — Vorbild #1063 mit derselben Form wurde heute als ein Ticket gemergt. Kein Split: die Teile sind streng sequenziell abhängig (Spalten → Endpoint → Card), eigenständige Sub-Tasks entstünden nicht.

### ❓ Offene Fragen
- [ ] UX: Platzierung der Card im Dashboard (Vorschlag: nach der „Nächste Aufgabe"-Sektion bzw. neben den Deadlines — endgültige Platzierung in der UX-Phase)
- [ ] UX: Wo genau wird die reverse-geocodete Adresse sichtbar (Card-Einträge vs. GeoBadge vs. Task-Detail)? Das AK-Set fordert in der Card nur #id, Titel und Distanz
- [ ] Spec: Verbleib der `address`-Spalten in Tasks/Series (entfällt vs. bleibt als Suchtext-Echo) — Spalten wurden erst heute gemergt (#1063)
<!-- KI-ANALYSE:END -->

<!-- ai-phase-routing:START -->
| Phase | Run | Modell | Effort |
| --- | --- | --- | --- |
| ux | ja | sonnet | medium |
| spec | ja | sonnet | medium |
| impl | ja | opus | high |
| review | ja | opus | medium |
<!-- ai-phase-routing:END -->
