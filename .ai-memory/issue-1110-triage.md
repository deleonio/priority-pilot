# Issue 1110 — Triage (Phase 1), Stand 2026-08-29T06:36:17Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein KI-ANALYSE-Block; einziger Kommentar = github-actions-Qualitätscheck 2026-08-29T05:46:28Z, keine Entscheidung). Analyse-Block + Routing-Tabelle (ux nein/-/-, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high) an den Body angehängt, Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-spec` gesetzt. Kein Ping-Kommentar, kein Titel-/Body-Copyedit, kein Split (Frontend + ggf. Server-Test-Erweiterung = ein PR). Kein Auto-Close: AK1 (Radius im Card-Titel) ist nachweislich nicht implementiert.

## Erledigt
- Issue geladen, Trigger bestimmt (Initial-Triage), kompletten Body analysiert; Messgrößen des Issues in AK1–AK7 überführt.
- Code-Recherche (recherche-Subagent + eigene Verifikation): NearbyCard.tsx komplett gelesen, tasks.ts:330-383 (nearby-Route) gelesen, TaskForm.tsx:280-304 (`applyAddressCoords`), useGeolocation.ts:1-60 (kein Fallback-Koordinaten-Paar), tasks-nearby.test.ts-Assertionen gesichtet.
- Analyse-Block per `.ai-memory/issue-1110-{body,block,new}.md` + `gh issue edit --body-file` geschrieben (gh-Newline per `head -c -1` im Body-Fetch entfernt); Landing verifiziert (Tail = ai-phase-routing:END).
- Labels gesetzt und Endstand verifiziert: `["ai:needs-spec","ai:analysed"]`.

