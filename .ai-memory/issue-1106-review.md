# Issue 1106 — Review (Phase 5), Stand 2026-08-29

**ERGEBNIS: VERDICT needs-fixup, Ampel 🔴.** MODE = Kreuzverhör (kein `<!-- ai-review -->`-Marker vorhanden, erste Runde). PR #1108 (Branch `ai/harness/1106`, +581/−246), Closing-Issue #1106 → AKs aus dem KI-ANALYSE-Block des Bodies (stand=2026-08-29T04:07:10Z). 3 Findings als Inline-Kommentare in EINER Review (ID 5056959815, event=COMMENT) + Sammelkommentar `<!-- ai-review -->` (issuecomment 5460449424) gepostet. Titel-Gate: „Vier Lösch-Bestätigungsdialoge …“ (kein Conventional Commit) → `refactor(frontend): unify delete dialogs in ConfirmDeleteDialog (#1106)` gesetzt (71 Zeichen).

## Erledigt
- Diff komplett gelesen (`/tmp/pr1108.diff`, 944 Zeilen), Issue-AKs aus dem Analyse-Block extrahiert.
- AK-Verifikation selbst nachgezogen: AK2 `grep -c toApiError` in den vier Dialogen = 0/0/0/0 ✓; AK5 `wc -l` 76/77/87/88=328 → 31/32/45/43=151 = −177 ✓ (PR-Body-Dokumentation stimmt); AK1/AK4 durch `ConfirmDeleteDialog.test.tsx` (7 Cases) abgedeckt; AK3-Unit-Tests unverändert und grün (PR: 239/239).
- F1 (🔴): Strg+Enter-Regression verifiziert — alter `DeleteSeriesDialog`-Code (im Diff sichtbar) band Strg+Enter an `confirm(false)` = „Nein“ mit Kommentar „keine versehentliche Kaskade über das Tastenkürzel“; neu: `ConfirmDeleteDialog.tsx:70` bindet `useCtrlEnter` fest an `run(onConfirm)` und `DeleteSeriesDialog.tsx:35` ist `cascade: true`.
- F2 (🔴): beide roten E2E-Verletzungen am Quelltext gelesen — `delete-dialog-focus.spec.ts:206` („Nein“ muss fokussiert sein) und `:214` (Tab von „Nein“ → „Abbrechen“), dazu AK9-Fall ab `:360`; Pflicht-Charakter via Subagent bestätigt (`.github/workflows/ci.yml:122-172`, 4 Shards).
- F3 (🟡): `ConfirmDeleteDialog.test.tsx:59-63` — Mock reicht `enabled` durch, kein Test nutzt es; `DeleteSeriesDialog.test.tsx:46` mockt `useCtrlEnter` als no-op → Kürzel-Ziel ungepinnt.
- CI-Rollup zum Review-Zeitpunkt: precheck ✓, `verify`/`review`/`e2e (1-3)` in_progress, `e2e (4)` ✓ — das gate-entscheidende e2e-Ergebnis war noch offen.

## Relevante Stellen
- `frontend/src/components/ConfirmDeleteDialog.tsx:70` — `useCtrlEnter(() => void run(onConfirm), !deleting)`: Festverdrahtung Kürzel→Danger; Hebel für F1-Fix (Prop `confirmHotkey?: boolean = true`).
- `frontend/src/components/DeleteSeriesDialog.tsx:35,39-43` — `onConfirm` = Kaskade, `secondaryAction` = „Nein“; `:42` gibt den API-Promise bewusst un-voided zurück (Feature, dokumentiert).
- `frontend/e2e/delete-dialog-focus.spec.ts:165-169,206,214,360` — alter #553-Vertrag; F2-Fixorte.
- `frontend/src/components/ConfirmDeleteDialog.test.tsx:61,198-199` — Kürzel-Mock; F3-Fixort.
- PR-Body enthält die Latte „Test-Pflege-Bedarf“ + AK2/AK5-Nachweise + Gate-Report — konsistent mit dem Code, nur das E2E-Umsetzen fehlt.

## Annahmen
- Die E2E-Fälle :206/:214/:360 schlagen wirklich fehl (nicht ausgeführt — Shard-Ergebnisse waren beim Review offen); die Assertions widersprechen dem neuen DOM-/Fokus-Vertrag zwingend.
- `pnpm test` 239/239 (PR-Angabe) stimmt; `verify`-Job war in_progress.
- „Review-Typ: Kreuzverhör“ korrekt (keine Fixup-Runde davor).

## Verworfen
- `secondaryAction.onClick`-Promise-Vertrag (`() => void`, intern awaited) — bewusst, im Code-Kommentar und PR-Body dokumentiert, kein Finding.
- Label-Wahl der Danger-/Secondary-Rollen im Serien-Dialog (Kaskade = Danger = `onConfirm`) — folgt zwingend aus AK4-Reihenfolge; nur das Kürzel-Binding ist der Fehler (F1).
- `run()` setzt „Löschen…“ auch beim Sekundär-Click — kosmetisch, kein Finding.
- KoliBri-first / Mobile-first / Format-Lint — nichts zu beanstanden (KolAlert/KolButton/Modal, keine Media-Queries, `pnpm format`/`lint` im Body dokumentiert).

## Offen
- CI (verify, e2e 1-3) zum Zeitpunkt des Reviews noch laufend — Verdict `needs-fixup` unabhängig davon durch F1/F2 begründet.
- Wegwerf-Artefakte in `/tmp` (`pr1108.diff`, `rev-body.md`, `c1-c3.md`, `review.json`, `collect.md`, `issue1106.md`) — außerhalb des Repos, kein Commit-Thema.

## Nächster Schritt
- Fixup (Label `ai:needs-changes`/`ai:needs-fixup` übernimmt der Workflow): F1 Kürzel-Binding entschärfen + F2 die drei E2E-Stellen (incl. Kommentare :165-169) auf den neuen Vertrag stellen + F3 zwei Test-Assertions ergänzen; danach Fixup-Nachweis-Review per bestehendem Sammelkommentar (Marker `<!-- ai-review -->`, issuecomment 5460449424, Review-Typ: Fixup-Nachweis).

## Fallstricke
- F2-Datei liegt AUSSERHALB des PR-Diffs → Inline-Anker unmöglich; F2 hängt deshalb an `ConfirmDeleteDialog.tsx:77` (`initialFocusRef`). Beim Fixup-Review die E2E-Stellen direkt am Quelltext prüfen.
- Finding-Nummern F1-F3 und deren Verortung sind stabil zu halten (nicht umnummerieren), der Sammelkommentar wird per Marker in-place gepatcht.
- `useCtrlEnter`-Mock in beiden Testdateien kapselt das Kürzel-Verhalten — wer das Kürzel-Ziel testet, muss entweder die Mock-Signatur erweitern (`enabled` zurückgeben/asserten) oder einen echten `keydown`-Event feuern.
- DeleteSeriesDialog: „Nein“ läuft jetzt über `secondaryAction` → dasselbe `error`/`deleting`-Handling wie der Danger-Button; ein Fixup darf diese Fehlerbehandlung nicht verlieren (PR-Body „Hinweise“ Absatz 2).
