# Review PR #1013 (docs(spec): Ist-Stand-Sync 2026-08-25)

## Erledigt
- Runde 2 (2026-08-25): MODUS = FIXUP-NACHWEIS (Sammelkommentar 5404982772 vorhanden,
  updatedAt 2026-08-25T04:11:54Z). Fixup-Commit `efd9e5ee` (04:19:39Z) = einziger Commit danach.
- Finding #1 (Tab-Label-Drift) als BEHOBEN verifiziert: docs/spec/issue-951.md:7 und :20
  sagen jetzt „Tab „KI-Provider““, Label-Gegenprobe gegen SETTINGS_TABS
  (frontend/src/components/SettingsPage.tsx:27, `_label: 'KI-Provider'`) ✓.
- Fixup-Diff 2229f324..efd9e5ee adversarial geprüft: nur 2 Dateien — issue-951.md
  (Finding-Fix) + user-journeys.md (189–204, reine Prettier-Tabellen-Ausrichtung,
  kein Inhaltsdelta). KEINE neuen Probleme.
- CI auf efd9e5ee: verify pass, e2e 1–4 pass.
- Sammelkommentar 5404982772 fortgeschrieben: Status reviewed, Finding 1 in
  Behobene-Tabelle, Review-Typ Fixup-Nachweis. Titel-Gate ok (keine Umbenennung nötig).
- Verdict `reviewed` nach /tmp/claude-verdict geschrieben.

## Relevante Stellen
- docs/spec/issue-951.md — Zeilen 7, 20: Tab-Label-Stellen des fixierten Findings.
- docs/spec/user-journeys.md — ~189–204: Prettier-Ausrichtung im Fixup (CI-Fix, cosmetic).
- frontend/src/components/SettingsPage.tsx:27 — SETTINGS_TABS, Quelle des echten Labels.
- docs/server-setup.md:146 — enthält noch „Tab „LLM““ (veraltet), NICHT im PR-Diff → out of scope.

## Annahmen
- docs/server-setup.md liegt außerhalb des PR-Diffs (per git diff origin/main...efd9e5ee
  verifiziert, 0 Dateien) → alter Drift dort ist kein Finding dieser Runde.

## Verworfen
- Neues Finding für server-setup.md:146 — Datei vom PR unberührt, FIXUP-NACHWEIS prüft nur
  Fixup + neue Probleme im Fixup-Diff. Drift für einen künftigen Sync/das Ticket notiert.

## Offen
-

## Nächster Schritt
- Nichts. Review abgeschlossen (reviewed). PR kann gemergt werden.

## Fallstricke
- Review-Phase: KEIN Code ändern, KEINE Labels setzen, KEINE Commits.
- Kein Ticket-AK-Block im PR-Body — Sync-Report ist der Vertrag.
- PR-Titel wurde in Runde 1 gesetzt: „docs(spec): sync specs to actual state 2026-08-25“
  (Conventional Commits konform, keine erneute Umbenennung nötig).
- MEMORY.md-Kandidat (server-setup.md:146 „Tab „LLM““ veraltet) gehört in ein künftiges
  Ticket, nicht ins Dauergedächtnis (ticket-spezifisch).
