# PR 1053 — Review (Kreuzverhör, Runde 1, 2026-08-27)

MODE: CROSS-EXAMINATION (kein `<!-- ai-review -->`-Kommentar vorhanden beim Start).
PR: docs-only Spec-Sync (Branch chore/spec-sync-all, 1 Commit 84347d18), 24 Dateien in docs/spec/, kein Issue-Bezug (closingIssuesReferences leer). Kein KI-ANALYSE-Block → PR-Body selbst ist der Soll-Bericht.

## Erledigt
- Vollständigen Diff gelesen (1458 Zeilen, /tmp/pr1053.diff): 18 DELETED, 6 MODIFIED.
- 10 Verifikations-Claims des PR-Bodys gegen Code geprüft — ALLE korrekt:
  `titleLengthValidation.ts:6` (=30), `PillarFormDialog.tsx:94-112` (KolInputText _maxLength + KolTextarea),
  `App.tsx:584`, `DependencyModal.tsx:59-61/113/141`, `TaskForm.tsx:484`, `tasks.ts:477` (409 Zyklus),
  `server/src/index.ts:10-25/220-225/240-241` (Exit-1-Handler), `express/index.ts:258-263` (server.on error),
  `apiError.ts:54/66` (KI-Dienst-Meldung), `api.ts` (maxAttempts=3, 502/503/504).
- Dead-Link-Check: keine Referenzen auf gelöschte Spec-Dateien in docs/, AGENTS.md, .ai-knowledge/, überlebenden Specs (grep exit 1 leer).
- Kein Test-Pflege-Bedarf: e2e-Tests zu gelöschten Specs existieren weiter (issue-865/934/969/996/1027/1028/1037/1042.spec.ts) und bleiben gültig — Widerspruch besteht nicht.

## Relevante Stellen
- PR-Body „Spec-Sync-Report 2026-08-27" — Liste der ENTFERNT-Dateien: nur 16 von 18 genannt.
- `docs/spec/issue-865.md` (gelöscht, undokumentiert) — Header ohne Full User Name, Avatar bleibt; inhaltlich teils durch issue-787.md:12-33 (Element-Aufzählung) abgedeckt.
- `docs/spec/issue-968.md` (gelöscht, undokumentiert) — Tab-Leisten mobil nebeneinander, revidierte #703-Regel; NICHT anderweitig in docs/spec erfasst (grep user-journeys.md: keine Tab-Layout-Aussage; #703 nirgends mehr referenziert).

## Annahmen
- Für nächtliche Spec-Sync-PRs gilt der PR-Body als Akzeptanz-Kriterium (vollständiger, nachvollziehbarer Report); kein separates Issue vorhanden.

## Verworfen
- KoliBri-Check: kein UI-Code im Diff (nur Markdown) → entfällt.
- Detail-Finding zu issue-787-Konsolidierung (#691-Inhalt): neue „Abgrenzung: Menüstruktur über alle Viewports" erfasst den Inhalt hinreichend; Bürgermenü-Non-Existenz implizit über „dieselben fünf Kopf-Aktionen" gedeckt — kein Finding.

## Offen
- F1 (🟡, needs-fixup): Löschung von issue-865.md + issue-968.md im Report nicht dokumentiert/nicht gerechtfertigt; issue-968 beschreibt extern sichtbares Verhalten (mobil Tabs nebeneinander) + #703-Deviation, sonst nirgends festgehalten. Fix: Report-Einträge ergänzen; für #968 Verhalten erfassen (user-journeys.md o. ä.) oder explizit als kein Spec-Wert begründen.

## Nächster Schritt
- Fixup-Nachweis-Runde: prüfen, ob F1 behoben wurde (Report-Eintrag/968-Erfassung), dann nur Fixup-Diff seit updatedAt kreuzprüfen.

## Fallstricke
- Beim Follow-up: PR-Titel wurde vom Review per Title Gate umbenannt in „docs(spec): sync specs to current implementation state 2026-08-27" (war deutsch „Ist-Stand-Sync") — kein Re-Finding, gewollt.
- Collected Comment wurde Runde 1 neu angelegt (kein Marker vorhanden); Folgerunden müssen ihn per `<!-- ai-review -->` suchen und PATCHen, nicht neu erstellen.
- Finding-Nummern stabil halten: F1 = undokumentierte Löschungen.
