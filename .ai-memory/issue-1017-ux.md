# Issue #1017 — UX „Switches einheitlich + responsive"

## Erledigt
- Issue-Body geladen (gh issue view 1017, KI-ANALYSE-Block vorhanden)
- Design-System-Regeln gelesen: ux-design.md (Farbrollen, Skalen, Komponentenwahl, Layout, Mobile-first), mobile-ui-rules.md (10 Regeln, Touch-Targets 44-48px, 375px Referenz)
- MEMORY.md gelesen (Learnings & Erfahrungen)
- KoliBri-Komponente geprüft: KolInputCheckbox mit _variant="switch" (Properties: _label, _checked, _disabled, _hideLabel, _labelAlign='right' default, _hint, _msg)
- Vorhandenes Muster identifiziert: `frontend/src/app.css:1445-1479` (.settings-switch-row mit responsive column/row)
- UX-Beratung geschrieben zwischen <!-- KI-UX:START --> und <!-- KI-UX:END --> im Issue-Body (Abschnitte: Interaktion, Mobile-First, A11y/BITV, KoliBri, Design-Sprache, Offene UX-Fragen)
- Issue-Body editiert (gh issue edit 1017 --body-file) — UX-Beratung jetzt im Issue sichtbar
- VERDICT gesetzt: ux-ready (UX-Beratung geschrieben → Issue zur Implementierung bereit)

## Relevante Stellen
- `frontend/src/app.css:1445-1479` — .settings-switch-row: mobil `flex-direction: column` mit full-bleed (negative margin-inline), ≥768px `row` mit Breitenaufteilung 60/40
- `frontend/src/components/SettingsPage.tsx:155-254` — 3 Settings-Switches (Sprachaufnahme/Push/Standort), nutzen `.settings-switch-row`
- `frontend/src/App.tsx:519` — „Erledigte Aufgaben anzeigen" (`.task-view-switch`, Filterleiste) — bisher ohne responsive Klassen
- `frontend/src/components/TaskForm.tsx:704` — „Serie"-Umschalter (`data-testid="mode-switch"`) — ohne Klassen/Layout
- `frontend/src/components/TaskForm.tsx:1081` — Checklisten-„Erledigt" in `.checklist-item` — Zeilenlayout mit Titel + Entfernen-Button
- `docs/mobile-ui-rules.md:40-73` — Regel 1 (Daumen-Zonen), Regel 2 (Touch-Targets 44-48px), Regel 3 (kein horizontales Scrollen), Regel 4 (Einstellungen flache Liste), Regel 6 (Skalen 4/8/12/16/24/32/48), Regel 7 (async Zustände)
- `docs/ux-design.md:72-88` — Skalen (Abstand 4/8/12/16/24/32/48/64, Typo 5 Größen, 2 Gewichte, 3 Radien, 2 Schatten, Bewegung 120/200ms)
- `docs/ux-design.md:118-126` — Layout: Mobile-first, 375px Basis, 48rem Haupt-Bruchpunkt, Max-width 80rem, Safe-Area-Insets

## Annahmen
- Ziel ist EINheitliches Switch-Layout app-weit: Desktop (≥768px) Toggle links + Label inline (KoliBri-Default), Mobil (<768px) Switch-Zeile volle Breite, gestapelt (Label über Toggle oder Toggle über Label — UX-Entscheidung)
- Die 6 Fundstellen sind gemeint: Settings 3x, Aufgaben-Filterleiste, Serie-Umschalter, Checkliste; Checkliste evtl. bewusst ausgenommen (Zeilenlayout mit Titel/Entfernen)
- Umsetzung vermutlich: gemeinsame CSS-Klasse abgeleitet aus `.settings-switch-row` + Media-Query 768px in app.css, angewandt auf alle Hosts
- Shadow-DOM-internes Layout nur über Host-CSS/Custom Properties (kein ::part in app.css gefunden)

## Verworfen
- — (nichts verworfen in dieser Phase)

## Offen
- — (nichts offen — Analyse abgeschlossen)

## Nächster Schritt
- Fertig. Issue-Body editiert, UX-Beratung sichtbar, VERDICT: ux-ready. Nächste Phase: Spec (TDD mit roten Tests als Vertrag).

## Fallstricke
- #1017 nicht mit #971 verwechseln — #971 war Settings-spezifisch (Switch↔Alert), #1017 ist app-weite Switch-Einheitlichkeit + mobiles Umschalten
- KoliBri-Host ist block-level/width:100% als Flex-Item — Breiten explizit teilen (Memory 2026-08-24)
- „Kein horizontaler Scroll"-AKs per Bounding-Box prüfen, nicht scrollWidth (Memory 2026-08-24)
- Fokus/aria-checked in KoliBri-Shadow-DOM: toBeChecked(), nicht Attribut (Memory 2026-08-24)
- Checklisten-Switch hat besonderes Layout (Zeilenlayout Switch → Titel → Entfernen) — evtl. ausnehmen
- Full-Bleed auf Mobil braucht negative margin-inline + Padding (Memory 2026-08-24)