## Relevante Stellen
- `frontend/src/components/NearbyCard.tsx:56` — `_label="In der Nähe"` statisch; hier kommt `In der Nähe (X km)` rein (AK1). Card lädt nirgends Geo-Config → neuer `api.getGeoConfig()`-Fetch beim Mount (AK2 über Neuladen abgedeckt, Live-Event optional).
- `frontend/src/components/NearbyCard.tsx:23,85` — `formatKm` (de-DE, 1 Nachkommastelle) + Distanz-Span `({formatKm(task.distanceKm)} km)`; liest dasselbe DTO-Feld, das der Server schickt → Anzeige-Logik korrekt.
- `frontend/src/components/NearbyCard.tsx:57-76` — die vier Zustände (denied/preference-off/loading/empty), die unverändert bleiben müssen (AK6).
- `frontend/src/api.ts:593-599` — `getGeoConfig()` (GET /geo-config → `displayDistanceKm`, `alarmDistanceKm`, `intervalMinutes`); Vorbild-Nutzung SettingsPage.tsx:131-150.
- `frontend/src/lib/useGeolocation.ts` — `GEO_CONFIG_CHANGED_EVENT` (Fenster-Event nach PUT /geo-config, #1103 F6) als optionales Muster für Live-Radius-Update; Hook liefert ECHTE navigator.geolocation-Position, kein Fallback-Paar.
- `server/src/express/routes/tasks.ts:345-383` — GET /tasks/nearby: `parseCoord` mit 400-Guard (:347-353), `resolveGeoUser` + `maxDisplayKm` (:359-360), nur offene Tasks MIT Koordinaten (:362-369), `haversineKm` :337-343, Rundung `Math.round(x*10)/10` :374, Filter :377, slice 10 :378. Korrekt — kein Umbau.
- `server/src/express/routes/tasks.ts:222-247` — `validateTaskFields` nimmt `latitude`/`longitude` als Zahl/null, Paar-Logik (beide oder keine); POST /tasks persistiert sie direkt.
- `server/src/models/task.ts:145-160` — Spalten `latitude`/`longitude` `DataTypes.FLOAT`, allowNull, min/max-Validierung.
- `frontend/src/components/TaskForm.tsx:293-296` — `applyAddressCoords` setzt `form.current.latitude/longitude` aus dem gewählten Adress-Treffer; Aufruf :963 im `onSelect` der Autocomplete.
- Tests: `server/src/express/tasks-nearby.test.ts` (Distanz-Sortierung/-Rundung :91-114, koordinatenlos/Done raus :118-129, max 10 :135-142, displayDistanceKm-Filter :146-171, Owner-Isolation :176-181), `frontend/e2e/issue-1098-geo-settings.spec.ts:76-90` (Distanzformat `(\d+,\d km)` + Filter), `frontend/e2e/issue-1061-task-address.spec.ts` (Vorbild Adresssuche-E2E für TF3).

## Annahmen
- 0-km-Symptomatik: statische Code-Recherche findet KEINEN Bug — Kette Adressauswahl → Persistenz → Haversine → DTO → formatKm ist korrekt und getestet. Exakt 0,0 km für alle Einträge heißt rechnerisch Task-Koordinaten == gesendete Position. Haupthypothesen im Analyse-Block dokumentiert: (a) identische Koordinaten via gleiche/unscharfe Adress-Treffer (Orts-Zentroid) bei Standort dort, (b) veralteter PWA-Build (#1095-Update-Problem). Verifizierung am Livestand ist Impl-Aufgabe (Issue verlangt ausdrücklich Ursachen-Fix, nicht Kaschierung).
- ux=nein begründet mit: exakt vorgegebene Ziel-UI „In der Nähe (5 km)" durch den Autor, keine neuen Interaktionen/Komponenten (Präzedenz #1095/#1105).
- AK2 bewusst auf „beim nächsten Laden" formuliert (Issue-Wortlaut) — Live-Update über `GEO_CONFIG_CHANGED_EVENT` ist optionaler Bonus, kein AK.
- Geo-Config-Fetch in NearbyCard bei jedem Mount (kein Context/Cache) reicht aus — NearbyCard wird pro Dashboard-Besuch gemountet; SettingsPage macht es genauso.

## Verworfen
- needs-human — Anforderungen sind eindeutig und verifidizierbar; die 0-km-Ursache ist diagnostizierbar, keine Anforderungsfrage offen.
- Split — ein zusammenhängender AK-Satz, Frontend-Fokus + kleine Server-Test-Erweiterung = ein PR (Präzedenz #1083).
- Titel-/Body-Copyedit — Issue präzise (Problem/Soll/Messgrößen komplett); pro-forma-Edit verboten.
- Umbau der Server-Route als AK — Route ist korrekt und grün getestet; nur TF2-Erweiterung (exakt-0-Fall) als Verriegelung.
- MEMORY.md-Eintrag — kein neues Fehlermuster; Kriterien nicht erfüllt.

## Offen
- Wegwerf-Artefakte untracked in `.ai-memory/`, NICHT committen: `issue-1110-body.md`, `issue-1110-block.md`, `issue-1110-new.md`. Nur diese Datei hier (`issue-1110-triage.md`) ist die Phasen-Notiz.

## Nächster Schritt
- Spec-Phase (Label `ai:needs-spec` gesetzt): rote Tests für AK1–AK7 — TF1/TF3/TF6 neu in `frontend/e2e/issue-1110-nearby-radius.spec.ts` (oder Erweiterung der issue-1098-Spec), TF2 in `tasks-nearby.test.ts`, TF5 neu `frontend/src/components/NearbyCard.test.tsx`, TF4 vorhanden lassen.

## Fallstricke
- Routing-Tabelle im Body (ux nein/-/-, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high) ist für Folgephasen bindend.
- Card-Label-Änderung darf die vier Zustände nicht anfassen (AK6) — Zustände sind im KI-UX-Kontext von #1066 verankert.
- `KolCard _label` ist der Titel-Rohstring; „(5 km)" einfach anhängen, keine eigene Überschrift einbauen (Issue will Zusatz am Titel).
- Mobile-AK: Bounding-Box messen statt scrollWidth (App-Shell clippt overflow-x:hidden, MEMORY 2026-08-24); schmale Viewports (375px) mitprüfen.
- E2E-Filter-Falle: `pnpm --filter frontend test:e2e -- <pattern>` filtert nicht → `npx playwright test e2e/<datei>.spec.ts` im `frontend`-Verzeichnis (MEMORY 2026-08-26).
- Geolocation in E2E: bestehendes Mock-Pattern der issue-1098-Spec wiederverwenden (Position simuliern statt echter Freigabe).
- Server-seitig NICHT die Paar-Logik (lat/lon beide-oder-keine, tasks.ts:245-246) verwässern — sonst DB-Konsistenz kaputt.
