# Issue 1243-Kontext / PR 1243 — Review (Kreuzverhör, Runde 1), Stand 2026-09-05

**ERGEBNIS: VERDICT needs-human (🟡).** Mode Kreuzverhör (kein `<!-- ai-review -->`-Marker, keine `<!-- ai-fixup-decisions -->` vorhanden). Review ohne Issue (`closingIssuesReferences` leer) → PR-Beschreibung = massgebende Spezifikation. Sammelkommentar einmalig angelegt (issuecomment-5555626197, Marker + Struktur), Inline-Review 5123489032 (event=COMMENT, 3 Kommentare) gepostet, Titel-Gate ausgeführt (Rename auf `feat(frontend): apply master-detail settings pattern with KolDetails`). Soft-Deadline lief beim Posten ab — Analyse war zu diesem Zeitpunkt bereits vollständig; alles gepostet, nur der e2e-Re-Run ist noch offen zu beobachten.

## Erledigt
- Vollständigen Diff gelesen (10 Dateien, +178/−39): SettingsPage.tsx (3× KolDetails `_open={master}`), app.css, 2 E2E-Specs, Spec-Docs 1080/1098, Pattern-Doku neu.
- CSS-Parität verifiziert: `.settings-llm-switch-row--sub` (app.css:1852, 1.25rem / 2.5rem@768) identisch zu `.settings-switch-row--sub` (app.css:1800/1811). ✓
- `animationsEnabled`-Default geprüft: **false** (`src/lib/animations.ts`, localStorage `pp-animations-enabled`) — deshalb funktioniert `settings-switch-layout.spec.ts:134` (manueller Öffnen-Klick) weiter, frisches Profil → Details zu.
- CI-Flake `e2e (3)`/issue-969.spec.ts:86 (AK4, box null nach erfolgreichem poll→requery) als dokumentierte Flake-Klasse eingeordnet (Test-Kommentar Fixup #1233); Bot-Kommentar 23:46Z kündigt Re-Run an. Kein Diff-Bezug (PR ändert Panel-Inhalt, nicht KolTabs-Mount).
- PR-Timeline: deleonie hat den Titel selbst umbenannt (23:31Z, von fix(settings)-Titel auf feat(settings)-Pattern-Titel inkl. „Standort") und ready_for_review gesetzt — Kenntnis des Scopes wahrscheinlich, aber kein on-platform Beleg der behaupteten „Abstimmung".

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx:384` — Animations-KolDetails `_open={animationsEnabled}`: Kernverhalten OHNE Sync-Test → Finding 1 (fixbar, Blocker; Inline-Kommentar dort).
- `frontend/src/components/SettingsPage.tsx:595` — Standort-KolDetails `_open={geoEnabled}`: Revision von #1098 AK3 → Finding 2 (Entscheidung, Optionen 2.1/2.2, Empfehlung 2.1 im Sammelkommentar).
- `frontend/e2e/settings-switch-layout.spec.ts:275-300` — AK8 testet nur manuelles Auf-/Zuklappen + default-closed; hier gehört der Master-Toggle-Test hin (Finding 1).
- `docs/ux-pattern-master-detail-settings.md:63` — unbelegte Adapter-Diffing-Behauptung (Nit).
- `frontend/e2e/issue-1098-geo-settings.spec.ts:92` — neue AK1/AK3: zu → hidden + `_disabled`-Attribut; auf → sichtbar + ≥44px nach Animations-Poll. Konsistent mit visibility:hidden-Kollaps (Box messbar, Rolle weg).

## Annahmen
- Issue-969-Flake nicht diff-verursacht; falls der angekündigte Re-Run wieder rot ist → als Regression NEU bewerten.
- „Abstimmung" (PR-Body) vermutlich off-platform in der Owner-gesteuerten Claude-Session (claude.ai-Link im Body) — deshalb Empfehlung 2.1 statt Willkür-Verdacht.
- KoliBri-React-Adapter-Diffing in dieser Sandbox nicht prüfbar (keine node_modules) → Nit, kein Defekt.

## Verworfen
- needs-fixup als Verdict — Finding 2 (Revision dokumentierter Autorenwahl #1098 AK3 bei Auto-Merge ohne menschliches Tor) verlangt needs-human; Finding 1 erledigt derselbe Fixup nach der Antwort.
- e2e-Fehler als Blocker — Flake-Klasse dokumentiert (#1233), Re-Run angekündigt.
- 375px-Finding für KI-/Animations-KolDetails — Pattern via Geo-Spec bei 375px geprüft; Änderung ist reines Wrapping im bestehenden Layout.

## Offen
- Fixup nach menschlicher Optionwahl (2.1/2.2): Finding 1 (AK8-Master-Toggle-Test) + optional Nit (Doku abschwächen) + Umsetzung der gewählten Option.
- e2e-Re-Run von Run 33999342831 beobachten (nur falls wieder rot: Neu-Bewertung).
- Wegwerf-Artefakte NICHT committen: `.ai-memory/issue-1243-comment.md`, `.ai-memory/issue-1243-review-payload.json`. `rm` braucht Freigabe (Muster früherer Phasen).

## Nächster Schritt
- Fixup-Verifikation (MODE FIXUP VERIFICATION): `<!-- ai-fixup-decisions -->`-Kommentar als Claim-Checkliste nehmen, Findings 1/2 gegen den Fixup-Diff abhaken; Sammelkommentar per PATCH aktualisieren (issuecomment-5555626197) — „✅ Behobene Anmerkungen"-Tabelle führen, Option-IDs (2.1/2.2) und Finding-Nummern stabil lassen.

## Fallstricke
- Sammelkommentar existiert jetzt genau 1× — keinen zweiten Marker-Kommentar erzeugen.
- Finding-Nummern stabil: 1 = Sync-Test, 2 = AK3-Revision (Optionen 2.1/2.2), Nit = Adapter-Behauptung (doc:63). Nicht umbenennen.
- Titel per Gate umbenannt; falls der Owner erneut umbenennt, Gate nicht erneut erzwingen (Owner-Wunsch > CI-Konvention).
- Review ohne Issue: keine AK-Verifikation gegen Issue-Body möglich; PR-Beschreibung bleibt auch in Folge-Runden massgeblich (Zeile 2 des Sammelkommentars).
