# Issue #1033 — Phase 1 (Triage), Stand 2026-08-26T01:56:34Z

## Erledigt

- Erst-Triage (kein KI-ANALYSE-Block, keine Kommentare im Issue vorhanden).
- Titel unveraendert gelassen ("UX/UI - Update Message mobile Styling") — bildet die Beschreibung korrekt ab.
- Body lektoriert (nur Grammatik: "Schalter" als "Schalter (Aktions-Button)" praezisiert, Satzbau) + KI-ANALYSE-Block mit `stand=2026-08-26T01:56:34Z` geschrieben. Quelle des Bodys liegt in `.ai-memory/issue-1033-body.md`.
- Labels: `ai:analysed` + `ai:needs-ux-ui` gesetzt, `ai:needs-analyse` entfernt.
- Ampel 🟢, UI-Bezug ja, Spec noetig ja, Aufwandsklasse sonnet.
- Kein Ping-Kommentar (Vorgabe: eindeutiges Ergebnis = Body-Block + Label reicht).

## Relevante Stellen

- `frontend/src/components/UpdatePrompt.tsx` — die betroffene Komponente; zwei `KolCard` (Update/Offline) mit `KolButton` in nativen `span`-Wrappern (`data-testid="pwa-update-reload"` / `"pwa-offline-close"`), Texte "Neue Version verfuegbar" (Z. 33) und "App ist offline-bereit" (Z. 41).
- `frontend/src/app.css:1548-1572` — Block `.update-prompt`: `position: fixed` unten, `pointer-events: none` am Container, `pointer-events: auto` auf `kol-card`, Safe-Area-Padding.
- `frontend/src/app.css:239-249` und `:1143-1144` — vorhandenes 44px-Touch-Target-Muster (`--pp-toolbar-height: 2.75rem`, `min-width/height: 44px`), Vorbild fuer die Umsetzung.
- `frontend/src/components/UpdatePrompt.test.tsx` — Vitest-Unit-Ebene, hier liegen alle prueffbaren AKs.
- `frontend/e2e/pwa-update-prompt.spec.ts:5-13` — dokumentiert, warum der Update-Prompt in Playwright NICHT ausloesbar ist (echter SW-`waiting`-Zustand noetig).

## Annahmen

- Die "Notifikation" aus dem Screenshot (1713x182, breites Banner unten) ist der PWA-Update-Hinweis `UpdatePrompt`. Einziger Kandidat im Repo (`find -iname "*update*"` / `*notif*` in `frontend/src` liefert nur `UpdatePrompt.tsx` + Test). Screenshot selbst wurde NICHT geoeffnet.
- "Schalter" = der Aktions-Button ("Neu laden" / "Schliessen"), nicht ein Toggle/Switch-Control — die Komponente hat keinen Switch.
- Der exakte neue Wortlaut der Texte ist bewusst offen gelassen und Aufgabe der UX-Phase (2/7); AK4/AK5 geben nur den prueffbaren Rahmen.

## Verworfen

- e2e-Testfall fuer die Geometrie (375px): verworfen, weil der Prompt an einem echten SW-`waiting`-Zustand haengt — steht so schon als bewusste Entscheidung in `frontend/e2e/pwa-update-prompt.spec.ts:5-13`. Stattdessen visuelle Verifikation + Klassennaht-Unit-Test.
- `scrollWidth <= viewport` als Overflow-Assertion: verworfen (App-Shell clippt mit `overflow-x: hidden`, Assertion hat keinen Biss — MEMORY.md 2026-08-24).
- Zerlegung in Sub-Issues: nicht noetig, eine Komponente + ein CSS-Block, in einem PR machbar.

## Offen

- -

## Naechster Schritt

- Phase 2 (UX): KI-UX-Block schreiben — konkreten Textvorschlag fuer Update- und Offline-Karte formulieren und die mobile Button-Breite/Touch-Target-Loesung (Full-Width-Wrapper + 44px) festlegen.

## Fallstricke

- Klick-Naht NICHT auf `KolButton._on.onClick` umbauen: der Handler muss auf dem nativen `span`-Wrapper bleiben, sonst brechen die JSDOM-Tests (Begruendung steht als Kommentar in `UpdatePrompt.tsx:12-16`).
- `pointer-events: none` am Container `.update-prompt` darf nicht wegfallen — sonst blockiert das Overlay die ganze App.
- Bei einem Full-Width-Button gilt MEMORY.md 2026-08-24 (KoliBri/Flex-Row): KoliBri-Hosts sind block-level und fuellen als Flex-Item die Zeile — Breiten explizit vergeben statt `flex-shrink: 0`.
- `.ai-memory/issue-1033-body.md` ist nur die Schreibquelle fuer den Issue-Body, keine Notiz — nicht als Phasenstand lesen.
