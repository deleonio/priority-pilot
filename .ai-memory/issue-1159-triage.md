# Issue 1159 — Triage (Phase 1), Stand 2026-09-01T23:32:38Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar; einziger Kommentar = github-actions-Qualitätscheck 2026-09-01T23:29Z, keine Entscheidungen). Harness-Kommentar neu erstellt (Kommentar-ID 5502001456), Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt (Endstand verifiziert). Kein Ping, kein Titel-/Body-Edit, kein Split (ein CSS-/Struktur-PR), kein Auto-Close (Anforderung klar nicht implementiert).

## Erledigt
- Issue geladen, Trigger = Initial-Triage; Code-Recherche an `recherche`-Subagenten delegiert (TaskForm-Struktur, app.css-Klassen, Tests, Konventionen, Branch-Check).
- Harness-Kommentar (Marker + KI-ANALYSE + Routing-Tabelle) via `.ai-memory/issue-1159-harness.md` + `gh issue comment --body-file` erstellt; Labels gesetzt und verifiziert.

## Relevante Stellen
- `frontend/src/components/TaskForm.tsx:777-1112` — `.form-grid`: Titel :782, `.range-inputs-row` (Priorität+Aufwand) :842, `.deadline-group` :884, Adresse (AddressAutocomplete) :971, Beschreibung :1063; danach `.pillar-editor` :1119, `.checklist-editor` :1213, `.modal-actions` :1253.
- `frontend/src/components/TaskFormModal.tsx:44-51` — reiner Durchreich-Wrapper, keine eigene Layout-CSS.
- `frontend/src/components/QuickCaptureModal.tsx:136,166` — nutzt `.form-grid` + `.pillar-editor-loading` mit → CSS-Änderungen wirken dort auch (Randbedingung, Issue nennt QuickCaptureModal im Ist-Text, aber nicht unter „Wo tritt es auf").
- `frontend/src/app.css:1021-1026` (`.form-grid`), `:1173-1176` (`.deadline-group`), `:1179-1183` (`.pillar-editor`), `:1869-1875` (`.range-inputs-row` @media 769px), `:80-122` (Design-Token `--pp-space-*`/`--pp-gap-*`).
- Muster: `.settings-general` (`frontend/src/components/SettingsPage.tsx:1547`) als Gruppen-Layout-Vorbild; kein fieldset/Card-Group-Pattern im Codebase.
- Tests: `frontend/e2e/series-in-taskform.spec.ts` (inkl. Mobile-Viewport-Fälle), `frontend/e2e/issue-1072-deadline-group.spec.ts` — beide als Regressionsschutz in AK verankert; `TaskForm.test.tsx` nur Verhalten, keine Struktur-Assertions.

## Annahmen
- Checklisten-Editor (`.checklist-editor`, TaskForm.tsx:1213) wird der Optional-Sektion zugeordnet — Issue nennt ihn nicht explizit; als Annahme im Analyse-Block dokumentiert, nicht blockierend.
- Konkrete Optik (Farbe/Rahmen der Gruppen) ist UX-Entscheidung → ux=ja in Routing-Tabelle; Kriterien bleiben style-/bbox-basiert prüfbar, egal wie die UX es dreht.
- Routing wie etabliert (#1083/#1095/#1101): ux ja/sonnet/medium, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high.

## Verworfen
- needs-human — keine blockierende Produktfrage; Checklisten-Platzierung ist Detail, keine Unauflösbarkeit.
- Titeländerung („Layout-Optimierung Aufgaben-Formular") — trifft den Inhalt; Body-Copyedit verboten (ADR 0009).
- Split — eine Komponente + ein Stylesheet = ein PR.
- MEMORY.md-Eintrag — kein neuer Fehler, Kriterium nicht erfüllt.

## Offen
- `.ai-memory/issue-1159-harness.md` ist Wegwerf-Artefakt (gesendeter Kommentar-Stand) — NICHT committen; nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- UX-Phase (Label `ai:needs-ux-ui` gesetzt): KI-UX-Block in denselben Harness-Kommentar schreiben (read-modify-write, KI-ANALYSE + Routing-Tabelle byte-identisch lassen).

## Fallstricke
- `gh issue view --jq '[.comments[] | select(.body | startswith("<!-- ai-harness -->"))] | .[0].id // ""'` gibt bei leerem Ergebnis gar nichts aus (nicht mal Leerzeile) — leere Ausgabe = HID leer = Kommentar erstellen, nicht updaten.
- Kommando-Substitution mit $(...) in der Bash-Sandbox wird abgelehnt („cannot be statically analyzed") — jq-Ergebnis direkt lesen statt in Variable packen.
- E2E-Assertions auf App-Shell-Ebene: boundingBox statt scrollWidth für Überlauf (App-Shell clippt overflow-x:hidden — Memory 2026-08-24); AK6 formuliert als Container-Überlauf, nicht Seite.
- CSS-Änderungen an geteilten Klassen können QuickCaptureModal unbemerkt treffen — dort mittesten bzw. bewusst konsistent halten.
- Mobile (<768px) muss unverändert bleiben — nur 768/1024+ angreifen.
