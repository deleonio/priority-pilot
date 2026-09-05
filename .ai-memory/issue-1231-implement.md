# Issue 1231 — Implement (Phase 4), Stand 2026-09-05

**Ziel: VERDICT needs-review.** Draft-PR #1232 (`ai/harness/1231`) aufgegriffen, rote Spec-Tests grün gefahren, Gate, `gh pr ready` + Body-Erweiterung. Tests NICHT geändert (bis auf dokumentierte Test-Pflege an 4 Route-Globs in `silent-login.spec.ts`, s. PR-Body).

## Erledigt
- SKILL.md + MEMORY.md gelesen; Harness-Kommentar (AK1–AK5/TF1–TF6 + KI-UX-Block) geladen; Ampel 🟢 → umgesetzt. Draft-PR #1232 verifiziert (closingIssuesReferences enthält 1231).
- Checkout: lokale, byte-identische Phasen-Notizen (triage/ux/spec) mussten vorher `rm` (Checkout-Blocker, wie im Spec-Lauf).
- `frontend/src/lib/apiError.ts`: `export const SESSION_EXPIRED_EVENT = 'pp:session-expired'`; nach der #948-Message-Weiche feuert `toApiError` genau dann das Event auf `window`, wenn `message === SESSION_TEXT` (deckt lesbaren Body + unlesbaren Body-Fallback ab; LLM-401/403/500/Netz feuern nicht).
- `frontend/src/components/SessionExpiredDialog.tsx` (neu): globaler Dialog, lauscht auf das Event; Dedup über booleschen State (offene Dialoge stapeln nicht); „Neu laden" → genau 1× `window.location.reload()`, „Abbrechen" schließt ohne Reload; Datenverlust-Text („Ungespeicherte Änderungen …") laut KI-UX-Entscheidung 1; Klick-Naht `<span data-testid>` wie UpdatePrompt; Reload-Wrapper zusätzlich `tabIndex={-1}` + Enter/Space-Keydown (AK5: Fokus + Tastatur) und `initialFocusRef` darauf.
- `flushSync` im Event-Listener (Präzedenz App.tsx:200) — ohne ihn rendert React 19 die State-Änderung erst im Microtask-Flush und die roten (synchronen) Queries finden den Dialog nicht.
- `frontend/src/App.tsx:27,956` — `<SessionExpiredDialog />` neben InstallPrompt/UpdatePrompt gemountet.
- `frontend/src/Root.tsx`: bei erfolgreichem `checkAuth()` wird `SILENT_ATTEMPTED_KEY` entfernt (AK3, neben bestehendem `JUST_LOGGED_OUT_KEY`-Reset); Silent-Redirect sendet `?returnTo=` + `encodeURIComponent(pathname+search)` (AK4-Frontend-Hälfte).
- `server/src/logics/silentReturnPath.ts` (neu): `sanitizeReturnPath` — nur interne Pfade (führendes `/`, kein `//`, kein `\`) durchgereicht, sonst `null`.
- `server/src/express/routes/auth.ts`: Silent-Einstieg legt sanitisiertes `returnTo` als `session.silentReturnTo` ab; Erfolgs-Callback sichert den Wert VOR `session.regenerate()` und redirectet auf `silentReturnTo ?? '/'` (statt fix `/`); Failure-Pfade (`/?silent=unavailable`, `/?error=…`) unverändert.
- `server/src/types/session.d.ts`: `silentReturnTo?: string` deklariert.
- `frontend/src/app.css`: `.session-dialog-actions` — Buttons auf Mobile voll breit gestapelt (≥44px, Muster `.update-prompt` #1034), ab 768px kompakt rechts (KI-UX Mobile-First).
- `frontend/e2e/silent-login.spec.ts:84,109,138,166` — Route-Globs `'**/auth/google/silent'` → `'**/auth/google/silent*'`: der neue Query-Param bricht die Playwright-Glob-Matches (empirisch verifiziert, Playwright 1.62 matcht Globs gegen die volle URL inkl. Query). Mock-Plumbing, keine Assertions → im PR-Body als Test-Pflege dokumentiert.
- Tests: apiError/SessionExpiredDialog/Root (25 Vitest) grün, silentReturnPath (4 node:test) grün; e2e (#1231 + silent-login) und Gate-Ergebnis siehe PR-Body.

## Relevante Stellen
- `frontend/src/lib/apiError.ts:57` — `SESSION_EXPIRED_EVENT`-Konstante + Event-Dispatch an der `SESSION_TEXT`-Weiche.
- `frontend/src/components/SessionExpiredDialog.tsx` — neuer Dialog; `./Modal` (KolDialog) liefert Fokus-Falle/Escape/Backdrop = Abbrechen. Reload setzt `SESSION_RELOAD_KEY` (`pp_session_reload`), damit Root genau einen weiteren stillen Versuch zulässt (AK3).
- `frontend/src/lib/auth.ts` — neuer exportierter Marker `SESSION_RELOAD_KEY` (gemeinsame Naht Dialog ⇄ Root, bewusst NICHT in Root.tsx: Import-Zyklus Root→App→Dialog→Root).
- `frontend/src/App.tsx:956` — globaler Mount.
- `frontend/src/Root.tsx:63-69` (Flag-Reset bei erfolgreicher Auth), `:78-90` (SESSION_RELOAD_KEY-Bonus vor `shouldAttemptSilentLogin`), `:100-108` (returnTo-Redirect).
- `server/src/logics/silentReturnPath.ts` + `server/src/express/routes/auth.ts` (Silent-Einstieg/Erfolgs-Callback) — returnTo-Vertrag.
- `frontend/e2e/issue-1231-session-reload.spec.ts` — Spec-e2e jetzt grün; ZWEI dokumentierte Test-Pflege-Stellen (Helper-Flag `state.authed`→`state.value`, das die `authed.value=false`-Steuerung sonst tot stellte, und die Playwright-Globs in `silent-login.spec.ts`) — Details im PR-Body.

## Annahmen
- KI-UX-Entscheidungen wie im Spec umgesetzt: Datenverlust-Hinweis im Dialogtext; Modal-in-Modal = Session-Dialog als eigene Ebene OBEN auf einem ggf. offenen Fach-Dialog (native Top-Layer-Stacking), darunterliegender Dialog unangetastet.
- Enter auf dem fokussierten Reload-Wrapper braucht eigenen Keydown-Handler (`<span>` hat keinen nativen Enter-Klick) — bewusste Naht-Erweiterung, im PR-Body begründet.
- `sanitizeReturnPath` wird im Callback auf den (bereits sanitisierten) Session-Wert erneut angewendet — idempotent, deckt die Spec-Formulierung.

## Verworfen
- `tabIndex={0}` auf dem Reload-Wrapper — wäre ein zweiter Tab-Stop neben dem echten KoliBri-Button; `-1` hält die Naht nicht tastatur-tabbar, Fokus kommt programmatisch beim Öffnen.
- Return-Path über sessionStorage statt Query — Spec + rote e2e verlangen `?returnTo=` am Silent-Einstieg (serverseitige Durchreichung bis zum Callback).
- HTTP-Test für den Erfolgs-Callback (TF4-Urheberfassung) — bleibt wie im Spec dokumentiert als reine Logik eingeklagt.
- Entfernen von `silentReturnTo` im Failure-Pfad des Callbacks — bestehendes Verhalten lässt `silentPending` dort ebenfalls stehen; Stale-Werte betreffen nur einen späteren Erfolgs-Callback, keine Loop-Gefahr.

## Offen
- -

## Nächster Schritt
- Review-Phase (`ai:needs-review`-Workflow): Kreuzverhör des PR #1232; besonders die Test-Pflege an `silent-login.spec.ts` und die Enter-Nahtwürdigung.

## Fallstricke
- flushSync ist PFLICHT im Event-Listener — sonst sync-Queries der roten Tests leer (React-Batch-Flush).
- AK3 funktioniert NICHT über das bloße Zurücksetzen von `pp_silent_attempted`: die Spec-e2e setzt den Marker per `addInitScript` bei JEDER Navigation wieder → Flag ist beim Reload-Check immer '1'. Lösung: eigener Bonus-Marker `pp_session_reload` (Dialog setzt beim Bestätigen, Root konsumiert ihn vor `shouldAttemptSilentLogin` und löscht ihn — kein Loop-Risiko, `pp_silent_attempted` wird vor dem Silent-Redirect weiter gesetzt).
- Playwright-Globs matchen die volle URL inkl. Query: `'**/auth/google/silent'` matcht `?returnTo=` NICHT (empirisch geprüft, PW 1.62) — betroffene Route-Mocks brauchen `*`-Suffix.
- Playwright-`toBeFocused()` auf dem `data-testid`-Span erfordert `tabIndex` + `initialFocusRef` auf den WRAPPER, nicht auf den KoliBri-Host (Shadow-DOM-tiefer Fokus zählt für das Light-DOM-Span nicht).
- Session-Wert `silentReturnTo` VOR `req.session.regenerate()` lesen — danach ist die Session neu.
- JSDOM: `window.location.reload` nicht spypbar → rote Tests stubben per `vi.stubGlobal('location', …)` (#1095-Präzedenz).
- Die App ruft `/api/v1/auth/me` auf (generated client), Root redirectet aber auf `/auth/google/silent` OHNE `/api/v1`-Präfix — Bestandstand aus #396, durch e2e-Mocks abgedeckt, nicht Teil dieses Tickets.
