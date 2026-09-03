# Issue 1186 — Implement (Red→Green), Stand 2026-09-03

## Erledigt
- Draft-PR #1189 (Branch `ai/harness/1186`, Closing-Referenz auf #1186 verifiziert) ausgecheckt; lokale untracked Phasen-Notizen blockierten den Switch → nach /tmp gesichert, gelöscht, Branch hat sie committet.
- Fix: `frontend/src/lib/popoverAlign.ts` — in `correct()` neben `width: max-content` zusätzlich Inline-`overflow: visible` am Panel (gleiches Guard-Muster `if (panel.style.overflow !== 'visible')`), Doc-Kommentar um die Overflow-Regel + #1186 ergänzt.
- E2E-Verifikation: `cd frontend && npx playwright test e2e/issue-1186-popover-focus-outline.spec.ts` → **3 passed (AK1, AK2, AK3@375px)** — vorher rot laut Spec-Notiz.
- Gate (gate-runner, komplett grün): `pnpm format` exit 0 · `prettier --check` exit 0 · `lint` exit 0 (tsc+eslint) · `knip` exit 0 (nur Config-Hints) · `test` exit 0 — server 251/251 (1 skip), frontend 499/499 (13 skips); Redis-Suite skipped lokal by design, kein Befund.
- `pnpm format` hat die Spec-Datei mechanisch umgebrochen (2 expect-Zeilen + 1 Test-Signatur) — Assertions unverändert, im PR-Body als Formatierungshinweis dokumentiert (kein Test-Pflege-Bedarf).

## Relevante Stellen
- `frontend/src/lib/popoverAlign.ts:28-35` — der Fix (Inline-Style-Writes am Shadow-DOM-Panel).
- `frontend/e2e/issue-1186-popover-focus-outline.spec.ts` — unverändert übernommen (Vertrag, keine Test-Änderung).
- `frontend/e2e/{crud,keyboard-shortcuts,dependency-editor}.spec.ts` — öffnen dasselbe Popover; Änderung ist rein additiv (zusätzlicher Inline-Style), keine Verhaltensänderung für sie.

## Annahmen
- Additiver Inline-Style gefährdet bestehende Popover-E2Es nicht (nur geändertes computed overflow am Panel, kein Layout-Eingriff).
- @public-ui-Pins 4.3.0 unangetastet (AK1-Vertrag).

## Verworfen
- Stale Doc-Zeile „Avatar-Menü (App)" im Helper reparieren — außerhalb Scope (Triage-Fallstrick).
- Unit-Test — weiter verboten (migration-check, s. Spec-Notiz).

## Offen
- PR #1189 aus Draft holen (`gh pr ready 1189`) + Body mit Impl-Zusammenfassung/Gate-Ergebnissen erweitern.

## Nächster Schritt
- Commit (Fix + diese Notiz im SELBEN Commit), Push, `gh pr ready 1189`, PR-Body erweitern.

## Fallstricke
- Soft-Deadline 1788395096 knapp — Gate fokussiert, E2e-Neuläufe der Alt-Specs nur bei Bedarf.
- `pnpm test` lokal: session.test.ts (Redis) bekannt rot ohne Redis-Service (MEMORY 2026-08-27/29) — im PR-Body dokumentieren, nicht fixen.
