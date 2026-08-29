# Issue 1111 — Triage (Phase 1), Stand 2026-08-29T06:26:29Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein KI-ANALYSE-Block; einziger Kommentar = github-actions-Qualitätscheck 2026-08-29T05:49:32Z, keine Entscheidung). Analyse-Block + Routing-Tabelle in den Body angehängt, Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt (ux=ja — neue sichtbare UI-Komponente, Präzedenz #1083). Kein Ping-Kommentar, kein Titel-/Body-Copyedit (Issue exzellent strukturiert, Messkriterien = AKs), kein Split (eine Komponente + Tests = ein PR), kein Auto-Close (Box existiert nicht im Code).

## Erledigt
- Issue geladen, Trigger = Initial-Triage bestimmt, Body vollständig analysiert (AK1–AK7 direkt aus den Messkriterien abgeleitet).
- Code-Recherche via recherche-Subagent + eigene Verifikation (sed/grep) der Zeilenreferenzen.
- Body-Append per `.ai-memory/issue-1111-{cur,block,new}.md` + `gh issue edit --body-file`; Landing verifiziert (Tail = ai-phase-routing:END).
- Labels gesetzt, Endstand verifiziert: `["ai:needs-ux-ui","ai:analysed"]`.

## Relevante Stellen
- `frontend/src/components/TaskForm.tsx:293-296` — `applyAddressCoords` schreibt lat/lon NUR in `form.current`-Ref, kein State → Ursache der Unsichtbarkeit; hier State-Spiegel ergänzen.
- `frontend/src/components/TaskForm.tsx:949-965` — Adressblock: `AddressAutocomplete` mit `onValueChange` (löscht lat/lon auf null bei Freitext, :954-958 — passt schon zu AK4/AK5) + `onSelect` ( setAddress + applyAddressCoords); Box DARUNTER rendern.
- `frontend/src/components/TaskForm.tsx:262-263` — Initialisierung `task?.latitude ?? series?.latitude` — Quelle für AK2 (Box sofort beim Öffnen); Task- UND Serie-Modus teilen denselben Block.
- `frontend/src/components/TaskForm.tsx:607-608,622-623` — Submit-Payload-Feldnamen `address`/`latitude`/`longitude` (create+update, Task+Series) — unverändert.
- `frontend/src/components/AddressAutocomplete.tsx:105-113` — `KolInputText` ohne `_type`-Durchreichung; Props-Interface :16-23 (`onSelect(suggestion: AddressSuggestion)` mit `{address,lat,lon}`).
- `frontend/src/components/SearchModal.tsx:58` — `KolInputText _type="search"` = Präzedenz, dass die Prop existiert (Subagent widersprach sich selbst; per grep verifiziert — _type geht durch).
- `frontend/src/components/TaskForm.tsx:940-944` — `KolAlert _type="info"` als Hinweis-Baustein-Vorbild; `Dashboard.tsx:178-179` — `role="region"` + `aria-labelledby` für AK7-Gruppierung.
- Tests: `frontend/src/components/TaskForm.test.tsx:1377-1447` (Adress-Tests + #1083-AK6-Treffer-Test, Mock-Setup :19-157), `frontend/e2e/issue-1061-task-address.spec.ts` (page.route-Stub für /api/v1/geocode-search, getByLabel('Adresse (optional)') :44), neu `AddressAutocomplete.test.tsx` (TF6) + `issue-1111-coords-box.spec.ts` (TF7).

## Annahmen
- Box zeigt in Task- UND Serie-Modus (Messkriterien nennen „Task bzw. Serie" explizit — kein eigener AK nötig, in Randbedingungen verankert).
- „Die Box entspricht dem, was an die API geht" = Ref-Werte zum Submit-Zeitpunkt (form.current) — Box muss dem State-Spiegel folgen, nicht umgekehrt.
- ux ja/sonnet/medium nach etabliertem Muster (#1083: neue sichtbare UI-Liste → ux-Lauf; hier neue Box + ARIA-Frage).

## Verworfen
- Titeländerung — „Aufgabenformular: aufgelöste Koordinaten nach der Adresssuche sichtbar machen" trifft exakt.
- Body-Copyedit — Issue präzise strukturiert; pro-forma-Edit verboten.
- Split — Frontend-only, ein zusammenhängender AK-Satz, ein PR.
- needs-human — keine Unklarheit; alle Messkriterien verifizierbar, Code-Lage eindeutig.
- MEMORY.md-Eintrag — kein neues Fehlermuster, Kriterien nicht erfüllt.

## Offen
- Wegwerf-Artefakte untracked in `.ai-memory/`, NICHT committen: `issue-1111-body.md`, `issue-1111-cur.md`, `issue-1111-block.md`, `issue-1111-new.md`. Nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- UX-Phase (Label `ai:needs-ux-ui` gesetzt): advisory-Review der Box (Platzierung, Beschriftung Breitengrad/Längengrad/Adresse, „keine Koordinaten"-Wortlaut, ARIA-Gruppierung, 375px-Umbruch); danach Spec gemäß Routing-Tabelle.

## Fallstricke
- Routing-Tabelle im Body (ux ja/sonnet/medium, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high) ist für Folgephasen bindend.
- Koordinaten als React-State spiegeln, NICHT den Ref abschaffen — Submit liest `form.current`; State nur für die Anzeige (Muster-Kommentar TaskForm.tsx:289-292, KolInputRange-Falle).
- TaskForm-Test-Mock ersetzt KoliBri durch natives HTML — für TF6 muss der Mock `_type` an das native input weitergeben, sonst Test aus dem falschen Grund grün/rot.
- #1083-Tests (TaskForm.test.tsx:1406-1447) und issue-1061-e2e nicht rot machen; getByLabel('Adresse (optional)') muss weiter funktionieren (Label unverändert lassen).
- TF7: Bounding-Box-Assertions statt scrollWidth (App-Shell clippt overflow-x:hidden, MEMORY 2026-08-24); E2E-Filter-Falle: `npx playwright test e2e/<datei>.spec.ts` im frontend-Verzeichnis (MEMORY 2026-08-26).
- Box darf KEINE eigenen Geocoding-Requests auslösen (geteilter 1-req/s-Limiter, #1083-Kommentar im Code).
