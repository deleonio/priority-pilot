# Issue 1118 — UX (Phase 2), Stand 2026-08-29T09:45:00Z

**ERGEBNIS: VERDICT ux-ready.** KI-UX-Block in den Body geschrieben (zwischen KI-ANALYSE:END und ai-phase-routing:START, je Marker 1× verifiziert). Kein Label gesetzt (Workflow), kein Ping-Kommentar, kein Code/Branch/PR. Rein statisch: mobile-ui-rules.md, .ai-knowledge/ux-design.md, KoliBri-MCP `spec/card`, Dashboard.tsx/app.css gelesen.

## Erledigt
- Issue-Body geladen, KI-ANALYSE-Block (stand=2026-08-29T09:26:30Z) ausgewertet: 6 bare Sections → KolCard, `_level={3}`-Frage, Gleichhöhe via stretch, AK1–AK9/TF1–TF9.
- KoliBri-Spec `spec/card` via MCP verifiziert: `_label` Pflicht, `_level` 0–6, **0 = fett ohne Überschrift** (Default!) → AK2 braucht explizites `_level={3}`.
- app.css gelesen: `.dashboard-next-task` :496-505 (Signal-Wash + border-left 0.375rem), Media Query :707-713 (`align-items: start`), `.dashboard-nearby kol-card` :610 (display:block-Präzedenz), **#930-Regel :1958-1983: `kol-card { background-color: transparent }` global**.
- Dashboard.tsx:150-340 gelesen: alle 6 Sektionen mit eigenem `<h3>`, KPI-Cards `:165` mit `_level={0}`, Leerzustands-Card „Keine Säulen vorhanden" :254-258 (zweiter Card-in-Card-Fall!).
- Block per head/cat/tail-Splice (Zeile 100) + `gh issue edit --body-file` eingefügt; Landing über frischen `gh issue view` verifiziert (Marker-Positionen 56/100/141/143, User-Text Zeile 1 unversehrt).

## Relevante Stellen
- `frontend/src/app.css:1958-1983` — #930 macht kol-card-Hosts transparent; sichtbare Card-Fläche lebt im Shadow-DOM → Signal-Wash (AK8) geht NICHT per Host-Background. Wege: `--kol-*`-Token vererben, gescopete #930-Ausnahme, oder Wash auf Card-Inhalt. Impl muss verifizieren.
- `frontend/src/components/Dashboard.tsx:165` — KPI-Cards `_level={0}` bewusst (keine Überschriften) — so lassen, sonst H-Kette kaputt.
- `frontend/src/components/Dashboard.tsx:254-258` — Leerzustand-Card in „Meine Themen" wird nach Section-Carding zum card-in-card → Block empfiehlt AK4-Erweiterung.
- `frontend/src/app.css:496-505` — border-left 0.375rem in Signalfarbe = Craft-Floor-Refuse-Liste („Farbige border-left >1px auf Cards/Alerts"); nicht auf die neue Card portieren.
- `frontend/src/app.css:707-713` — `align-items: start` → stretch nur in der Media Query; `height:100%`-Passthrough darf nicht global gelten (mobil sonst aufgezogene Karten, AK6).
- `frontend/src/app.css:529-536` — „Jetzt starten" mobil volle Breite; neue Wrapper dürfen das nicht brechen (AK8).
- `frontend/src/app.css:610` — `.dashboard-nearby kol-card { display:block }` = bestehender Präzedenzfall für Host-Styling.

## Annahmen
- KolCard-Host akzeptiert `display:block; height:100%` und vererbt `color` in den Shadow-DOM (vererbbare Property + Präzedenz #930-Kommentar) — Signalschreibfarbe `--pp-signal-ink` für den Card-Titel also machbar; nicht dynamisch geprüft (verboten).
- Routing-Tabelle (ux ja/sonnet/medium, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high) bindend für Folgephasen.
- KI-ANALYSE-Behauptung „docs/ux-design.md existiert nicht" trifft auf `.ai-knowledge/ux-design.md` NICHT zu (dort steht P2-1-Kontext, §7 Refuse-Liste) — habe die echte Datei als Quelle benutzt.

## Verworfen
- Label-Änderungen (`ai:needs-ux-ui` entfernen etc.) — ausdrücklich dem Workflow vorbehalten (Prompt: ⚠️ LABELS).
- ux-not-ready — alle Befunde sind advisory/technisch verifizierbar, keine Produktentscheidung offen; zwei Empfehlungen (AK4-Erweiterung, AK6-Messwert Bounding-Box) sind nicht blockierend.
- „Meine Themen"-Leerzustand als KolAlert-Empfehlung dem Spec überlassen statt festgelegt — UI-Form des Leerzustands ist nicht Teil des Issues.

## Offen
- Wegwerf-Artefakte untracked in `.ai-memory/`, NICHT committen: `issue-1118-body.md`, `issue-1118-ux-block.md`, `issue-1118-new.md`, `issue-1118-verify.md`, `issue-1118-splice.py`. Nur diese Datei (`issue-1118-ux.md`) ist die Phasen-Notiz. `rm` braucht Freigabe (Muster #1083/#1095/#1098).

## Nächster Schritt
- Spec-Phase (Label `ai:needs-spec` via Workflow): TF2/TF8 präzisieren — Card-Labels über Shadow-DOM auslesen (`_level={3}`-Überschrift, kein `<h3>` mehr), AK4 um „Keine Säulen vorhanden"-Card erweitern, AK6-Messwert auf Bounding-Box (`el.x + el.width <= 375`) umstellen statt scrollWidth.

## Fallstricke
- `KolCard._level` Default ist 0 (= KEINE Überschrift). Wer `_level` vergisst, erfüllt AK2 nicht — der DOM-Test „dritte Überschriftenebene" fliegt rot.
- #930-Regel: Host-`background` auf kol-card ist wirkungslos (transparent erzwungen). Signal-Wash-Umsetzung gegen die Shadow-DOM-Fläche planen, nicht gegen den Host.
- `height:100%` am kol-card-Host global = mobil aufgezogene Karten (AK6-Verletzung); streng in `@media (min-width: 48rem)` kapseln.
- Gleichhöhe umfasst auch die `NearbyCard`-Zeile (bedingt gerendert, eigenes KolCard) — Host-Höhen-Passthrough muss für sie gelten oder die Zeile bricht AK5.
- E2E: Shadow-DOM-Label-Auslesen nicht über CSS-Selektoren im Light-DOM lösen (Memory 2026-08-23: KoliBri benennt Slots zur Laufzeit um); Label über `aria`/invoke-API oder Role-Queries holen.
- `document.documentElement.scrollWidth` ist in dieser App nie > Viewport (Shell clippt) — als AK-Messwert ungeeignet (Memory 2026-08-24).
