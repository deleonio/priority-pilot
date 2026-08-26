# Issue #1031 — Triage (Phase 1/7)

## Erledigt

- Erst-Triage (kein KI-ANALYSE-Block vorhanden). Titel geändert auf
  „UX/UI: Update-Hinweis (PWA) mobil bedienbar machen und Text verständlicher formulieren".
- Body lektoriert (IST/Wunsch, Screenshot erhalten) + KI-ANALYSE-Block angehängt
  (Quelle: `.ai-memory/issue-1031-body.md`, stand=2026-08-26T00:38:01Z).
- Ampel 🟢, UI-Bezug ja, Spec nötig ja, Aufwandsklasse sonnet. Nicht zerlegt (eine Komponente + CSS + Tests, 1 PR).
- Ping-Kommentar gesetzt (issuecomment-5418952849). Keine Labels aufs Eltern-Issue.

## Relevante Stellen

- `frontend/src/components/UpdatePrompt.tsx` — die „Update Message": KolCard „Update" + Text
  „Neue Version verfügbar" + KolButton „Neu laden"; zweite Card „Offline".
- `frontend/src/app.css:1548-1573` — `.update-prompt` (fixed, bottom:0, pointer-events:none,
  safe-area-inset-bottom); KEINE `kol-button`-Regel vorhanden.
- `frontend/src/components/UpdatePrompt.test.tsx` — mockt `virtual:pwa-register/react` + KoliBri.
- `frontend/e2e/pwa-update-prompt.spec.ts` — CSS-Kontrakt via injiziertem Stellvertreter-Element.
- `frontend/src/app.css:973/1143/239-249` — 44px-Touch-Target-Konvention des Repos.
- `frontend/src/components/InstallPrompt.tsx` — Vorbild für menschlich formulierte Hinweistexte.

## Annahmen

- „Update Message" = `UpdatePrompt.tsx` (einzige Update-Meldung der App, Titel-Match).
- „Schalter" im Ticket = das Bedienelement der Card, also der Button „Neu laden" (die Komponente
  hat keinen Switch). Im Body als offene Frage für die UX-Phase vermerkt.

## Verworfen

- `SettingsPage.tsx` `.settings-switch-row` (Switch + Alert, #971) als Ziel — dort geht es um
  Push/Geo/Voice-Einstellungen, kein Update-Bezug.
- Zerlegung in Sub-Issues — nur eine Schicht (Frontend), zusammenhängende AK, in 1 PR machbar.

## Offen

- Screenshot der Issue-Beschreibung nicht lesbar: `curl` auf github.com/user-attachments wurde von
  der Sandbox-Permission abgelehnt (kein Netzzugriff im Bash-Tool). Zuordnung daher aus Titel+Code.

## Nächster Schritt

- Phase 2 (UX): Screenshot gegenprüfen und den KI-UX-Block ergänzen; danach Spec.

## Fallstricke

- `.update-prompt` hat `pointer-events: none` — neue interaktive Elemente brauchen explizit
  `pointer-events: auto` (bisher nur `kol-card`).
- Horizontal-Overflow ist hier NICHT per `scrollWidth` prüfbar (App-Shell clippt mit
  `overflow-x: hidden`) → Bounding-Box (`x + width ≤ viewportWidth`) messen.
- Klick-Naht: Handler sitzt auf `<span data-testid="pwa-update-reload">`, nicht auf dem KolButton —
  beim Umbau nicht verdoppeln.
- Schreiben nach `/tmp` ist in dieser Sandbox nicht erlaubt (Write-Permission) → Body-Dateien unter
  `.ai-memory/` ablegen.
