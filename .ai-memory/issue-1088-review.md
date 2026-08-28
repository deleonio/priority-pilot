# Review PR #1088 (docs(spec): Ist-Stand-Sync 2026-08-28) — Kreuzverhör Runde 1

## Erledigt
- MODE bestimmt: kein `<!-- ai-review -->`-Kommentar auf PR 1088 → Kreuzverhör (Erstreview).
- Vollständigen Diff gelesen (628 Zeilen, 17 Dateien, +124/−94, nur `docs/spec/*.md`).
- Kein Closing-Issue (`closingIssuesReferences.length == 0`) → „Review ohne Issue - PR-Beschreibung ist massgebend".
- 14 Claim-Cluster des PR-Bodys gegen Code verifiziert — ALLE bestätigt:
  - issue-619: `DATABASE_STORAGE` in `server/src/database.ts:3`, `server/src/index.ts:116-123` ✅
  - issue-1058 Zeilenrefs: `TaskForm.tsx:328`, `QuickCaptureModal.tsx:51`, `SearchModal.tsx:23-29` ✅
  - issue-1067 Zeilenrefs: `App.tsx:568` (slot tab-1), `:585` (task-filter-search__field), `:692-701` (onSearch) ✅
  - issue-1063: TaskTree-GeoBadge real, `TaskTree.tsx:109` (Bedingung `latitude != null || address != null`) ✅
  - issue-1066: Paar-Normalisierung `tasks.ts:242-243` (ein Wert fehlt → beide NULL), `DataTypes.FLOAT` (`models/task.ts:119ff`), `Standort: <Adresse>`/`Adresse nicht verfügbar` (`GeoBadge.tsx:89`, `:24`) ✅
  - issue-1080: `.settings-llm-switch-row` in `SettingsPage.tsx:311,332` ✅
  - issue-787: Säulen-Berater bei `aiEnabled=false` gar nicht gerendert, `App.tsx:440-446` ✅
  - issue-1034: `app.css:1728-1732` `@media(min-width:768px) .update-prompt { max-width:480px; left:auto }` ✅
  - issue-894: Sweep mappt nur Phasen 01–05 (`claude-continue-sweep.yml:142-147`), kein 06 ✅
  - issue-734: `01-claude-triage.yml:445-451` setzt `ai:needs-po-review` + `::notice` ✅ (Alt-Grep Zeilen 279–286 wie im PR-Body notiert)
  - journeys: `aiPreferences.ts` (quickCaptureEnabled, Default true), `DependencyModal.tsx:134` (Vorgänger nur Offen/In Bearbeitung), 409-String `tasks.ts:467` wortgleich ✅
  - issue-845/1073: `Footer.tsx` adresse-zuerst, Koordinaten-Fallback, kein Pin-Emoji, Separator-Span `aria-hidden="true"` ✅
  - issue-951: `POST /llm-providers/:id/test` (`llmProviders.ts:368`), 4 Alert-Stufen in `LlmSettings.tsx:269-283` ✅
  - issue-933: Button-Label „Standort jetzt ermitteln" (`SettingsPage.tsx:273`) ✅
  - e2e `issue-1063-geo-badge.spec.ts:108-133` deckt TaskTree-Badge bereits ab → Spec/Test/Code nach Sync aligned, kein Test-Pflege-Bedarf.
- CI-`verify` rot analysiert: Prettier-Check schlägt auf 5 geänderten Dateien fehl
  (`issue-1063.md`, `issue-1066.md`, `issue-619.md`, `issue-843.md`, `user-journeys.md`) —
  Markdown-Tabellen nicht neu ausgerichtet + 1 stray Leerzeile (issue-1066.md EOF). Lokal reproduziert.
- Titel-Gate: Titel war deutsch (`Ist-Stand-Sync`) → umbenannt via `gh pr edit`.

## Relevante Stellen
- `docs/spec/*.md` (17 Dateien) — der gesamte Diff.
- Prettier-Anchor-Zeilen (Neu-Datei): issue-619.md:50, issue-843.md:41, issue-1063.md:75, issue-1066.md:86 (EOF-Leerzeile 87), user-journeys.md:199.
- `package.json:17` — Fix-Kommando: `pnpm format` (prettier --write).

## Annahmen
- PR-Beschreibung (Sync-Report) ist die informelle Spezifikation — kein Issue verlinkt.
- Docs-only → kein Test-Gate nötig (Ausnahme reine Doku); KoliBri/Mobile-first entfallen (kein UI-Code).
- Der `VERDICT: updated`-Token am Ende des PR-Bodys stammt aus der Sync-Phase-Workflow-Vorlage, nicht aus diesem Review.

## Verworfen
- Tiefere Fehlersuche in CI-Redis-Logs — Root-Cause war vorher gefunden (Prettier), Rest war Service-Noise.

## Offen
- — (Runde 2 abgeschlossen, Verdict `reviewed` gesetzt; PR kann mergen.)

## Erledigt (Runde 2 — Fixup-Nachweis, 2026-08-28)
- MODE bestimmt: `<!-- ai-review -->` vorhanden (Comment 5451595225) → Fixup-Nachweis, keine neue Kreuzverhör.
- Delta `72bf1745b..f20a5f1d7` geprüft: Fixup-Commit `48b5835a` trifft genau die 5 F1-Dateien +
  .ai-memory-Phasennotizen; `--ignore-all-space`-Restdeltas sind nur Strich-Padding in Tabellen-
  Separator-Zeilen (Dashes sind kein Whitespace) → rein Formatierung, kein Inhalt.
- Merge-Commit `f20a5f1d7` (main → Branch, bringt PR #1087/Release/Cost-Files) lässt `docs/spec/`
  unberührt (leerer Diff 48b5835a..f20a5f1d7 auf docs/spec) → kein neuer Review-Gegenstand.
- CI auf HEAD `f20a5f1d7`: `verify` pass (inkl. Prettier-Check), e2e-Shards 1–4 pass.
- Titel-Gate: `docs(spec): sync specs to current state 2026-08-28` konform (51 Zeichen) — kein Rename.
- Sammelkommentar 5451595225 per PATCH aktualisiert (updatedAt 2026-08-28T11:18:06Z):
  Status reviewed, F1 in „Behobene Anmerkungen", Offene Findings leer, Footer `Review-Typ: Fixup-Nachweis`.
- Verdict `reviewed` → /tmp/claude-verdict.

## Erledigt (Runde 1 — Abschluss)
- Titel umbenannt zu `docs(spec): sync specs to current state 2026-08-28`.
- Review 5050376192 (event COMMENT) mit 5 Inline-Kommentaren gepostet.
- Sammelkommentar angelegt: Issue-Comment-ID **5451595225** (Marker `<!-- ai-review -->`, updatedAt 2026-08-28T10:48:51Z), Offene Findings: F1, Footer `Review-Typ: Kreuzverhör`.
- Verdict `needs-fixup` → /tmp/claude-verdict.

## Nächster Schritt
- — (Ticket aus Review-Sicht abgeschlossen.)

## Fallstricke
- Beim Fixup-Round-2: NUR Prettier-Diff prüfen (Fixup-Nachweis), Inhalte sind verifiziert — keine neue Kreuzverhör. ✅ befolgt.
- GitHub-Inline-Kommentare brauchen Zeilen INNERHALB der Diff-Hunks (obige Anchor-Liste beachtet das).
- Prettier-Tabellen-Separator-Padding (`---` → `----`) taucht unter `--ignore-all-space` NICHT als
  whitespace-only auf (Dashes sind Inhalt) — kein Fehlalarm, gehört zur Formatierung.
