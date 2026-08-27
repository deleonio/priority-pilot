# Issue 1051 — Impl-Phase (abgeschlossen 2026-08-27)

## Erledigt
- Spec-Draft-PR #1054 ausgecheckt (Branch `feat/issue-1051-header-toolbar-mic-align`)
- `frontend/src/App.tsx`: `_variant: 'primary'` → `'secondary'` beim Item „Neuen Task anlegen“ (AK1)
- `frontend/src/app.css` (`.voice-field--input > .mic-button`): `top:50%/translateY` ersetzt durch `bottom: calc((var(--pp-input-height, 2.75rem) - 2rem) / 2)` (AK2)
- e2e `issue-1051-header-toolbar-mic-align.spec.ts`: 3/3 grün (AK1/AK2/AK3 inkl. 375px)
- Kollateral-Check: `search-modal.spec.ts` 3/3 grün
- Gate: format/prettier/lint/knip/frontend-test grün; server-test 1 vorbestehender Redis-Failure (analog main, `session.test.ts:249`)
- Commit `388f40ef` gepusht, PR #1054 ready gesetzt, Body erweitert (`.ai-memory/issue-1051-pr-body.md`)

## Relevante Stellen
- `frontend/src/App.tsx:402` — Variante des Task-anlegen-Toolbar-Items (jetzt secondary)
- `frontend/src/app.css:1279-1284` — Mic-Button Bottom-Anker mit `--pp-input-height` (Default 2.75rem)
- `frontend/e2e/issue-1051-header-toolbar-mic-align.spec.ts` — Akzeptanz-Vertrag, unverändert gelassen

## Annahmen
- KoliBri-Inputbox-Höhe 2.75rem als Default — e2e bestätigt Zentrierung in allen `variant="input"`-Call-Sites (SearchModal + search-modal-375px-Test grün)
- Server-Test-Failure ist rein umgebungsbedingt (kein Redis in der Sandbox; auf main ebenso rot verifiziert)

## Verworfen
- Impeccable-Detector — Skill existiert nicht im Repo (`.claude/skills/impeccable/` fehlt)
- Playwright-MCP-Layout-Check — durch e2e (375px + Default-Viewport) abgedeckt

## Offen
- -

## Nächster Schritt
- Review-Phase: PR #1054 kreuzverhören

## Fallstricke
- `--pp-input-height` ist neu; falls KoliBri-Theme die Inputbox-Höhe ändert, Custom Property überschreiben
- Toolbar-Variante nur über `_variant` steuerbar (Shadow-DOM), nicht per Light-DOM-CSS
