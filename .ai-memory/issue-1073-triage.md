# Issue 1073 — Triage (Re-Triage)

## Erledigt
- Re-Triage abgeschlossen (2026-08-27): Body auf Ticket-Template umstrukturiert (4 Abschnitte: Was ist das Problem? / Wie soll es sein? / Wo tritt es auf? / Woran messen wir das?) — Grund: ai-quality-Bot-Kommentar 2026-08-27T20:11:54Z (Delta seit stand=2025-01-17) bemängelte fehlende Template-Abschnitte
- Analyseblock erneuert (stand=2026-08-27T20:20:00Z, Ampel 🟢), Routing-Tabelle auf kanonisches 4-Spalten-Format (Phase|Run|Modell|Effort) umgestellt — alte Tabelle hatte zusätzliche "UI-Bezug"-Spalte
- Routing-Tabelle als eigener ai-phase-routing-Block NACH KI-ANALYSE:END platziert (Skill-Template)
- Labels: `ai:analysed` + `ai:needs-ux-ui` gesetzt, `ai:needs-analyse` entfernt
- Kein Ping-Kommentar (eindeutiges Ergebnis 🟢)
- Body-Datei: `.ai-memory/issue-1073-body.md` (via `gh issue edit --body-file`)

## Relevante Stellen
- `frontend/src/components/Footer.tsx:3-16` — Footer-Komponente; rendert aktuell Koordinaten (`position.latitude/longitude.toFixed(4)`) + `Version {version}`, hat `role="contentinfo"` (Zeile 7); nutzt `useGeolocation()` nur mit `enabled`+`position`
- `frontend/src/lib/useGeolocation.ts:51,73-74,247` — Hook liefert `address: string | null` (Reverse Geocoding via Nominatim, `.reverseGeocode()` Zeile 167); Dedup/Rate-Limit-Schutz vorhanden
- `frontend/src/App.tsx:713` — `<Footer version={APP_VERSION} />`
- `frontend/src/components/Footer.test.tsx` — existiert, um AK4/AK5 zu erweitern
- `frontend/e2e/footer-version.spec.ts` — existierender Footer-e2e als Namensvorbild; neue Spec: `issue-1073-footer-address.spec.ts`

## Annahmen
- Separator " | " (in AK3 verankert, Issue-Text sagt nur "geeigneter Separator")
- Fallback auf Koordinaten wenn `address` null/leer (in Analyse als Randbedingung festgehalten)

## Verworfen
- Titeländerung — "Fußbereich: Adresse statt Koordinaten anzeigen" ist zutreffend
- needs-human — keine Mehrdeutigkeit; Bot-Kommentar war Template-Feedback, kein Fachentscheid
- Autonomes Schließen — Anforderung im Code nicht erfüllt (Footer.tsx zeigt Koordinaten, keine Adresse)

## Offen
- -

## Nächster Schritt
- UX-Phase (`ai:needs-ux-ui` gesetzt): KI-UX-Block schreiben, dann Spec-Phase

## Fallstricke
- Routing-Tabelle muss ASCII pur bleiben (keine Umlaute) — wird von `resolve-phase-routing.sh` geparst
- `address` kann null sein (Rate-Limit) — Fallback nicht vergessen, e2e muss beide Fälle mocken
- Body-Updates via `--body-file` mit Datei unter `.ai-memory/` (Bash-Tool-Heredoc-Parser-Problem)
