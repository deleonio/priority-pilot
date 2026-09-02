# Issue 1168 — UX-Beratung (Phase 2), Stand 2026-09-02

**ERGEBNIS: UX-Block geschrieben, VERDICT ux-ready.**

## Erledigt

- KI-ANALYSE-Block aus dem Harness-Marker-Kommentar gelesen (Komment-ID `IC_kwDONloM188AAAABSCnqlg`, stand=2026-09-02T06:50:49Z), Issue-Body nur zur Kontextprüfung geladen (unangetastet, ADR 0009).
- `frontend/src/components/Dashboard.tsx` (kompletter Panel-Block `dashboard-next-task` Z.181-208), `DeleteTaskDialog.tsx`, `ConfirmDeleteDialog.tsx`, `Modal.tsx` (Z.1-60) gelesen — Bestätigungsdialog-Muster verifiziert.
- `docs/mobile-ui-rules.md` und `.ai-knowledge/ux-design.md` als Maßstab gelesen (Regel 1/2/5/6, Farbrollen, Komponententabelle).
- KI-UX-Block (Interaktion/Mobile-First/A11y/KoliBri/Design-Sprache/Offene UX-Fragen) via Read-Modify-Write (GraphQL `updateIssueComment`) in den Harness-Marker-Kommentar geschrieben; KI-ANALYSE- und Routing-Sektion byte-identisch übernommen (Landing verifiziert: je 1× KI-ANALYSE:END, KI-UX:START/END, ai-phase-routing:START in korrekter Reihenfolge).
- Kein Ping-Kommentar, keine Labels gesetzt (Workflow-Aufgabe), Issue-Body unverändert.

## Relevante Stellen

- `frontend/src/components/Dashboard.tsx:198-204` — Button-Icon `fa-solid fa-play` passt nach Umbenennung zu „Erledigt" nicht mehr; Empfehlung `fa-solid fa-check` (Beratung, nicht AK-bindend).
- `frontend/src/components/ConfirmDeleteDialog.tsx:58-93` — Initialfokus-/Fallback-Fokus-Muster als Vorlage für `CompleteTaskDialog`; Fehler-Alert-Muster (Z.95-99) für AK6.
- `frontend/src/components/Modal.tsx:10-19` — `fallbackFocusRef` zwingend, da der Panel-Button nach erfolgreichem Bestätigen aus dem DOM fällt (nächste Aufgabe ersetzt den Inhalt).

## Annahmen

- Icon-Wechsel und Titel-als-Link-Ersatz sind reine Empfehlungen (advisory), nicht AK-deckend — als offene Fragen im Block markiert, nicht blockierend.

## Verworfen

- `ConfirmDeleteDialog` mit `_variant="danger"` zweckentfremden — bereits von der Analyse-Phase verworfen, UX-Block bestätigt diese Einschätzung fachlich (Erledigen ist nicht destruktiv).

## Offen

- Scratch-Dateien dieses Laufs (`issue-1168-harness-raw.md`, `-hid.txt`, `-new-body.md`, `-ux-block.md`, `-mutation.graphql`, `-verify.md`) liegen noch untracked in `.ai-memory/` — `rm` brauchte in diesem Lauf eine Freigabe, die nicht kam; nur diese Datei hier ist die echte Phasen-Notiz und sollte committet werden, die anderen NICHT.

## Nächster Schritt

- Spec-Phase (Label `ai:needs-spec` bereits gesetzt laut Routing-Tabelle im Body): AK1–AK8 aus dem KI-ANALYSE-Block umsetzen, UX-Empfehlungen (Icon, Dialog-Button-Label „Als erledigt markieren", Fehler-Label „Erledigen fehlgeschlagen") optional aufgreifen.

## Fallstricke

- Zwei Buttons mit identischem Label „Erledigt" (Panel-Button + Dialog-Bestätigen) hintereinander sind für Screenreader-Nutzer schwer unterscheidbar — im Block als Empfehlung „Als erledigt markieren" für den Dialog-Button vermerkt.
