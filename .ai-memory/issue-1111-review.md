# Issue 1111 — Review (Phase 5), Stand 2026-08-29

**ERGEBNIS: VERDICT needs-fixup, 1 Fund (F1).** Kreuzverhör (1. Runde) zu PR #1113. Titel per TITLE GATE umbenannt → `feat(frontend): show resolved coordinates in the task form (#1111)` (Conventional Commits, englisch, lowercase, 66 Z.). Review (event=COMMENT, Review-ID 5057239048) mit 2 Inline-Kommentaren gepostet; Sammelkommentar mit Marker `<!-- ai-review -->` erstellt: https://github.com/deleonio/priority-pilot/pull/1113#issuecomment-5460977535.

## Erledigt
- MODE-Bestimmung: kein `<!-- ai-review -->`-Kommentar vorhanden (`gh api repos/{owner}/{repo}/issues/1113/comments` = `[]`) → Kreuzverhör (Erstrunde), kompletter Diff gelesen (`gh pr diff 1113`, 751 Z.).
- Closing-Reference geprüft: `closingIssuesReferences | length` = 1 → AK1–AK7 aus dem Issue-Body (Zeilen 52–58, TF1–TF7 :61–67) als Maßstab; KEIN „Review ohne Issue“.
- Diff gegen alle 7 AKs geprüft: Umsetzung vollständig (State-Spiegel `coords` + `setCoords` in `applyAddressCoords`/`onValueChange`, Box als `role="group"` „Gespeicherter Ortsbezug“ mit `dl`/`toFixed(6)`/`tabular-nums`/`overflowWrap:'anywhere'`, `_type="search"` + neuer Prop `ariaDetails` → `_ariaDetails` in AddressAutocomplete).
- F1 verifiziert: `frontend/src/components/AddressAutocomplete.test.tsx:94` (Helper `typeQuery`) und `:111` (TF6) fragen `getByRole('textbox')` ab; seit `type={_type ?? 'text'}` im Mock (:30) + `_type="search"` im Produktivcode ist die implizite Rolle `searchbox` → 9 rote Tests (PR-Body bestätigt 466 passed / 9 failed). Implement-Notiz hatte das bereits als Selbstwiderspruch der Spec-Tests dokumentiert.
- Blast-Radius der Rollen-Änderung geprüft: `grep getByRole('textbox')` in `frontend/e2e/` = nur `pillar-advisor.spec.ts:90` (Textarea, irrelevant); alle Adress-e2e nutzen `getByLabel('Adresse (optional)')` (issue-1111-coords-box, issue-1072, issue-1061) → Fix bleibt auf die eine Unit-Testdatei beschränkt.
- Nachbarschafts-Recherche (haiku-Subagent, recherche): CSS-Tokens `--pp-surface-2/--pp-ink/--pp-ink-muted` (app.css:33/40/41 + Dark :152/157/158), `--pp-radius-sm:105`, `--pp-space-2/3:82/83` — Fallback-Hexwerte greifen praktisch nie, Dark Mode unkritisch. Inline-`var(--pp-…, fallback)`-Muster hat Präzedenz (LoginPage.tsx:38-59, AddressAutocomplete.tsx:151-179). `SeriesEditForm` im Test = `TaskForm as unknown as …` (TaskForm.test.tsx:244, Pre-existing, nicht diff-relevant) → Serie-Modus teilt den Codepfad.
- KoliBri-first geprüft und NICHT beanstandet: Spec (`docs/spec/issue-1111.md`) + KI-UX-Block begründen `div role="group"` (KolAlert würde `role="alert"` ankündigen, KolCard zu schwer); Begründung liegt im PR/Issue vor.
- TDD-Reihenfolge bestätigt: Commit `7c1becb5 test: red spec tests for #1111` vor `fca6e39f feat(frontend)…`.
- Titel-Gate ausgeführt: alter Titel „Aufgabenformular: aufgelöste Koordinaten … (#1111)“ (deutsch, kein Type) → `gh pr edit 1113 --title` mit Conventional-Commits-Titel.

## Relevante Stellen
- `frontend/src/components/AddressAutocomplete.test.tsx:94` — `typeQuery`-Helper, `getByRole('textbox')`; Fix → `searchbox` (F1, Teil 1).
- `frontend/src/components/AddressAutocomplete.test.tsx:111` — TF6-Assertion, unerreichbar; Fix → `getByRole('searchbox')` (F1, Teil 2).
- `frontend/src/components/TaskForm.tsx:288-296` — neuer `coords`-State + `coordsBoxId = useId()`; `applyAddressCoords` + `onValueChange` spiegeln zusätzlich in den State; Ref bleibt Submit-Quelle (Payload-Vertrag unverändert, #1083-Payload-Test grün).
- `frontend/src/components/TaskForm.tsx:970-1030` — Box-JSX außerhalb des `role="combobox"`-Containers, ohne `aria-live`, sichtbar iff `address.trim() !== ''` (AK5-Variante „verschwindet“).
- `frontend/src/components/AddressAutocomplete.tsx:113-117` — `_type="search"` + `_ariaDetails={ariaDetails}` (AK6).

## Annahmen
- ARIA-1.2-Rollen-Mapping (`input[type=search]` → `searchbox`) stimmt; ich habe es nicht selbst in einer Testumgebung laufen lassen, sondern aus dem Fehllauf der Impl-Phase + PR-Body übernommen (beide unabhängig und konsistent).
- CI-Rollup war beim Review-Abschluss teilweise pending (`verify`, `review`, `e2e (1–4)` ohne Conclusion); die 9 roten Unit-Tests sind statisch + durch den PR-Body belegt, nicht durch ein CI-Ergebnis.

## Verworfen
- needs-human: der Testpflege-Fix ist mechanisch (2 identische Query-Änderungen), es gibt genau eine korrekte Antwort und der PR-Body bittet explizit um Freigabe → fixable, nicht Entscheidungssache.
- Dark-Mode-Finding gegen die Fallback-Hexwerte (`#f2f2f2`, `#1a1a1a`, `#555`) — Tokens sind inkl. Dark-Variante definiert, Fallbacks tot; wäre False Positive gewesen.
- KoliBri-first-Finding gegen die custom `div role="group"`-Box — Begründung liegt in Spec + KI-UX-Block vor (KolAlert ankündigt sich selbst, KolCard zu schwer).
- Klagender Finding zur Duplikation der beiden Style-Objekte (Koordinaten-/Hinweis-Zweig ~90 % identisch) — 2 Zweige eines Ternarys, idiomatisch; Rauschen.
- AK2-Edge-Case-Finding (Task mit lat/lon aber leerer Adresse → Box versteckt) — von AK5 her genau so festgelegt („Box nur zeigen, wenn Adresstext nicht leer“); kein Verstoß.
- Round-Probleme bei `toFixed(6)` — Spec erlaubt Anzeige-Rundung ausdrücklich („gespeicherter Wert bleibt exakt“).

## Offen
- Fixup-Runde ausstehend: F1 umsetzen (`searchbox` statt `textbox`, 2 Stellen), `pnpm test` vollständig grün, danach Re-Review (Fixup-Nachweis) → angestrebt 🟢.
- `/tmp/rev.json` (Review-Payload) ist Wegwerf-Artefakt in /tmp, nicht im Repo.

## Nächster Schritt
- Fixup-Nachweis (Folgerunde): nur F1 abhaken (`AddressAutocomplete.test.tsx:94` + `:111`), Diff-Scoping auf den Fixup-Commit, Sammelkommentar updaten (F1 → „Behobene Anmerkungen“, `Updated:` anheben, Review-Typ: Fixup-Nachweis), VERDICT `reviewed` wenn Gate grün.

## Fallstricke
- Inline-Review-Kommentare: `line` muss im Diff-Hunk liegen — Zeile 94 (Helper, unverändert) lieferte 422 „Line could not be resolved“; Ankertext nennt :94, verankert ist :105 (erste hinzugefügte Zeile des Hunks).
- `gh api -f/-F comments[][path]=…` baut das `comments[]`-Array unzuverlässig (422 „Expected value to not be null“) — JSON-Payload per Python bauen und mit `--input` hochladen.
- `Write` nach `/tmp` war im Review-Lauf nicht freigegeben → Heredoc/Python-Stdin statt Write-Tool für Payloads.
- Der Sammelkommentar muss die Kopfzeilen wörtlich deutsch führen (`## ✅ Behobene Anmerkungen`, `## ⏸️ Entscheidungs-Findings`, `## 📋 Offene Findings`) — das needs-human-Verifikationssubstring testet auf `Entscheidungs-Findings`.
- Labels NICHT setzen (Workflow macht das); Title-Gate-Rename war erlaubt und ist kein Finding.
