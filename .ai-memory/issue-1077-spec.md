# Issue 1077 — Spec (Phase 3)

## Erledigt
- Branch `feat/issue-1077-desktop-notification` (fresh, kein Resume-Hint), keine offene PR-Vorläufer (geprüft: `gh pr list` leer).
- Spec angelegt: `docs/spec/issue-1077.md` (AK-Tabelle AK1–AK4 + Testmapping).
- 3 rote e2e-Tests angefügt: `frontend/e2e/pwa-update-prompt.spec.ts:214-281` (describe „UpdatePrompt Desktop-Ausrichtung (#1077)", AK1/AK2 rot, AK3 grüner Kontrakt/Regressionsschutz).
- Dedup: AK4 nicht neu getestet — bestehende #1034-Testfälle derselben Datei decken es ab.
- Red-Signatur verifiziert: `npx playwright test e2e/pwa-update-prompt.spec.ts` → 2 failed (AK1: left `0px` statt `auto`; AK2: max-width `none`), 8 passed.
- Commit `test: red spec tests for #1077` gepusht; Draft-PR #1078 „Ausrichtung Notifikation im Desktop (#1077)" erstellt (Closes #1077, kein Label gesetzt, verified via `gh pr view`).

## Relevante Stellen
- `frontend/src/app.css:1604-1617` — Basisregel `.update-prompt` (fixed, left/right: 0) → Implementierung muss hier im Desktop-Zweig überschreiben.
- `frontend/src/app.css:1638-1648` — `@media (min-width: 768px)`-Block → Anker für `left: auto; max-width: 480px; align-items: flex-end;`.
- `frontend/e2e/pwa-update-prompt.spec.ts:214` — neuer #1077-Testblock (Proxy-Metriken: left/right/maxWidth/width/viewportWidth).
- `docs/spec/issue-1077.md` — Spec (AK1-AK4).

## Annahmen
- `max-width: 480px` als Empfehlungswert; Test verankert nur Grenze ≤ 480px (AK2).
- AK3 ist als Regressionsschutz grün zugelassen (verhindert, dass die Desktop-Override die Basisregel bricht).

## Verworfen
- Test für `align-items: flex-end` (Cards auf Inhaltsbreite) — steht nicht in den AKs, nur in der Lösungsskizze; Impl-Phase freiwillig.
- Test für AK4 — Dedup, #1034-Tests genügen.

## Offen
- Playwright-Browser mussten lokal installiert werden (`npx playwright install chromium`) — Runner-Cache, kein Code-Issue.

## Nächster Schritt
- Phase impl: CSS-Ergänzung im 768px-Media-Query (`left: auto; max-width: 480px; align-items: flex-end;`) — AK1/AK2 müssen grün werden, AK3 + #1034-Tests bleiben grün.

## Fallstricke
- Playwright `page.evaluate(<string>)` führt den String als Expression aus: nackte `return`-Statements → „Illegal return statement". Proxy-Code als IIFE `(() => {...})()` im Template-Literal verpacken.
- `page.evaluate` mit String liefert `unknown` → TS18046; Generik `page.evaluate<ProxyMetrics>(measureProxy)` nutzen.
- Template-Literal-Backticks per Python heredoc erzeugen leicht korrupte Datei (`` ` + '`' + ` `` landete literal im File) — zweimal nachgebessert; beim Schreiben von JS mit Backticks direkt das Write-Tool nehmen.
