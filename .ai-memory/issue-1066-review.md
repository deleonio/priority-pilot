# Issue 1066 — Review-Phase (2026-08-28, Fixup-Nachweis Runde 3: needs-fixup wegen neuem N1)

## Erledigt
- MODE = Fixup Verification (Marker-Kommentar 5447797272 existierte, Runden 1+2 davor).
- Fixup-Delta `bbe80cf1..63c7cb62` geprüft (eigene Commits: c0735603 F1–F5, bdcbeb4a F1-Test, 63c7cb62 Timeout; Rest kam per Main-Merge 9cb51b81 → nur die 7 PR-Dateien reviewed).
- F1 verifiziert: `server/src/express/routes/tasks.ts` validateTaskFields + `series.ts` validateSeriesFields — Paar-Block (`lat !== null && lon !== null ? … : null`), undefined-zählt-als-null; Test „PATCH nur {latitude:null}" in `server/src/express/tasks-coordinates.test.ts:74-83` vorhanden.
- F4 verifiziert: `parseCoord` in tasks.ts nearby-Handler (nur nicht-leere Strings → Number, sonst NaN → 400; Arrays/leer abgedeckt).
- F5 verifiziert: 6 OpenAPI-Description-Zeilen (~1915–2054) jetzt „Serien-Orts".
- F2 verifiziert: `useGeolocation.ts` — `unavailable` State (Interface:48, useState:74, Return:254), catch unterscheidet code 1 vs 2/3; NearbyCard denied-Zweig 3 Bedingungen.
- F3 verifiziert: `GeoBadge.tsx` — `inflight`-Map serialisiert, Fehler wird als ADDRESS_UNAVAILABLE in addressCache gecacht.
- **N1 gefunden** (neu, Inline-Kommentar 3877951225): `timedOut` in `frontend/src/components/NearbyCard.tsx:30-42` ist Dead State — wird NIE im JSX gelesen (denied-Zweig Zeile 71 ohne timedOut); Commit 63c7cb62 „Timeout auf denied nach 1s (CI-Race Condition)" erfüllt Zweck nicht.
- Sammelkommentar 5447797272 per PATCH aktualisiert: F1–F5 in „Behobene Anmerkungen", N1 offen, Review-Typ Fixup-Nachweis.
- TITLE GATE: „feat(frontend): add nearby card with geo-distance task list" — Conventional Commits konform, kein Rename nötig.

## Relevante Stellen
- `frontend/src/components/NearbyCard.tsx:34,71` — N1: Effect setzt timedOut, Render-Zweig 71 liest ihn nicht.
- `.ai-memory/issue-1071-review-comment.md` — lokale Kopie des Sammelkommentar-Bodys (Body-Datei für PATCH).
- CI-Run 33142299869 (4/6 Umsetzung) auf 63c7cb62 war bei Review-Ende pending; Run 33138568291 auf c0735603 scheiterte im Claude-fixup-Job (Agent-Job, kein E2E-Beweis).

## Annahmen
- F1-Semantik „undefined zählt als null" ist die dokumentierte Fixup-Annahme (nur-{longitude}-Senden nullt latitude) — akzeptiert, Frontend sendet immer beide.
- Keine weiteren neuen Probleme im Main-Merge-Anteil des Deltas (nur CI/Docs-Dateien, nicht PR-spezifisch).

## Verworfen
- OpenAPI-Wortlaut „fehlt das Feld, bleibt er unverändert" vs. F1-Paar-Normalisierung als Finding — zu kosmetisch, Vorläuferwortlaut, Frontend-Vertrag unberührt.

## Offen
- N1 (🟡): timedOut wired oder entfernt — nächster Fixup.
- CI-Ergebnis auf 63c7cb62 nach Review-Ende unbeobachtet.

## Nächster Schritt
- Fixup-Runde: N1 beheben (timedOut in Zeile 71 aufnehmen ODER Effect+State entfernen), dann Review Runde 4.

## Fallstricke
- Fixup-Delta enthält Main-Merge-Rauschen (workflows/ADR/Skills) — diff auf die 7 PR-eigenen Dateien stutzen.
- GitHub-Job-Logs brauchen `--allow-escape-sequences` + ANSI-Strip per sed, sonst kommt „terminal escape sequences"-Fehler bzw. unlesbarer Output.
