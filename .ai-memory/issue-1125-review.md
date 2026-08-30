# Issue 1125 (PR #1125) — Review (Runde 1 Kreuzverhör + Runde 2 Fixup-Nachweis), Stand 2026-08-30

**ERGEBNIS (Runde 2): VERDICT reviewed, Ampel 🟢.** Runde 1 (2026-08-29): needs-fixup/🟡,
1 Finding (NearbyCard-Region), Review ohne Issue (closingIssuesReferences = 0 — PR-Beschreibung
massgebend, Folgearbeit zu #1120/#1118). Runde 2 (dieser Lauf): Marker vorhanden → MODE FIXUP
VERIFICATION; Delta-Review nur über die Commits nach Sammelkommentar-Update
(2026-08-29T22:09:13Z) = `8cb3de25` (Leer-Commit, Pipeline-Re-Arm, 0 Dateien). Kein offenes
Finding, keine Entscheidungs-Findings → Sammelkommentar 5464954841 auf `reviewed` gepatcht,
Footer `Review-Typ: Fixup-Nachweis`, Updated 2026-08-30. Titel unverändert konform
(`refactor(frontend): drop legacy outer sections around dashboard widget cards`), kein Rename.

## Erledigt
- Runde 1: Full-Diff gelesen, 1 Inline-Finding (Review-ID 5059219432), Sammelkommentar neu angelegt.
- Fixup (Phase 7, Commits `482aa826` + `cb5a5d1b`) von Runde 2 nur verifiziert, nicht neu geprüft:
  `frontend/src/components/NearbyCard.tsx:38,98-101` (`cardTitle` als einzige Quelle, Host mit
  `role="region"` + `aria-label={cardTitle}`) und `frontend/src/components/Dashboard.tsx:183-184,216-217`
  (next-task + suggestions als benannte Regionen) am Head `8cb3de25` nachgelesen.
- Tree-Diff `cb5a5d1b..8cb3de25` = nur `.ai-memory/issue-1125-fixup.md` (+27/−1) → Produktions-/Testcode
  identisch zum Stand mit komplett grüner CI (e2e 1–4 + verify laut Fixup-Notiz/Run 33277220502).
- CI am Head re-ausgelöst und pending (nicht rot) — 🟢 trotz pending vertretbar: Code unverändert,
  Pipeline-Gate degradiert bei Rot auf ai:needs-changes.
- Sammelkommentar-Body nach `.ai-memory/issue-1125-review-round2.md` gestaged und per
  `gh api --method PATCH issues/comments/5464954841 -f body="$(cat …)"` gelandet (verifiziert).

## Relevante Stellen
- `frontend/src/components/NearbyCard.tsx:38,98-101` — Finding-1-Fix (dynamischer Regionsname).
- `frontend/src/components/Dashboard.tsx:183,216` — Vorbild-/CI-Followup-Regionen.
- `frontend/e2e/issue-1066-nearby-card.spec.ts` + `issue-1118-dashboard-section-cards.spec.ts` — E2E-Absicherung.
- Sammelkommentar-ID 5464954841 — weitere Runden PATCHen, nicht neu anlegen.

## Annahmen
- CI wird auf `8cb3de25` grün (Code identisch zu `cb5a5d1b`, dort grün; zwei dokumentierte Flakys
  in PR-unberührten Specs möglich).
- Attribut-Forwarding an KolCard-Hosts im echten Browser — durch grüne Region-Assertions der
  issue-1066/1118-Specs belegt.

## Verworfen
- Erneutes Full-Diff-Review — MODE FIXUP VERIFICATION, Diff-Scoping greift.
- Neue Findings am Leer-Commit/Delta — keine Code-Änderung vorhanden.
- MEMORY.md-Eintrag — kein neues/wiederkehrendes Fehlermuster; Kriterium (streng) nicht erfüllt.

## Offen
- Wegwerf-Artefakte in `.ai-memory/`, NICHT committen: `issue-1125-review-round2.md`
  (Body-Staging), ggf. Reste aus Runde 1 (`issue-1125-review-{inline,summary,collected}.md`).
  Nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- Keiner für die Review-Phase: reviewed emittiert. Pipeline übernimmt Merge-Gate (CI grün abwarten).

## Fallstricke
- `gh api --input -` mit leerem Body-Feld → HTTP 422 (Validation Failed); Body stattdessen per
  `-f body="$(cat Datei)"` übergeben.
- Sammelkommentar nicht neu anlegen; Labels nicht setzen (Workflow).
- Weitere Runden: Finding-Nummern stabil halten (aktuell nur F1, behoben).
