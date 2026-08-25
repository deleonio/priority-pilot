# Issue #1017 — UX „Buttons 'Push testen' + 'Standort jetzt ermitteln' vereinheitlichen"

## Erledigt
- Issue-Body geladen (gh issue view 1017 --json body -q .body)
- MEMORY.md gelesen (.ai-memory/MEMORY.md, ticket-übergreifende Learnings)
- Design-System-Regeln gelesen: ux-design.md (Farbrollen, Skalen, Komponentenwahl, Layout, Mobile-first, Craft Floor), mobile-ui-rules.md (10 Regeln, Touch-Targets 44-48px, 375px Referenz, Anti-Patterns)
- KI-ANALYSE-Block gelesen (UI-Bezug ja, Spec ja, Aufwandsklasse sonnet, Umsetzungskontext mit betroffenen Dateien, AKs, Testfällen, Ampel 🟢)
- KoliBri-Komponenten-Doku gelesen (KolButton: Properties, _inline=false für 44px Minimum, _variant="secondary", Theme-Integration, block-level Host)
- UX-Beratung geschrieben zwischen KI-UX:START und KI-UX:END im Issue-Body (Abschnitte: Interaktion, Mobile-First, A11y/BITV, KoliBri, Design-Sprache, Offene UX-Fragen, Zusammenfassung)
- Issue-Body editiert (gh issue edit 1017 --body-file -) — UX-Beratung jetzt im Issue sichtbar
- VERDICT gesetzt: ux-ready (UX-Beratung geschrieben → Issue zur Implementierung bereit)

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx:204-220` — KolButton „Push testen" (nur bei pushEnabled), `class="push-test-btn"`, `_variant="secondary"`
- `frontend/src/components/SettingsPage.tsx:268-278` — KolButton „Standort jetzt ermitteln" (nur bei geoEnabled), OHNE Layout-Klasse → füllt volle Zeile; Remount-Key `geoPending` (:269); danach `.geo-address` (:279)
- `frontend/src/app.css:1430-1432` — `.push-test-btn { align-self: flex-start }` (#932 AK1): inhaltsbreit in ALLEN Viewports — Ursache der Uneinheitlichkeit
- `frontend/src/app.css:1409-1420` — `.settings-general`: flex-column, gap 16dp, padding-inline 1.5rem (Buttons sind direkte Kinder, „gestapelt" strukturell schon vorhanden)
- `frontend/src/app.css:1445-1479` — `.settings-switch-row`: Mobile-First-Responsive-Muster (mobil Default, `@media (min-width:768px)` Desktop) — Vorbild für die Breitenschaltung
- `frontend/e2e/push-test-button.spec.ts:19-47` — Fake-ServiceWorker-Init-Script macht „Push testen" im e2e sichtbar (pushEnabled ohne echte Permission)
- `frontend/e2e/settings-switch-layout.spec.ts` — #971-Bounding-Box-Viewport-Test-Vorbild
- `docs/mobile-ui-rules.md:40-73` — Regel 1 (Daumen-Zonen), Regel 2 (Touch-Targets 44-48px), Regel 3 (kein horizontales Scrollen), Regel 4 (Einstellungen flache Liste), Regel 6 (Skalen 4/8/12/16/24/32/48), Regel 7 (async Zustände)
- `.ai-knowledge/ux-design.md:72-88` — Skalen (Abstand 4/8/12/16/24/32/48/64, Typo 5 Größen, 2 Gewichte, 3 Radien, 2 Schatten, Bewegung 120/200ms)
- `.ai-knowledge/ux-design.md:118-126` — Layout: Mobile-first, 375px Basis, 48rem Haupt-Bruchpunkt, Max-width 80rem, Safe-Area-Insets
- KoliBri KolButton-Doku: _inline=false erzwingt 44px Mindestgröße, _variant="secondary" für sekundäre Aktionen, block-level Host für align-self, Theme-Tokens vererben sich in Shadow-DOM

## Annahmen
- Gewollt: beide Buttons identisch — desktop (≥768px) inhaltsbreit linksbündig (`align-self: flex-start`), mobil (<768px) volle Container-Innenbreite (Flex-Default stretch), je eigene Zeile
- „Gestapelt" ist bei einzelnen Buttons bereits durch flex-column-Container gegeben; Vereinheitlichung = Breitenschaltung je Viewport
- Offene UX-Detailfrage (für UX-Phase): mobil Full-Bleed über Container-Padding (wie .settings-switch-row) oder Container-Innenbreite ausreichend
- Full-Bleed ist aus UX-Sicht optional, nicht zwingend — Container-Innenbreite reicht für Buttons direkt unter Switches

## Verworfen
- — (nichts verworfen in dieser Phase)

## Offen
- — (nichts offen — UX-Beratung abgeschlossen)

## Nächster Schritt
- Fertig. Issue-Body editiert, UX-Beratung sichtbar, VERDICT: ux-ready. Nächste Phase: Spec (TDD mit roten Tests als Vertrag).

## Fallstricke
- ALTER Stand (vor 2026-08-25 11:05Z): Analyse + UX-Block zielten auf Switches — das war falsch verstanden; „Schalter" meinte im Originalticket die Buttons
- Beide Buttons sind bedingt gerendert (pushEnabled/geoEnabled) — e2e braucht Fake-ServiceWorker-Init-Script (push-test-button.spec.ts) bzw. Geo-Aktivierung (geolocation.spec.ts)
- #932-AK1 („nicht volle Flex-Breite") gilt weiter, aber nur noch als Desktop-Zweig — mobil ist Vollbreite jetzt gefordert; Kommentar in app.css:1423 mit anpassen
- KoliBri-Host block-level: keine `flex-shrink:0`-Muster; Breiten per Bounding-Box, nicht scrollWidth (Memory 08-24)
- gh-Tool-Parser timeout bei sehr langen Bodies (>8KB) — UX-Block muss gekürzt werden auf das Wesentliche
