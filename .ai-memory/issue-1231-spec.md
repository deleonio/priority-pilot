# Issue 1231 — Spec (Phase 3), Stand 2026-09-05

**Ziel: VERDICT ready.** Rote Tests + `docs/spec/issue-1231.md` + Phase-Notiz auf `ai/harness/1231`, Draft-PR erstellt. Kein Produktivcode, keine Labels.

## Erledigt
- SKILL.md + MEMORY.md gelesen; Harness-Kommentar (AK1–AK5, TF1–TF6, KI-UX-Block) über `.ai-memory/issue-1231-harness.md` geladen.
- Branch `ai/harness/1231` (existierte mit Memory-Commits b823a67d/6a9bb073) ausgecheckt — lokale identische Phasen-Notizen mussten vorher weg (Checkout-Blocker).
- Spec `docs/spec/issue-1231.md` geschrieben: Ereignis-Vertrag (`pp:session-expired`, gefeuert genau für SESSION_TEXT-mappende 401s), Dialog-Vertrag (testids `session-reload`/`session-cancel`, Dedup bei offenem Dialog, Datenverlust-Text), Root-Reset `pp_silent_attempted` bei erfolgreicher Auth, `?returnTo=` am Silent-Redirect, Server-Vertrag `sanitizeReturnPath`.
- Rote Tests:
  - `frontend/src/lib/apiError.test.ts` — neuer describe-Block: Event feuert 1× bei Session-401 (lesbar + unlesbarer Body), nicht bei LLM-401/403/500/Netzwerk (AK1/AK2, TF1).
  - `frontend/src/components/SessionExpiredDialog.test.tsx` — NEU: hidden ohne Event, öffnet 1 Dialog mit „ungespeicherte"-Text, Dedup bei 3 Events, reload genau 1x, Abbrechen ohne Reload + Re-Open (AK1/AK2, TF1/TF2). Mocks: `./Modal` (div role=dialog) + KolButton (native Klick-Naht), reload via `vi.stubGlobal('location', {reload})` (#1095-Präzedenz).
  - `frontend/src/Root.test.tsx` — neuer Test AC-1231-1: bei erfolgreicher `/api/v1/auth/me`-Antwort wird `pp_silent_attempted` entfernt (AK3, TF3); afterEach räumt sessionStorage.
  - `server/src/logics/silentReturnPath.test.ts` — NEU: `sanitizeReturnPath` (null bei undefined/Non-String/ohne-Slash/https://…///\/\…, unverändert bei internen Pfaden inkl. Query) (AK4, TF4).
  - `frontend/e2e/issue-1231-session-reload.spec.ts` — NEU (TF5/TF6): Deep-Route `/aufgaben`, parse-text → 401 „Nicht eingeloggt." (issue-620-Muster), Fehlermeldung + Dialog, Reload-Klick, zustandsvoller /auth/me-Zyklus + Silent-Mock mit returnTo-Capture → Landung `/aufgaben`; AK5: 375px Bounding-Box + Fokus/Enter.

## Relevante Stellen
- `frontend/src/lib/apiError.ts:29-32,55-70` — SESSION_MESSAGES/SESSION_TEXT; hier feuert künftig das Event.
- `frontend/src/App.tsx:954-955` — Mount neben InstallPrompt/UpdatePrompt.
- `frontend/src/Root.tsx:24-31,54-76` — `shouldAttemptSilentLogin`-Guards + Silent-Redirect (returnTo an `window.location.href`).
- `server/src/express/routes/auth.ts:160-222` — `/auth/google/silent` (returnTo in Session ablegen) + Callback-Erfolgs-Redirect (fix `/` → sanitizeReturnPath ?? `/`).
- `frontend/e2e/fixtures.ts:32` — Fixture mockt /auth/me 200; spec-eigener Handler gewinnt (umgekehrte Registrierung).

## Annahmen
- KI-UX-Entscheidungen umgesetzt: (1) Datenverlust-Hinweis im Dialogtext (Test-matcht /ungespeicherte/i), (2) Modal-in-Modal = eigene Ebene obendrauf, darunterliegender Dialog unangetastet (kein eigener Test — visuell/impl).
- Event-Name `pp:session-expired` als Vertrag im Spec fixiert; Tests nutzen das Literal (kein Import der noch fehlenden Konstante, damit die bestehenden #948-Tests im selben File nicht mitsterben).
- `sanitizeReturnPath(raw) → string|null` (null ⇒ Redirect `/`) ist die von der Impl zu schaffende Naht `server/src/logics/silentReturnPath.ts` (#1101-Präzedenz: neuer Logik-Modul-Vertrag); HTTP-Erfolgs-Callback nicht testbar (echter Google-Token-Austausch) — im Spec + PR-Body dokumentiert.
- E2E: QuickCapture-Flow („Neuen Task anlegen" → „Beschreibe …" → „Verarbeiten und weiter") als fehlschlagende Aktion; nach Reload wird parse-text nicht erneut aufgerufen (Dialog erscheint nicht doppelt).

## Verworfen
- TF4 als HTTP-Test in `auth.test.ts` (wie im Analyse-TF vorgeschlagen) — Erfolgs-Callback ohne echten Google-Token-Austausch unerreichbar; stattdessen reine Logik-Tests (Begründung im PR-Body).
- Unit-Test für returnTo-Anhängung am Silent-Redirect — `window.location.href` in jsdom nicht observierbar (Unforgeable); e2e deckt es (returnTo-Capture).
- Guard-Nicht-Regressionstests (?silent=unavailable etc.) — dedup: `silent-login.spec.ts` AK4 + `Root.test.tsx` #1136 decken sie bereits.

## Offen
- Wegwerf-Artefakt `.ai-memory/issue-1231-harness.md` NICHT committen.

## Nächster Schritt
- Impl-Phase: Produktivcode nach `docs/spec/issue-1231.md` (Event + Dialog + Root-Reset + returnTo + sanitizeReturnPath-Modul), Tests grün fahren.

## Fallstricke
- Session-Dialog in JSDOM nur mit `./Modal`-Mock testbar (customElements/KolDialog hydrieren nicht).
- `window.location.reload` nicht spypbar → `vi.stubGlobal('location', …)` (#1095); jsdom-`location.href`-Zuweisung navigiert nicht (nur Console-Warnung).
- E2E: `/auth/me`-Zustandsmock NACH Fixture-Setup registrieren (letzter Handler gewinnt); `authed.value=false` erst unmittelbar vor Reload-Klick setzen.
- Open-Redirect: `/\host` normalisiert der URL-Parser zu `//host` — Backslash-Fall ist ein echter Testfall.
- Kein `--no-verify` nötig, außer knip meckert über die fehlenden Module (`silentReturnPath`, `SessionExpiredDialog`) — dann Präzedenz MEMORY 2026-08-30.
