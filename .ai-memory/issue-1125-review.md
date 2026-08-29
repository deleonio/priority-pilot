# Issue 1125 (PR #1125) — Review (Kreuzverhör, Runde 1), Stand 2026-08-29

**ERGEBNIS: VERDICT needs-fixup, Ampel 🟡, genau 1 offenes Finding.** Review ohne Issue
(closingIssuesReferences = 0 — PR-Beschreibung massgebend, Folgearbeit zu #1120/#1118).
Review mit Inline-Kommentar gepostet (Review-ID 5059219432), Sammelkommentar `<!-- ai-review -->`
einmalig neu angelegt (kein Marker vorhanden → CROSS-EXAMINATION). Titel gate: konform
(`refactor(frontend): drop legacy outer sections around dashboard widget cards`), kein Rename.

## Erledigt
- MODE bestimmt: kein `<!-- ai-review -->`-Marker → CROSS-EXAMINATION; Full-Diff (6 Dateien, +227/−227) gelesen.
- Diff geprüft: Dashboard.tsx (7 Widgets: Außen-`<section>` entfernt, Klasse am KolCard-Host; next-task zieht `role="region"`+`aria-label` mit), NearbyCard.tsx (gleiches Muster, ABER ohne role/aria-label), app.css (Nachfahren-Selektoren → Host-Klassen, Gleichhöhe ab 48rem inkl. nearby, `color: var(--pp-ink)` aus `.dashboard-suggestions` entfernt), Spec-Anpassungen (empty-states, issue-1118, Dashboard.test).
- Keine stale `.dashboard-* kol-card`-Selektoren in app.css (grep belegt; nur `update-prompt kol-card` bleibt, unrelated). Grid-Margin-Reset `section.dashboard > *` greift weiter (Hosts sind direkte Kinder).
- Kontrast-Fix nachvollzogen: dark-mode-contrast.spec.ts als Absicherung akzeptiert; PR dokumentiert 102 Verstöße vor Fix.
- CI-Status: e2e/verify pending (nicht rot) — Pipeline-Gate übernimmt; kein 🟢 vergeben, ohnehin needs-fixup.

## Relevante Stellen
- `frontend/src/components/NearbyCard.tsx:95-99` — Finding 1: Host ohne `role`/`aria-label`, `_level={0}` (KoliBri-Spec: „0 specifies no heading, shown as bold text") → keine benannte Region mehr.
- `frontend/src/components/Dashboard.tsx:~181-190` — next-task-Card MIT `role="region"`+`aria-label` am Host (das Fix-Vorbild; Forwarding durch grüne Tests belegt).
- `frontend/e2e/issue-1118-dashboard-section-cards.spec.ts:114-118,152-159` — scharfe AK1-Prüfung (`section.evaluate(el => el.matches('kol-card'))`) + Region-Name-Check für next-task.
- `frontend/e2e/issue-1066-nearby-card.spec.ts:96` — `getByRole('region', { name: 'Nächste Aufgabe' })` deckt nearby-Namen NICHT; Spec fehlte in der gezielten E2E-Liste des PRs.
- `frontend/src/components/NearbyCard.test.tsx:33-34` — KolCard gemockt (`data-label`), kein a11y-Name-Assertion möglich.
- `frontend/src/app.css:505-517,578-584,625,719-733` — die umgezogenen Host-Regeln (7 Klassen), entfallene color-Regel, margin-top nearby.

## Annahmen
- Attribute-Forwarding (`role`/`aria-label`/`className`) an den KolCard-Host funktioniert im echten Browser — belegt durch issue-1118-spec (aria-label-Attribut am `.dashboard-next-task`, laut PR lokal grün); issue-1066:96 wurde im PR NICHT gezielt gelaufen (in Finding 1 moniert), sollte im Fixup-Lauf mitlaufen.
- Kontrast-Mechanik (Host-Farbe vs. Theme-Shadow-Styles) nicht selbst im Browser verifiziert — e2e dark-mode-contrast.spec.ts + visuelle Prüfung laut PR als Beleg akzeptiert.
- Verlust der alten Außen-`aria-label`s bei den übrigen 5 Sektionen als unproblematisch bewertet: `_level={3}`-Headings bleiben navigierbar (in Sammelkommentar begründet).

## Verworfen
- Weitere Findings zu Spec-Abschwächungen (`empty-states.spec.ts` prüft nur noch `.dashboard-pillars`-Sichtbarkeit; Dashboard.test-Helper akzeptiert Wrapper ODER Host) — Struktur-Schärfe liegt in issue-1118-Spec AK1, verbleibende Assertions prüfen Verhalten; kein Test-Pflege-Bedarf.
- `.dashboard-nearby`-`height:100%`-Ausweitung als Finding — im PR-Body als beabsichtigt dokumentiert („jetzt auch für In der Nähe").
- MEMORY.md-Eintrag — kein neuer Fehler/eine wiederkehrende Falle; Kriterium nicht erfüllt.
- Titel-Rename — Conventional Commits konform.

## Offen
- Finding 1 (🟡, `NearbyCard.tsx:96`): `role="region"` + dynamisches `aria-label` (Spiegel des `_label`-Ausdrucks) an den Host, Name per Test sichern (z. B. `getByRole('region', { name: /In der Nähe/ })` in issue-1066-Spec), issue-1066-Spec in gezielte E2E-Auswahl aufnehmen.
- Wegwerf-Artefakte in `.ai-memory/`, NICHT committen: `issue-1125-review-inline.md`, `issue-1125-review-summary.md`, `issue-1125-review-collected.md`. Nur diese Datei ist die Phasen-Notiz.
- CI (e2e/verify) war bei Verdict noch pending — Pipeline-Gate degradiert/verzögert entsprechend.

## Nächster Schritt
- Fixup-Runde: Finding 1 umsetzen + issue-1066-nearby-card.spec.ts gezielt laufen lassen; danach Fixup-Verifikation (MODE FIXUP VERIFICATION, Delta = Commits nach Sammelkommentar-UpdatedAt, Finding 1 abhaken).

## Fallstricke
- Fixup muss den `aria-label`-Ausdruck DYNAMISCH halten (`In der Nähe (X km)`), nicht statisch „In der Nähe" — sonst inkonsistent zum sichtbaren `_label`.
- NearbyCard.test.tsx mockt KolCard — eine aria-label-Assertion dort prüft nur den Mock; die echte Absicherung gehört in die E2E (Shadow-DOM/Host-Forwarding).
- Keine Labels setzen — Workflow macht das selbst.
