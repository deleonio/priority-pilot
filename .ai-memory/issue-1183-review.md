# Issue 1183 — Review (Phase 5, Kreuzverhör Runde 1), Stand 2026-09-03

**ERGEBNIS: needs-fixup (🟡).** Kein `<!-- ai-review -->`-Kommentar vorhanden → MODE Kreuzverehr (Initial). Genau 1 fixables Finding (F1, Regression außerhalb des Diffs). Review 5096450985 gepostet (Inline-Kommentar auf `frontend/src/lib/confetti.ts:85`), Sammelkommentar neu angelegt (id 5518226930). PR-Titel auf Conventional Commits umbenannt: „feat(frontend): master switch for animations (confetti default off)". Labels nicht angefasst.

## Erledigt
- MODE bestimmt (Marker-Suche leer → Kreuzverhör), Harness-Kommentar #1183 geladen (AK1–AK5, `.ai-memory/issue-1183-harness.md`), kompletter Diff gelesen (`.ai-memory/issue-1183-pr-diff.txt`, 562+/3−).
- Trennung der Pflichten verifiziert: `git diff 820dd1a2 HEAD -- <5 Testdateien>` zeigt NUR Prettier-Zeilen_umbruch, keine Assertion verändert/weggelassen.
- Blast-Radius an recherche/haiku delegiert: `launchConfetti`-Aufrufer = App.tsx:404 + **:452 (#1182-Dashboard-Pfad!)**; #1151-Reihenfolge-Test ordnungs-, nicht nachbarstellungssensitiv → Schalter-Einbau unkritisch.
- F1 verifiziert durch Lesen von `frontend/e2e/issue-1182-dashboard-confetti.spec.ts`: AK1 `:78` + AK4 `:105` erwarten Overlay, kein Key-Preset, Datei NICHT im PR-Diff → bricht mit Default aus.
- Review + Sammelkommentar gepostet, Titel-Gate ausgeführt.

## Relevante Stellen
- `frontend/src/lib/confetti.ts:85` — neues Master-Gate nach reduced-motion-Frühcheck (Anker des Inline-Findings).
- `frontend/e2e/issue-1182-dashboard-confetti.spec.ts:78,105` — die beiden brechenden Overlay-Assertionen (F1).
- `frontend/e2e/issue-1169-confetti.spec.ts` beforeEach-addInitScript — Fix-Muster für F1.
- `frontend/src/App.tsx:404,452` — beide launchConfetti-Aufrufer (Listen-Pfad + Dashboard-Dialog-Pfad), beide vom Gate erfasst (gewollt).
- Sammelkommentar id 5518226930, Review id 5096450985 — für Fixup-Runde via Marker wiederfinden.

## Annahmen
- CI-e2e-Shards waren zum Review-Zeitpunkt pending; F1 rot-Vorhersage basiert auf Codelesung (Gate-Default schlägt durch, kein Mock im 1182-Spec), nicht auf gesehener CI-Rot-Fahne.
- AK4 nur Unit-abgedeckt ist Spec-Vertrag (Test-Abdeckungstabelle in docs/spec/issue-1183.md) — kein Finding.

## Verworfen
- Weitere Findings: waitForTimeout(1_000)-Negative-Assertion im 1183-E2E (pragmatisch, Muster wie 1182-Spec), STORAGE_KEY-Literal-Duplikat in Tests (knip-konform dokumentiert), fehlende AK4-E2E (Spec-Vertrag) — jeweils kein Meldewert.
- MEMORY.md-Eintrag zum F1-Muster → DOCH aufgenommen (siehe unten), weil übertragbar auf alle Phasen mit Koppel-Symbolen.

## Offen
- F1 wartet auf Fixup (Label-Steuerung übernimmt der Workflow; ich setze keine Labels).
- Wegwerf-Artefakte NICHT committen: `issue-1183-harness.md`, `issue-1183-pr-diff.txt`, `issue-1183-review-payload.json`, `issue-1183-collected.md`. Nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- Fixup-Runde (MODE Fixup-Nachweis): nur F1 prüfen — beforeEach-addInitScript in issue-1182-dashboard-confetti.spec.ts, CI-e2e grün, dann Sammelkommentar 5518226930 updaten (F1 → „Behobene Anmerkungen", Review-Typ: Fixup-Nachweis) und VERDICT reviewed.

## Fallstricke
- Fixup darf die reduce-Ausnahme NICHT bekommen: 1182-Spec AK3 bleibt ohne Key-Preset-Veränderung nötig? Nein — AK3 braucht kein Key-Preset (erwartet kein Overlay), aber das neue beforeEach gilt auch für AK3; harmlos, da reduce ohnehin unterdrückt. Aussage im Sammelkommentar ist korrekt.
- Sammelkommentar UPDATEN (PATCH auf 5518226930), nicht neu anlegen; Finding-Nummer F1 stabil halten.
- Keine Labels setzen (Workflow-Automatik).
- Review-Inline-Kommentar kann in der Fixup-Runde nicht „getickt" werden — Fortschritt nur im Sammelkommentar führen.

---

# Runde 2 — Fixup-Nachweis, Stand 2026-09-03

**ERGEBNIS: reviewed (🟢).** Marker vorhanden (Kommentar 5518226930, updatedAt 2026-09-03T00:02:38Z) → MODE Fixup-Nachweis.

## Erledigt (R2)
- Delta seit updatedAt: 8239cf75 (Fix) + 7047043a (Merge main: nur renovate/pnpm-Sync, kein PR-Inhalt) + 2 memory-Commits.
- F1 als behoben verifiziert: neues `test.beforeEach` in `frontend/e2e/issue-1182-dashboard-confetti.spec.ts:74` setzt `pp-animations-enabled='true'` per `addInitScript` — identisches Muster wie `issue-1169-confetti.spec.ts:61`; einziges beforeEach im Describe (deleteAllTasks bleibt afterEach :64); AK3 (reduce, :92) korrekt ohne Ausnahme.
- Keine neuen Findings im Delta; CI pending (nicht rot), Pipeline-Gate prüft separat.
- Sammelkommentar 5518226930 in-place aktualisiert (F1 → Behobene-Tabelle, Status reviewed, Review-Typ: Fixup-Nachweis). Labels nicht angefasst. Titel-Gate: konform (68 Zeichen), kein Rename.

## Nächster Schritt (R2)
- Keiner für Review-Phase — Workflow übernimmt Merge-Steuerung (CI muss noch grün laufen).

## Fallstricke (R2)
- e2e/verify-Shards waren bei Verdict noch pending — falls CI rot läuft, degradiert das Pipeline-Gate automatisch auf ai:needs-changes; kein Anlass hier vorbeugend needs-fixup.

---

# Runde 3 — Fixup-Nachweis, Stand 2026-09-03

**ERGEBNIS: reviewed (🟢).** Marker vorhanden (5518226930, updatedAt 2026-09-03T00:29:34Z) → MODE Fixup-Nachweis. Titel-Gate: konform (68 Zeichen), kein Rename.

## Erledigt (R3)
- Delta seit R2: 6f8005fc + ad65ed37 (memory-Commits, kein PR-Inhalt) + **52920dc8** (einziger Inhalts-Commit: `frontend/e2e/settings-switch-layout.spec.ts`, +9/−9 Anpassung #971-E2E auf 3 Switch-Zeilen).
- Fixup verifiziert: `SettingsPage.tsx` Tab „Allgemein“ hat 3 `.settings-switch-row` (:250 Sprachaufnahme, :271 Animationen, :285 Push) → Counts 2→3 in AK1–AK3 korrekt; keine 2er-Assertionen übrig; keine Assert-Abschwächung; Test-Pflege durch Anforderungsänderung #1183 legitim (Begründung in Commit-Msg, CI-Shard-4-Rot).
- CI: e2e (1)–(4) + verify grün (Run 33700941047).
- Sammelkommentar 5518226930 per PATCH + jq-Payload aktualisiert (Status reviewed, Runde-3-Nachweis; Behobene-Tabelle unverändert F1). Payload via `jq -Rs` — `-F body=@file` scheiterte mit HTTP 422.

## Relevante Stellen (R3)
- `frontend/e2e/settings-switch-layout.spec.ts:151-159` — AK5 prüft nur 2 Labels, Titel sagt „3 Switches“, Kommentar :159 veraltet — NICHT blockend, im Sammelkommentar ohne Fix-Zwang vermerkt.
- `frontend/e2e/issue-1183-animations.spec.ts:17` — Rollenadressierbarkeit des Animationen-Schalters (deckt AK5-Lücke).

## Verworfen (R3)
- Finding gegen AK5-Kommentar-Staleness → nur dokumentarisch (#1151-Altlast), ein Fixup-Rundtrip dafür unverhältnismäßig; im Sammelkommentar als Beobachtung festgehalten.

## Offen (R3)
- Wegwerf-Artefakte NICHT committen: `issue-1183-collected-r3.md` (neu, dieser Runde).

## Nächster Schritt (R3)
- Keiner — Workflow übernimmt Merge-Steuerung (CI grün, Verdict reviewed).

## Fallstricke (R3)
- gh-PATCH mit mehrzeiligem Body: `--input` + `jq -Rs '{body:.}'`-Datei nehmen, nicht `-F body=@file` (422).
