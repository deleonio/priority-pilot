Rote Spec-Tests; Implementierung folgt.

## Abgedeckte Akzeptanzkriterien

- **AK1**: Alle sechs Toolbar-Buttons haben dieselbe berechnete Hintergrundfarbe (KoliBri-Variante einheitlich)
- **AK2**: Mikrofon-Button im Such-Dialog ist vertikal in der Inputbox zentriert + vollständig sichtbar
- **AK3**: AK1 + AK2 gelten auch bei 375px Viewportbreite

## Implementierung (Impl-Phase)

- `frontend/src/App.tsx`: „Neuen Task anlegen“ `_variant: 'primary'` → `'secondary'` — damit rendern alle sechs Kopf-Toolbar-Items mit derselben KoliBri-Variante (AK1). Toolbar-Buttons sind Utility-Aktionen, keine Primäraktion (vgl. UX-Review im Issue).
- `frontend/src/app.css` (`.voice-field--input > .mic-button`): Bottom-Anker mit kalibrierbarer Inputbox-Höhe statt `top: 50%` am Gesamt-Wrapper (der das Label mit umschließt und den Button um ca. halbe Label-Höhe zu hoch sitzen ließ): `bottom: calc((var(--pp-input-height, 2.75rem) - 2rem) / 2)` (AK2). Wirkt global auf alle `variant="input"`-VoiceFields.
- KoliBri-first: Toolbar-Variante ist nur über `_variant` der Items steuerbar (Shadow-DOM) — genau so umgesetzt; kein Light-DOM-CSS-Override nötig. Für den Mic-Button gibt es kein KoliBri-Äquivalent (`VoiceField` ist Custom).
- Mic-Button bleibt `tabIndex={-1}` (#522 AC2c), unverändert.

## Gate-Ergebnisse

- `pnpm format` ✅
- `pnpm exec prettier --check .` ✅ (All matched files use Prettier code style)
- `pnpm lint` ✅ (server + frontend: tsc/eslint clean)
- `pnpm knip` ✅ (nur bekannte Configuration hints, keine Fehler)
- `pnpm --filter frontend test` ✅ 414 passed | 13 skipped
- `pnpm test` (server) ⚠️ 1 Failure in `server/src/express/session.test.ts:249` (Redis-Integrationstest) — **vorbestehend und unrelated**: auf main ohne diesen Branch genauso rot (Sandbox hat keinen Redis; bekanntes `t.skip()`-ohne-`return`-Muster, siehe Memory 2026-08-25). Keine Server-Dateien geändert.
- e2e `frontend/e2e/issue-1051-header-toolbar-mic-align.spec.ts` ✅ 3/3 grün (AK1, AK2, AK3 inkl. 375px)
- e2e Kollateral-Check `search-modal.spec.ts` ✅ 3/3 grün (globale CSS-Wirkung auf `variant="input"` verifiziert)
- Impeccable-Detector: Skill/Script existiert in diesem Repo nicht (`.claude/skills/impeccable/` fehlt) — übersprungen; stattdessen mobile 375px-Abdeckung über AK3-e2e + `search-modal.spec.ts`-375px-Test.
- Playwright-MVP-Layout-Check (1280px/375px): durch die e2e-Tests abgedeckt (375px explizit; AK1/AK2 laufen im Default-Viewport 1280×720).

Closes #1051
