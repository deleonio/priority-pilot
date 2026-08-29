# Issue 1118 — Triage (Phase 1), Stand 2026-08-29T09:26:30Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein KI-ANALYSE-Block; einziger Kommentar = github-actions-Qualitätscheck 08:56:10Z, keine Entscheidung). Analyse-Block + Routing-Tabelle (ux ja/sonnet/medium, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high) an den Body angehängt, Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt (Endstand per gh view verifiziert; alle 4 Marker je 1× in Ordnung). Kein Ping-Kommentar, kein Titel-/Body-Copyedit (Issue exzellent strukturiert), kein Split (eine Komponente + CSS + Tests = ein PR). Kein Auto-Close: alle sechs Sektionen sind laut Recherche noch bare `<section>`.

## Erledigt
- Issue + Kommentar geladen, Trigger = Initial-Triage bestimmt.
- Code-Recherche an `recherche`-Subagent delegiert (ADR 0008): alle six sections verifiziert, KolCard-Nutzer, app.css-Regeln, NearbyCard, existierende Tests.
- Analyse-Block via `.ai-memory/issue-1118-{body,block,new}.md` + `gh issue edit --body-file` geschrieben.

## Relevante Stellen
- `frontend/src/components/Dashboard.tsx:178,206,232,251,291,313` — die sechs Sektionen (next-task, suggestions, top-tasks, pillars, balance, deadlines), alle bare `<section>` mit eigenem `<h3>`; Umbau auf KolCard hier.
- `frontend/src/components/Dashboard.tsx:178` — `aria-labelledby="dashboard-next-task-heading"` zeigt auf das `<h3>`; bei Card-Label-Umbau Region-Beschriftung erhalten (z. B. `aria-label`).
- `frontend/src/components/Dashboard.tsx:163-168` — KolCard-Muster der Kennzahlen-Kacheln (`_label`/`_level`); :254 Leerzustand "Keine Säulen vorhanden" als KolCard.
- `frontend/src/components/Dashboard.tsx:231` — `<NearbyCard />`-Mount; NICHT doppelt umschließen (NearbyCard.tsx:56 bringt eigene KolCard "In der Nähe").
- `frontend/src/app.css:707-713` — `@media (min-width: 48rem)`: `.dashboard { grid-template-columns: 1fr 1fr; align-items: start }` → auf stretch ändern.
- `frontend/src/app.css:724-726` — `grid-column: 1 / -1` für `.dashboard h2`, `.dashboard-greeting`, `.dashboard-cards`, `.dashboard-next-task`, `.dashboard-suggestions` — bei neuen Wrappern mitziehen (AK7).
- `frontend/src/app.css:22-24,146-148,501-504` — Signal-Fläche (`--pp-signal`/`--pp-signal-wash`, hell/dunkel) — unangetastet lassen (AK8).
- Tests: `frontend/src/components/Dashboard.test.tsx` (erweitern, TF8), `frontend/e2e/dashboard-cards.spec.ts`, `dashboard-meter.spec.ts`, `issue-1042-dashboard-start-button.spec.ts` (nicht rot machen), neu `frontend/e2e/issue-1118-dashboard-section-cards.spec.ts` (TF1-TF7).

## Annahmen
- Routing-Tabelle für Folgephasen bindend; UX läuft zuerst (`ai:needs-ux-ui` gesetzt, UI-Layout-Änderung).
- `docs/ux-design.md` (Issue-Referenz "P2-1") existiert nicht — als veraltete Referenz eingeordnet, kein Blocker; Signal-Schutzziel im Issue selbst eindeutig definiert. Im Analyse-Block unter Randbedingungen dokumentiert.
- Kennzahlen-Kacheln behalten `_level={0}`; die sechs SEKTIONS-Cards brauchen drittes Level (`_level` entsprechend h2→h3-Hierarchie) — genauer Wert ist Impl-Entscheid.

## Verworfen
- Titel-/Body-Copyedit — nicht substantiell falsch, pro-forma-Edit verboten.
- Split — ein PR (eine Komponente + CSS + Tests).
- needs-human wegen fehlender `docs/ux-design.md` — Referenz kosmetisch, Schutzziel (Signal-Fläche) anderweitig verifizierbar.
- MEMORY.md-Eintrag — kein neuer Fehler/Experience-Kriterium erfüllt.

## Offen
- `.ai-memory/issue-1118-{body,block,new}.md` sind Wegwerf-Artefakte der Body-Zusammensetzung — NICHT committen; nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- UX-Phase (Label `ai:needs-ux-ui` gesetzt): Card-Layout/Hierarchie/A11y beraten; danach Spec/Impl gemäß Routing-Tabelle.

## Fallstricke
- KoliBri-Cards rendern Shadow-DOM: Gleichhöhe braucht `align-items: stretch` UND Host-Durchreichung (`kol-card`/Wrapper `display: block; height: 100%`) — kein existing Pattern in app.css, muss neu angelegt werden.
- Mobil (unter 48rem) dürfen Karten NICHT gestreckt werden — height:100% nur innerhalb der Media Query.
- Kein doppeltes `kol-card` in `kol-card` (NearbyCard!).
- `_label` ersetzt das `<h3>`, nicht zusätzlich rendern (doppelte Überschrift im A11y-Tree); `aria-labelledby`-Ersetzung für next-task-Region mitdenken (AK2).
- E2E-Asserts auf Höhe/Breite: Bounding-Box/offsetHeight der Host-Elemente nehmen, nicht des Slots (Memory 2026-08-24/29: scrollWidth-Klippe durch App-Shell overflow-x:hidden; KolTabs-Scoping fällt hier nicht an, aber Shadow-DOM-Piercing für Label-Checks nutzen).
- `sed -i` im Bash-Tool braucht Freigabe — Zeitstempel/Body-Edits per Edit-Tool auf der Datei erledigen (dieser Lauf gemacht).
