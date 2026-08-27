# Issue 1051 — Triage-Phase (abgeschlossen 2026-08-27)

Verdict: analyzed (🟢, keine offenen Fragen). Body mit KI-ANALYSE + ai-phase-routing geschrieben
(`.ai-memory/issue-1051-body.md` ist der Body-Snapshot), Titel angepasst, Labels:
`ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt.

## Erledigt
- Issue-Body analysiert (einziger Kommentar war der ai-quality-Bot, keine Entscheidungen)
- Screenshot (GitHub user-attachment) per Bildanalyse ausgewertet — bestätigt beide Mängel
- Analysis-Block + Routing-Tabelle in den Body geschrieben, stand=2026-08-27T02:21:43Z
- Titel geändert zu „UX/UI: Header-Toolbar-Buttons einheitlich + Mikrofon-Button im Such-Dialog ausrichten“

## Relevante Stellen
- `frontend/src/App.tsx:387-439` — `toolbarItems` (6 Items); einziges `primary` ist „Neuen Task anlegen“ (Zeile 402), Rest `secondary` → URSACHE 1 (uneinheitliche Variante)
- `frontend/src/App.tsx:477` — `<KolToolbar>` rendert die Items im Shadow-DOM (Varianten nur via `_variant` steuerbar)
- `frontend/src/app.css:1279-1283` — `.voice-field--input > .mic-button { top:50%; translateY(-50%) }` zentriert auf GESAMTEN Wrapper inkl. Label über der Inputbox → URSACHE 2 (Mic-Button klebt an oberer Inputkante)
- `frontend/src/app.css:1258-1278` — Overlay-Kommentar dokumentiert Bottom-Anker + vorgesehene Inputbox-Höhen-Kalibrierung als Custom Property (noch nicht vorhanden — keine `--pp-input*`-Var existiert)
- `frontend/src/components/SearchModal.tsx:45-65` — Such-Dialog, nutzt `VoiceField variant="input"`
- `frontend/src/components/VoiceField.tsx:70-89` — Mic-Button ist Light-DOM (`.mic-button`, 2rem rund, `tabIndex={-1}`, #522 AC2c — nicht ändern)
- Weitere `variant="input"`-Call-Sites, die die CSS-Korrektur mitbekommen: `TaskForm.tsx:722/913`, `QuickCaptureModal.tsx:137`, `PillarAdvisorModal.tsx:142`
- `frontend/src/app.css:360-362` — `--a11y-min-size: var(--pp-toolbar-height)` für Toolbar-Button-Höhe (Randbedingung, nicht anfassen)

## Annahmen
- „Einheitlich“ = Mehrheits-Variante `secondary` (5 von 6 Items; Issue misst nur Konsistenz, keine Farb-Vorgabe) — UX-Phase (haiku/low) kann das noch segnen
- Screenshot-Beschreibung (Mic „ca. halbe Button-Höhe zu hoch, an oberer Inputkante“) ist mit der CSS-Geometrie (Label-Höhe/2) konsistent — nicht am laufenden App verifiziert

## Verworfen
- Git-Historie zu beiden Stellen (`git log -S`) — nur Squash-Release-Commits (1d5b37f), kein Regressions-Nachweis, kein Erkenntnisgewinn
- Splitting des Issues — zwei winzige Styling-Fixes in einem PR (gleiche Fläche, Issue-Metrik nennt beide zusammen)

## Offen
- keine (Phase abgeschlossen; Pipeline macht mit UX-Phase weiter, Routing: ux haiku/low, spec sonnet/low, impl sonnet/low, review sonnet/medium)

## Nächster Schritt
- UX-Phase: kurze Bestätigung „alle Toolbar-Buttons auf secondary“ + Mic-Ausrichtung (kein Design-Konflikt erkennbar)

## Fallstricke
- Toolbar-Buttons liegen im KoliBri-Shadow-DOM: Varianten-„Fix“ per Light-DOM-CSS greift NICHT — nur `_variant` am Item (App.tsx:402)
- CSS-Fix wirkt global auf alle `variant="input"`-VoiceFields — nach Fix TaskForm/QuickCapture/PillarAdvisor gegenchecken, nicht nur SearchModal
- Mic-Button muss `tabIndex={-1}` bleiben (#522 AC2c: kein eigener Tab-Stop)
- e2e: Playwright pierct offene Shadow-Roots — Toolbar-Buttons/Ausrichtung per Bounding-Box/computed style asserten; `--pp-toolbar-height`-Gefüge (app.css:348-362) nicht kaputt machen
