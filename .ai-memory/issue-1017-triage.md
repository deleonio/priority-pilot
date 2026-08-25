# Issue #1017 — Triage „UX: Buttons ‚Push testen‘ + ‚Standort jetzt ermitteln‘ vereinheitlichen“

## Erledigt
- RE-TRIAGE 2026-08-25 nach Autoren-Kommentar (11:05Z): Scope grundlegend korrigiert — es geht NICHT um Switches, sondern nur um die beiden Aktions-Buttons.
- Titel + Body neu geschrieben (`gh issue edit`), alter KI-ANALYSE-Block (Switches app-weit) und alter KI-UX-Block + „VERDICT: ux-ready“-Zeile ENTFERNT (falscher Scope).
- Neuer KI-ANALYSE-Block (stand=2026-08-25) im Body verifiziert (START+END, kein KI-UX mehr).
- Ping-Kommentar gepostet (issuecomment-5409515786).

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx:204-220` — KolButton „Push testen“ (nur bei pushEnabled), `class="push-test-btn"`, `_variant="secondary"`.
- `frontend/src/components/SettingsPage.tsx:268-278` — KolButton „Standort jetzt ermitteln“ (nur bei geoEnabled), OHNE Layout-Klasse → füllt volle Zeile; Remount-Key `geoPending` (:269); danach `.geo-address` (:279).
- `frontend/src/app.css:1430-1432` — `.push-test-btn { align-self: flex-start }` (#932 AK1): inhaltsbreit in ALLEN Viewports — Ursache der Uneinheitlichkeit.
- `frontend/src/app.css:1409-1420` — `.settings-general`: flex-column, gap 16dp, padding-inline 1.5rem (Buttons sind direkte Kinder, „gestapelt“ strukturell schon vorhanden).
- `frontend/src/app.css:1445-1479` — `.settings-switch-row`: Mobile-First-Responsive-Muster (mobil Default, `@media (min-width:768px)` Desktop) — Vorbild für die Breitenschaltung.
- `frontend/e2e/push-test-button.spec.ts:19-47` — Fake-ServiceWorker-Init-Script macht „Push testen“ im e2e sichtbar (pushEnabled ohne echte Permission).
- `frontend/e2e/settings-switch-layout.spec.ts` — #971-Bounding-Box-Viewport-Test-Vorbild.
- `frontend/e2e/geolocation.spec.ts` — Muster, Geo im e2e zu aktivieren (nicht im Detail gelesen).
- `frontend/src/components/SettingsPage.test.tsx:77-110` — bestehende Selektoren `kol-button[_label="Standort jetzt ermitteln"]` dürfen nicht brechen.

## Annahmen
- Gewollt: beide Buttons identisch — desktop (≥768px) inhaltsbreit linksbündig (`align-self: flex-start`), mobil (<768px) volle Container-Innenbreite (Flex-Default stretch), je eigene Zeile.
- „Gestapelt“ ist bei einzelnen Buttons bereits durch flex-column-Container gegeben; Vereinheitlichung = Breitenschaltung je Viewport.
- Offene UX-Detailfrage (für UX-Phase): mobil Full-Bleed über Container-Padding (wie .settings-switch-row) oder Container-Innenbreite ausreichend.

## Verworfen
- Alte Switch-Analyse (6 Fundstellen app-weit) — durch Autoren-Kommentar gegenstandslos.
- Zerlegung in Sub-Issues — ein Anliegen (2 Buttons, 1 Komponente + CSS), 1 PR.
- KoliBri `_inline` für Desktop — verletzt 44px-Touch-Target (app.css:1426-Kommentar, #932).

## Offen
- - (nichts — Re-Triage abgeschlossen)

## Nächster Schritt
- Fertig. VERDICT: spec-ready. Nächste Phase: UX (UI-Bezug ja) — muss NEU laufen, alter UX-Block war Switch-Scope und wurde entfernt.

## Fallstricke
- ALTER Stand (vor 2026-08-25 11:05Z): Analyse + UX-Block zielten auf Switches — das war falsch verstanden; „Schalter“ meinte im Originalticket die Buttons.
- Beide Buttons sind bedingt gerendert (pushEnabled/geoEnabled) — e2e braucht Fake-ServiceWorker-Init-Script (push-test-button.spec.ts) bzw. Geo-Aktivierung (geolocation.spec.ts).
- #932-AK1 („nicht volle Flex-Breite“) gilt weiter, aber nur noch als Desktop-Zweig — mobil ist Vollbreite jetzt gefordert; Kommentar in app.css:1423 mit anpassen.
- KoliBri-Host block-level: keine `flex-shrink:0`-Muster; Breiten per Bounding-Box, nicht scrollWidth (Memory 08-24).
- `.ai-memory/tmp-issue-1017-body.md` enthält den aktuellen Body (gitignored).
