# Issue 1168 — Triage (Phase 1), Stand 2026-09-02T06:50:49Z

**ERGEBNIS: VERDICT spec-ready (Ampel 🟢).** Initial-Triage: kein `<!-- ai-harness -->`-Kommentar, einziger
Kommentar war der `<!-- ai-quality -->`-Bot (2026-09-02T06:41:35Z, keine Entscheidung). Harness-Kommentar
(KI-ANALYSE + Routing-Tabelle) neu angelegt:
https://github.com/deleonio/priority-pilot/issues/1168#issuecomment-5505673878 — Labels: `ai:needs-analyse`
entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt (verifiziert: `["ai:needs-ux-ui","ai:analysed"]`).
Kein Ping-Kommentar, kein Body-Edit (ADR 0009), kein Titel-Edit, kein Split, kein Auto-Close.

## Erledigt

- Issue geladen (`gh issue view 1168 --json title,body,labels,state,comments`); Trigger = Initial-Triage.
- Code-Recherche (alles selbst verifiziert, kein Subagent):
  - `frontend/src/components/Dashboard.tsx:198-205` — `KolButton _label="Jetzt starten"` im Panel
    `.dashboard-next-task`; `:39-40` Prop `onStartTask?: (task: Task) => void`.
  - `frontend/src/App.tsx:611` — `onStartTask={openEdit}` (oeffnet heute den Edit-Dialog).
  - `frontend/src/App.tsx:378-422` — `handleDoneToggle` (PUT `/tasks/{id}` mit `status: Done`,
    optimistischer sticky-Pfad `DONE_REMOVAL_DELAY_MS`).
  - `frontend/src/App.tsx:44-49` — `DialogState`-Union; `:83,150,156` — `nextTask` aus `api.getNextTask()`,
    `reload()` laedt `GET /next` neu.
  - `frontend/src/components/ConfirmDeleteDialog.tsx` (komplett gelesen) + `DeleteTaskDialog.tsx` —
    Bestaetigungsdialog-Muster auf `Modal`.
- Harness-Kommentar gebaut per `Write` nach `.ai-memory/issue-1168-harness.md` +
  `gh issue comment 1168 --body-file` (Heredoc-Verbot, MEMORY 2026-08-26).
- 8 AKs + 8 Testfaelle formuliert (Vitest-Unit + Playwright-e2e), Routing-Tabelle
  ux ja/sonnet/medium, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high.

## Relevante Stellen

- `frontend/src/components/Dashboard.tsx:198-205` — der zu ersetzende Button (AK1/AK7).
- `frontend/src/components/Dashboard.tsx:39-40` — Prop-Vertrag; `onStartTask` wird durch den
  Erledigt-Callback abgeloest.
- `frontend/src/App.tsx:611` — Verdrahtung; hier muss der neue Dialog-Trigger rein.
- `frontend/src/App.tsx:378-422` — vorhandener Erledigt-Pfad (PUT Task mit `status: Done`), Vorlage fuer die
  Bestaetigungsaktion.
- `frontend/src/App.tsx:44-49` — `DialogState`-Union braucht eine neue Variante (z. B. `{kind:'complete'}`).
- `frontend/src/components/ConfirmDeleteDialog.tsx:44-126` — Skelett (Abbrechen zuerst + Initialfokus,
  Fehler-Alert, `deleting`-Zustand, Strg+Enter); Wortlaut ist loesch-spezifisch.
- `frontend/src/components/Modal.tsx` — Basis fuer den empfohlenen neuen `CompleteTaskDialog`.
- `frontend/e2e/issue-1042-dashboard-start-button.spec.ts:38,58,60,69` — bricht durch das Umlabeln.
- `frontend/e2e/issue-1118-dashboard-section-cards.spec.ts:293-304` — Tastatur-Test erwartet, dass Enter den
  Task-Dialog oeffnet; bricht ebenfalls.
- `frontend/src/app.css:537,554` — Layout-Regeln des Buttons (mobil voll, ab 768px inhaltsbreit).

## Annahmen

- „Der Button soll 'Erledigt' heissen" = ERSETZEN, nicht ergaenzen (Messgroesse im Ticket sagt woertlich
  „zeigt 'Erledigt' statt 'Jetzt starten'"). Der Edit-Einstieg vom Dashboard entfaellt damit; als
  beratender Punkt an die UX-Phase weitergereicht, nicht als offene Frage blockierend.
- `GET /next` liefert nach dem Statuswechsel die naechste Aufgabe — d. h. AK5 ist per `reload()` ohne
  Server-Aenderung erfuellbar (Endpunkt-Implementierung nicht gelesen).
- Kein Guard gegen offene Unteraufgaben noetig: der Guard sitzt laut `App.tsx:377`-Kommentar in `TaskTree`,
  `GET /next` liefert per Konzept keine blockierten Aufgaben (nicht serverseitig nachgeprueft).

## Verworfen

- `ConfirmDeleteDialog` direkt wiederverwenden — Danger-Variante, Alert-Label „Loeschen fehlgeschlagen",
  Busy-Label „Loeschen…"; Erledigen ist nicht destruktiv. Empfehlung im Block: eigener `CompleteTaskDialog`
  auf `Modal`.
- Split in Sub-Issues — eine Komponente + ein Dialog + Tests, klar ein PR.
- Titel-/Body-Edit — Titel trifft die Sache, Body-Edit ist per ADR 0009 verboten.
- Ping-Kommentar — CI-Regel (kein Ping bei eindeutigem Ergebnis).
- Auto-Close — `grep "Jetzt starten"` findet den alten Button unveraendert in `Dashboard.tsx:200`.
- MEMORY.md-Eintrag — kein neuer Fehler/keine neue Erfahrung.

## Offen

- `.ai-memory/issue-1168-harness.md` ist ein Wegwerf-Artefakt (Kommentar-Body) und NICHT gitignored;
  `rm` wurde in diesem Lauf nicht freigegeben. Nicht committen — nur `issue-1168-triage.md` ist die
  Phasen-Notiz.

## Nächster Schritt

- UX-Phase (Label `ai:needs-ux-ui` gesetzt): Dialog-Wording/Variante (nicht destruktiv), Ersatz fuer den
  entfallenden Edit-Einstieg im Panel, Mobile-First-Check des neuen Buttons.

## Fallstricke

- Der Harness-Kommentar ist die EINZIGE Ablage (ADR 0009) — Folgephasen muessen ihn read-modify-write
  aktualisieren (KI-UX-Block ergaenzen, KI-ANALYSE + Routing byte-genau beibehalten).
- Zwei bestehende e2e-Specs (#1042, #1118) fallen beim Umlabeln um — sie MUESSEN mitgezogen werden,
  ihre Layout-/A11y-Vertraege bleiben aber inhaltlich gueltig (nicht einfach loeschen).
- `handleDoneToggle`s sticky-Pfad (kein Reload nach „Done", #315/#392) ist fuer die Liste gebaut; im
  Dashboard braucht es nach der Bestaetigung ein frisches `GET /next`, sonst bleibt die erledigte Aufgabe
  im Panel stehen.
- Harness-Body niemals per Bash-Heredoc bauen (Bash-Tool-Parser) und nicht nach `/tmp` schreiben —
  `Write` unterhalb des Repos + `--body-file`, Datei danach loeschen (sie ist NICHT gitignored).
- Gezielte e2e-Verifikation: `npx playwright test e2e/<datei>.spec.ts` im `frontend`-Verzeichnis,
  NICHT `pnpm --filter frontend test:e2e -- <pattern>` (filtert nicht).
