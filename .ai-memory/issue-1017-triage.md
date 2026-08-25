# Issue #1017 — Triage „UX Schalter links inline oder in mobil volle breite gestapelt"

## Erledigt
- Issue gelesen (Erst-Triage, kein KI-ANALYSE-Block, 0 Kommentare).
- Screenshot analysiert (mobile Settings „Allgemein"): 3 Switches, Toggle links, Label inline, Hint darunter, „Push testen"-Button dazwischen.
- Code-Recherche abgeschlossen (siehe Relevante Stellen).

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx:155-254` — die 3 Settings-Switches (Sprachaufnahme/Push/Standort), je in `.settings-switch-row` (#971-Muster).
- `frontend/src/lib/useShadowDOMLayout.ts:18` — Hook setzt marginLeft 1.5rem auf Shadow-Controls (#843), genutzt in SettingsPage.tsx:59.
- `frontend/src/app.css:1445-1479` — `.settings-switch-row`: mobil column (full-bleed via negative margin-inline), ≥768px row (Switch 60%/Alert 40%). Das responsive Vorbild.
- `frontend/src/App.tsx:519` — Switch „Erledigte Aufgaben anzeigen" (`.task-view-switch`, Filterleiste Aufgaben-Tab) — BISHER ohne responsive Klassen.
- `frontend/src/components/TaskForm.tsx:704` — „Serie"-Umschalter (`data-testid="mode-switch"`), ohne Klassen/Layout.
- `frontend/src/components/TaskForm.tsx:1081` — Checklisten-„Erledigt"-Switches in `.checklist-item` (app.css:1819), Zeilenlayout mit Titel + Entfernen-Button.
- `frontend/e2e/settings-switch-layout.spec.ts` — #971-e2e-Vorbild (Bounding-Box-Assertions, Viewport-Wechsel).
- KoliBri-Komponente überall identisch: `KolInputCheckbox _variant="switch"` — kein neuer Baustein nötig.

## Annahmen
- Gewünschtes Ziel: EINheitliches Switch-Layout app-weit; Desktop (≥768px): Toggle links + Label inline daneben (KoliBri-Default, wie Screenshot); Mobil (<768px): Switch-Zeile volle Breite, gestapelt (Label über/unter Toggle — genaue Anordnung ist UX-Entscheidung, nicht Triage).
- „Einheitlich" bezieht sich auf die 6 Fundstellen oben (Settings 3x, Filterleiste, Serie-Umschalter, Checkliste); Checkliste evtl. bewusst ausgenommen (Zeilenlayout mit Titel/Entfernen) → UX-Phase klärt Geltungsbereich.
- Umsetzung vermutlich: gemeinsame CSS-Klasse + `@media (min-width: 768px)` in app.css, angewandt auf alle Hosts; Shadow-DOM-internes Layout nur über Host-CSS/Custom Properties (kein ::part in app.css gefunden).

## Verworfen
- Zerlegung in Sub-Issues — eine Schicht (Frontend CSS/Markup), ein kohäives Anliegen, 1 PR machbar.
- Neue KoliBri-Komponente — es ist überall schon KolInputCheckbox _variant="switch".

## Offen
- - (nichts — Triage abgeschlossen)

## Nächster Schritt
- Fertig. Titel+Body editiert (KI-ANALYSE-Block im Body verifiziert, 2 Marker), Ping-Kommentar gepostet (issuecomment-5409376434), VERDICT: spec-ready. Keine Zerlegung, keine Labels auf #1017. Nächste Phase: UX (UI-Bezug ja).

## Fallstricke
- #1017 nicht mit #971 (settings-switch-row) verwechseln — #971 war Settings-spezifisch Switch↔Alert, #1017 ist app-weite Switch-Einheitlichkeit + mobiles Umschalten.
- KoliBri-Host ist block-level/width:100% als Flex-Item (Memory 08-24) — Breiten explizit teilen.
- „Kein horizontaler Scroll"-AKs per Bounding-Box prüfen, nicht scrollWidth (Memory 08-24).
- Fokus/aria-checked in KoliBri-Shadow-DOM: toBeChecked(), nicht Attribut (Memory 08-24).
- Ziel-Kommentar-Format `<!-- ai-triage-decision -->` nur bei needs-human — hier nicht genutzt.
- `.ai-memory/tmp-issue-1017-body.md` konnte nicht gelöscht werden (rm braucht Freigabe) — gitignored, bei Bedarf löschen.
