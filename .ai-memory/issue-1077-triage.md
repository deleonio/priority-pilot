# Issue 1077 — Triage (Phase 1)

## Erledigt
- Issue analysiert (Initial-Triage, kein Block vorhanden; einziger Kommentar war ai-quality-Bot).
- Analyseblock + Routing-Tabelle in den Body geschrieben via `.ai-memory/issue-1077-body.md` + `gh issue edit 1077 --body-file` (stand=2026-08-27T20:51:28Z).
- Labels: `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt.
- Body minimal kopflektoriert (nur Komma in „klar definierte, isolierte Änderung“); Titel unverändert („Ausrichtung Notifikation im Desktop“ — inhaltlich korrekt).
- Kein Ping-Kommentar (unambiguous, 🟢). Kein Split (ein PR). Kein Auto-Close (Anforderung ist NICHT implementiert).

## Relevante Stellen
- `frontend/src/app.css:1604-1617` — Basisregel `.update-prompt` (fixed, bottom/left/right: 0, Flex-Column) → hier greift die Vollbreite an.
- `frontend/src/app.css:1638-1648` — bestehender `@media (min-width: 768px)`-Block für dieselbe Klasse → Anker für die Desktop-Overrides.
- `frontend/src/app.css:1628-1636` — #1034-Mobile-Tap-Fläche (kol-button 100%/44px) → darf nicht brechen.
- `frontend/src/components/UpdatePrompt.tsx` — rendert `.update-prompt`; TSX bleibt unangetastet (reine CSS-Änderung).
- `frontend/e2e/pwa-update-prompt.spec.ts:58-94` — CSS-Kontrakt-Testmuster (Stellvertreter-Element injizieren, getComputedStyle lesen); neue AKs dort anfügen.

## Annahmen
- max-width 480px als Empfehlung (Grenze in AK2: ≤ 480px), zur Feinjustierung freigegeben.
- Lösungsskizze im Body: im 768px-Media-Query `left: auto; max-width: 480px; align-items: flex-end;` ergänzen.

## Verworfen
- Änderung an `UpdatePrompt.tsx` — nicht nötig, reine CSS-Angelegenheit.
- Neuer Test für AK4 (Mobile-Tap-Target) — durch bestehende #1034-Tests abgedeckt (Regressionsschutz genügt).

## Offen
- -

## Nächster Schritt
- Phase ux (Routing: ja/haiku/low): KI-UX-Block schreiben; danach spec → impl → review gemäß Routing-Tabelle im Issue-Body.

## Fallstricke
- `.update-prompt` ist Flex-Column: ohne `align-items: flex-end` strecken die Cards im Container weiter; `left: 0` muss im Media-Query überschrieben werden, sonst bleibt der Container vollbreit verankert.
- E2e für echte SW-Updates nicht deterministisch (#353) — Tests nur als CSS-Kontrakt mit injiziertem Stellvertreter schreiben.
