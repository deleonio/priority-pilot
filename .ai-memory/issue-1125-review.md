# Issue 1125 (PR #1125) — Review (Runde 1–3, ABGESCHLOSSEN), Stand 2026-08-30T07:19Z

**ERGEBNIS (Runde 3): VERDICT reviewed, Ampel 🟢, MODE FIXUP VERIFICATION.** Review ohne Issue
(closingIssuesReferences = 0 — PR-Beschreibung massgebend, Folgearbeit zu #1120/#1118).
Runde 1: needs-fixup (F1 NearbyCard-Region, behoben `482aa826`; Follow-up `cb5a5d1b`
suggestions-Region). Runde 2: reviewed/🟢 am `8cb3de25`. Runde 3 (dieser Lauf): Delta
`64f95b59` (Merge main, keine Frontend-Datei) + `30f7f925` (nur app.css) verifiziert, keine
neuen Findings → Sammelkommentar 5464954841 auf Runde 3 gepatcht (Footer Fixup-Nachweis).

## Erledigt
- Delta-Scoping: `git diff 8cb3de25..64f95b59 -- frontend/` = leer; Fixup-Commit-Own-Diff
  `30f7f925^..30f7f925` = nur `frontend/src/app.css` (+13/−18).
- CI am Head `30f7f925` (Run 33298641560): e2e (1)–(4) + verify alle pass.
- 2 Haiku-Recherchen: (a) Theme-Quelltext in Sandbox nicht prüfbar (keine node_modules,
  kein gebundeltes Theme-CSS im Repo) — Anspruch „Theme liefert width/height am Host" nur
  empirisch abgedeckt, siehe Annahmen; (b) E2E-Deckung: AK5-Gleichhöhe
  `issue-1118-dashboard-section-cards.spec.ts:175-219` (Host-Rects je Grid-Zeile, 1280px),
  Struktur `.dashboard-pillars-list` im Card-Content-Slot `Dashboard.tsx:270`, kein Test
  referenzierte entfernte Host-Eigenschaften.
- Sammelkommentar per `-f body="$(cat .ai-memory/issue-1125-review-round3.md)"` gepatcht
  (verified: updated_at 2026-08-30T07:19:38Z). Titel konform, kein Rename. Keine Labels.

## Relevante Stellen
- `frontend/src/app.css` (Head `30f7f925`): Widget-Host-Regeln ~499-530 (nur noch
  `display: block`), Grid >=48rem ~700-730 (align-items: stretch, height-Block entfernt),
  pillars-list ~775-790 (AK4-Überlaufschutz neu hier).
- `frontend/e2e/issue-1118-dashboard-section-cards.spec.ts:175-219` — AK5-Gleichhöhe-E2E.
- `frontend/src/components/Dashboard.tsx:270` — `.dashboard-pillars-list` im Card-Slot.
- Sammelkommentar-ID 5464954841 — weitere Runden PATCHen, nicht neu anlegen.

## Annahmen
- Gleichhöhe ohne explizites Host-`height: 100%` gilt wegen `align-items: stretch` (Grid)
  unabhängig vom Theme — belegt durch grüne AK5-E2E am Head; das Theme-CSS selbst war in der
  Sandbox nicht lesbar (keine node_modules).
- Dashboard-Pillars-Overflow (AK4 #440) hat praexistent KEINE eigene E2E (Settings-Seite
  testet `pillar-dynamic-cases.spec.ts:270-286`, Dashboard nicht) — vom PR nicht verschärft.

## Verworfen
- F2/F3 als neue Finding-Nummern für `cb5a5d1b`/`30f7f925` — waren keine Review-Findings,
  sondern Fixup-/CI-Selbstfund; Prosa-Vermerk statt Tabellenzeile (Präzedenz Runde 2).
- MEMORY.md-Eintrag — kein neues Fehlermuster; Ping-Pong-Guard (#961) ist Workflow-known.

## Offen
- Wegwerf-Artefakte in `.ai-memory/`, NICHT committen: `issue-1125-review-round2.md`,
  `issue-1125-review-round3.md` (Body-Staging). Nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- Keiner für die Review-Phase: reviewed emittiert; Pipeline übernimmt Merge-Gate.

## Fallstricke
- `gh api --input -` mit leerem Body-Feld → HTTP 422; Body per `-f body="$(cat Datei)"`.
- Sammelkommentar nicht neu anlegen; Labels nicht setzen; Finding-Nummern stabil (nur F1).
- Sandbox ohne node_modules: Theme-Aussagen nur via E2E/CI belegbar, nicht per Quelltext.
