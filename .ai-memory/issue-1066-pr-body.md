Closes #1066

Rote Spec-Tests (TDD-Trennung der Zuständigkeiten); Implementierung folgt in Phase 4.
Spec: `docs/spec/issue-1066.md` (im selben Commit, inkl. KI-UX-Entscheidungen: Card ohne
Adressspalte, Koordinaten niemals im aria-label, vier gestaltete Card-Zustände).

## Abgedeckte AKs

- AK1 — Koordinaten-Persistenz (POST/PATCH/GET, Leeren → beide NULL, Bereichsvalidierung): `server/src/express/tasks-coordinates.test.ts`
- AK10 — Freitext-Adresse ohne Vorschlags-Auswahl bleibt speicherbar, keine Koordinate: `tasks-coordinates.test.ts` + Frontend-Teil in `frontend/src/lib/useAddressSearch.test.ts` (Vorschläge tragen `{address, lat, lon}`)
- AK2/AK3/AK7 — `GET /tasks/nearby` (max. 10, aufsteigend, `distanceKm` 1 Nachkommastelle, 401 ohne Session, Datenisolation): `server/src/express/tasks-nearby.test.ts`
- AK6 — Koordinaten-Snapshot in `generateDueInstances` (inkl. Snapshot-Stabilität bei Template-Änderung): `server/src/logics/series.test.ts`
- AK2/AK4/AK5/AK8/AK9/AK11 — Card-Zustände, 375px, Präferenz-aus, Leerzustand, GeoBadge-Label: `frontend/e2e/issue-1066-nearby-card.spec.ts`

Rot-Status verifiziert: Nearby-Endpoint 404 (Test-Run), `useAddressSearch`-Assertion rot (4 bestehende Tests der Datei bleiben grün), Server-tsc ohne Fehler in den neuen Dateien.

## Offene Fragen

- AK11 in der Card selbst ist nach KI-UX-Entscheidung **kein** UI-Fall (Card zeigt bewusst keine Adresse — Datensparsamkeit): getestet wird der Reverse-Geocoding-Vertrag am `GeoBadge` (keine Rohkoordinaten im `aria-label`, Fehlschlag degradiert). Falls die Adresse doch in der Card landen soll, braucht es einen zusätzlichen Test.
- AK5 „Position wird erst nach Freigabe abgefragt" wird über AK8 (`__geoCalls === 0` bei Präferenz aus) und die Mock-Init-Scripts abgedeckt; ein dedizierter „kein Prompt vor Card-Render"-Test wäre nur mit UI-Reaktionszeit-Mocking unterscheidbar — nicht abgedeckt.
- Wortlaut der Leer-/Hinweistexte: Vertrag sind die `data-testid`s (`nearby-empty`, `nearby-denied`, `nearby-preference-off`), nicht die Texte.

## Test-Pflege-Bedarf

- keins (kein bestehender Test widerspricht den neuen AKs)

## Hinweise für Phase 4

- `server tsc --noEmit` ist auf einem frischen Checkout bereits ohne diese Änderung rot (generierte `src/api.ts` fehlt bis zum Codegen-Schritt) — vorbestehend, kein Fix-Ziel der Spec-Phase.
- Umgebungslimit (Memory 2026-08-27): `server/src/express/session.test.ts` braucht Redis; lokal rot, in CI (Service-Container) grün.
