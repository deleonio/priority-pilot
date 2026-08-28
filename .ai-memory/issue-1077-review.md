# Issue 1077 — Review (Phase 5) — 2026-08-28

## Erledigt
- MODE bestimmt: kein `<!-- ai-review -->`-Kommentar auf PR #1078 vorhanden → Kreuzverhör (Runde 1).
- Diff (3 Dateien: `docs/spec/issue-1077.md`, `frontend/e2e/pwa-update-prompt.spec.ts`, `frontend/src/app.css`) + Issue-AKs (KI-ANALYSE-Block, Closing-Issue #1077 verifiziert via `closingIssuesReferences|length` = 1) geprüft.
- e2e LOKAL verifiziert (nicht nur PR-Body geglaubt): Deps via `corepack pnpm install --frozen-lockfile` + `playwright install chromium`, dann `corepack pnpm exec playwright test e2e/pwa-update-prompt.spec.ts` in `frontend/` → **10 passed** (AK1 `:244`, AK2 `:258`, AK3 `:271` + alle #353/#373/#1034-Regressionstests).
- Testpflege AK1 (d00e68b4, `expect(m.left).toBe('auto')` → geometrische Rect-Assertions) als **bestätigte** Testkorrektur gewertet: per CSSOM unerfüllbar (computed `left` = verwendeter px-Wert bei `position: fixed`), PR-Body Abschnitt „Testpflege AK1“ dokumentiert es, Spec (`docs/spec/issue-1077.md` AK1-Zeile) wurde mitgezogen, Vertrag bleibt scharf (vollbreit ⇒ `rect.left` = 0 ⇒ rot).
- Titel-Gate: PR von „Ausrichtung Notifikation im Desktop (#1077)“ umbenannt → `feat(frontend): align update prompt bottom right on desktop (#1077)` (67 Zeichen).
- Sammelkommentar EINMAL mit Marker `<!-- ai-review -->` erstellt (Update statt Neu-Anlage kam nicht in Frage — keiner existierte): https://github.com/deleonio/priority-pilot/pull/1078#issuecomment-5447529220 — Verdict `reviewed`, Review-Typ: Kreuzverhör, Updated: 2026-08-28.

## Relevante Stellen
- `frontend/src/app.css:1645-1651` — Desktop-Override (`left: auto; max-width: 480px; align-items: flex-end;`) im bestehenden `min-width: 768px`-Block; einziges Produktivänderung.
- `frontend/e2e/pwa-update-prompt.spec.ts:214-281` — #1077-Testblock (AK1 geometrisch, AK2 max-width, AK3 mobil vollbreit).
- `docs/spec/issue-1077.md` — AK1-Zeile + CSSOM-Hinweis mit d00e68b4 mitgezogen (Vertrag und Test laufen nicht auseinander).
- `frontend/e2e/pwa-update-prompt.spec.ts:60` — #373-Vertragstest `position: fixed`, der `position: static` als Ausweg ausschliesst.

## Annahmen
- CI-Checks (`e2e 1-4`, `verify`, `review`) waren beim Review-Abschluss `pending`, nicht rot — grüner Inhalt bewertet, Ready-to-merge entscheidet der deterministische Gate-Step der Pipeline.
- Server-Suite-Abbruch (`session.test.ts`, Redis) als pre-existing übernommen (laut PR-Body per `git stash` verifiziert); nicht selbst nachgestellt.

## Verworfen
- Inline-Review-Kommentare: keine Findings — nichts zu verankern.
- needs-human: kein Architektur-/Produkt-Decision-Point; 480px ist als Empfehlungswert im Issue freigegeben, Grenze ≤ 480px im Test verankert.

## Offen
- —

## Nächster Schritt
- —

## Fallstricke
- `npx playwright` in dieser Sandbox löst das Modul global auf (`ERR_MODULE_NOT_FOUND`) — im `frontend/` `corepack pnpm exec playwright` nehmen; `pnpm`/`node_modules` fehlen frisch (global pnpm 9 reicht nicht, Lockfile braucht `corepack pnpm@11.9.0`).
- `grep -c "Test-Pflege-Bedarf"` auf den PR-Body schlägt fehl, obwohl die Doku drin steht — der Abschnitt heisst live „Testpflege AK1 (d00e68b4)“. PR-Body immer lesen, nicht nur Stichworte aus den Phasen-Notizen matchen (Body wurde nach dem Fixup aktualisiert).
- `gh pr edit` kennt kein `--json` — Verifikation der Umbenennung separat via `gh pr view --json title`.
