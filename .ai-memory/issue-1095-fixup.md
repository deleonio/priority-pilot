# Issue 1095 — Fixup (PR #1097), Stand 2026-08-28

## Erledigt
- Findings gelesen: 3 Inline-Review-Kommentare (my-github-action-bot, 2026-08-28T16:58:28Z) + `ai-review`-Sammelkommentar (needs-fixup, Runde 1). Alle drei eindeutig fixbar, **kein** Entscheidungs-Finding.
- **F1** (Verhalten, `UpdatePrompt.tsx:37-41`): `bestätigtRef`-Early-Return blockierte auch `updateServiceWorker(true)` → Button war nach dem ersten Klick dauerhaft tot, wenn kein `controllerchange` eintrifft. Fix: nur die Listener-Registrierung ist einmalig (`listenerRegisteredRef`), `updateServiceWorker(true)` läuft bei jedem Klick. Kommentar dazu angepasst.
- **F2** (Naming, `UpdatePrompt.tsx:33-34`): Nicht-ASCII-/verschriebene Bezeichner → `listenerRegisteredRef` + `reloadedRef` (englisch camelCase, konsistent mit `deleteFallbackRef`/`onCloseRef`).
- **F3** (vakue E2E-Assertion, `pwa-update-prompt.spec.ts:355`): `toHaveCount(0)` auf `.update-prompt` nach dem Reload konnte nie fehlschlagen (injiziertes div stirbt mit dem Reload, echter Prompt nie gemountet) → gestrichen, Ersatz-Kommentar verweist auf AK1–AK3 (Unit) für das echte Verschwinden.
- **Zusatztest** (F1-Absicherung): `UpdatePrompt.test.tsx` — „mehrfacher Klick wiederholt updateServiceWorker, registriert den Listener aber nur einmal" (3 Klicks → `updateServiceWorker` 3× mit `true`, `addEventListener` 1×) in der #1095-Suite.
- Gate (lokal, vor Push): `pnpm format` grün, `prettier --check .` grün, `pnpm lint` grün (server tsc+eslint, frontend tsc --noEmit + eslint src e2e), `vitest run src/components/UpdatePrompt.test.tsx` **22/22 grün** (21 bestehende + 1 neuer).
- CI vor dem Lauf: alle Jobs pass (e2e 1–4, verify, precheck); einzig offener Job = dieser `fixup`-Lauf. Kein roter CI-Befund.

## Relevante Stellen
- `frontend/src/components/UpdatePrompt.tsx:26-52` — `confirmUpdate()`: `updateServiceWorker(true)` vor dem Once-Guard, dann einmalige Listener-Registrierung; Reload-Idempotenz über `reloadedRef`.
- `frontend/src/components/UpdatePrompt.test.tsx:228-…` — #1095-Suite (AK1–AK3 unverändert = Vertrag), neuer F1-Test zwischen AK2 und AK3.
- `frontend/e2e/pwa-update-prompt.spec.ts:353-356` — AK4-Test, End-Assertions jetzt nur Dashboard-Heading + Reload-Zähler.

## Annahmen
- Das Streichen der nicht fehlbaren E2E-Assertion kann den AK4-Test nicht rot machen (sie konnte definitionsgemäß nie fehlschlagen) → lokaler E2E-Lauf wegen Soft-Deadline (1787937011, mitten im Lauf) entfallen; CI-e2e 1–4 verifizieren.
- Review-Option „Doppelklick-Guard behalten + per Test nageln" ist NICHT gemeint gemeint: der Finding-Kommentar nennt sie nur als Alternative für den Fall bewussten Wollens; Primärvorschlag (nur Registrierung once) umgesetzt.

## Verworfen
- `{once: true}` für den Listener — würde die AK1-Assertion `toHaveBeenCalledWith('controllerchange', expect.any(Function))` brechen (drittes Options-Argument); Begründung steht schon im PR-Body.
- Knip/`pnpm test` (Full-Suite) im Gate — keine neuen Exports, `session.test.ts`-Exit-1 ist pre-existing (kein Redis in der Sandbox, MEMORY 2026-08-27); abgedeckt durch lint (tsc) + gezielte Vitest-Datei.

## Offen
- Lokaler E2E-Lauf (AK4) nicht gefahren (Deadline) — muss der CI-e2e-Job zeigen; falls rot: nur die neu strukturierte Kommentar-Zeile von F3 prüfen.

## Nächster Schritt
- CI von PR #1097 beobachten; wenn grün, Threads F1–F3 mit Commit-SHA beantworten + resolven (GraphQL `resolveReviewThread(input:{threadId})`, MEMORY 2026-08-23).

## Fallstricke
- `updateServiceWorker(true)` muss VOR dem Once-Guard stehen — sonst ist F1 wieder da (Guard vor Reload-Aufruf).
- AK1 assertiert `addEventListener` `toHaveBeenCalledTimes(1)` → der neue Test muss die Once-Registrierung mitprüfen, darf aber nicht zusätzlich dispatchen (sonst kollidiert er mit dem Reload-Mock des beforeEach).
- `server/src/api.d.ts` wird bei `pnpm lint` durch openapi-typescript regeneriert — blieb hier byte-identisch; vor dem Commit `git status` gegenprüfen, sonst landet Generate-Rauschen im Fixup-Commit.
- Soft-Deadline lag mitten im Lauf → Gate auf schnelle Teile (format/prettier/lint/gezielte Vitest-Datei) verdichtet statt Full-Suite.
