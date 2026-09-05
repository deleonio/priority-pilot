# Issue 1231 — Triage (Phase 1), Stand 2026-09-05T01:53:36Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar; einziger Kommentar = github-actions-Qualitätscheck 01:44Z, keine Entscheidung). Analyse-Block + Routing-Tabelle als Harness-Kommentar erstellt (issuecomment-5548559338), Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt (Endstand verifiziert). Kein Ping (CI-Regel), Titel passt („Session abgelaufen: Dialog zum Neuladen der App anbieten"), Body unangetastet (ADR 0009), kein Split (ein PR), kein Auto-Close (SessionExpiredDialog existiert nicht, ls-Beleg).

## Erledigt
- Issue geladen, Trigger = Initial-Triage bestimmt, Code-Recherche (apiError, Root, auth.ts, UpdatePrompt, Modal, silent-login.spec, helpers).
- Harness-Kommentar mit KI-ANALYSE (AK1–AK5, TF1–TF6) + Routing-Tabelle (ux ja/sonnet/medium, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high) per `gh issue comment --body-file` erstellt; Labels gesetzt.

## Relevante Stellen
- `frontend/src/lib/apiError.ts:29-32` — `SESSION_MESSAGES`-Set („Nicht eingeloggt.", „Ungültige Zugangsdaten.") + `SESSION_TEXT`; zentrale Stelle, wo Session-401 erkannt wird (#948) → hier Event auslösen (AK1/AK2); Achtung: 401 mit ANDERER Message = LLM-Pfad, kein Dialog.
- `frontend/src/App.tsx:954-955` — Mount neben `<InstallPrompt />`/`<UpdatePrompt />` → hier `<SessionExpiredDialog />` hin.
- `frontend/src/components/UpdatePrompt.tsx` — Muster: global montierte Bestätigungs-Card + nativer Klick-Wrapper (KolButton-_on in JSDOM nicht klickbar).
- `frontend/src/components/Modal.tsx` — KolDialog-Wrapper (Fokus-Falle, Escape, Backdrop, `fallbackFocusRef`, `initialFocusRef` aus #472).
- `frontend/src/Root.tsx:12,22-29,74` — `pp_silent_attempted` wird VOR Silent-Redirect gesetzt und nie entfernt; `shouldAttemptSilentLogin`-Guards (`silent=unavailable`, `?error`, `pp_just_logged_out`).
- `server/src/express/routes/auth.ts:160-222` — `/auth/google/silent` (prompt=none) + Callback: Erfolgs-Fall `res.redirect('/')` FIX → AK4 braucht Return-Path-Durchreichung; Fehlerfälle `/?silent=unavailable` bzw. `/?error=…`.
- `server/src/express/requireAuth.ts:52` — Quell-401 „Nicht eingeloggt.".
- `frontend/e2e/silent-login.spec.ts:54-96` — E2E-Muster `page.route('**/auth/me', …)` 401 + Silent-Count; Vorlage für issue-1231-spec.
- `frontend/src/components/PillarFormDialog.tsx:76-89` — Beispiel-Fehlerfluss („Anlegen fehlgeschlagen" + KolAlert), der unberührt bleiben muss (AK1 „Meldung bleibt sichtbar").

## Annahmen
- SSO = bestehender stiller Google-Login (Issue-Wortlaut „SSO neu getriggert" passt zu `/auth/google/silent`); kein neuer Auth-Mechanismus nötig.
- Dialog nur innerhalb authentifizierter App relevant (LoginPage ersetzt App → „Ungültige Zugangsdaten."-401 öffnet ihn ohnehin nicht, solange er in `App` gemountet ist).
- Return-Path als additiver Query-Param am Silent-Einstieg hält den openapi-Vertrag stabil (keine DTO-Änderung).

## Verworfen
- Split — Frontend-Dialog + Server-Return-Path gehören zu einem Feature, ein PR (Präzedenz #1083).
- Titel-/Body-Copyedit — Issue präzise (Problem/Soll/Messgrößen), kein substantieller Fehler.
- needs-human — keine echte Produktfrage; Route-Erhalt und Flag-Reset sind technische Entscheidungen mit klarem Muster.
- MEMORY.md-Eintrag — kein neuer Fehler, Aufnahmekriterium nicht erfüllt.

## Offen
- -

## Nächster Schritt
- UX-Phase (Label `ai:needs-ux-ui` gesetzt): Dialog-Interaktion (KolDialog vs. Card, Tonlage, Mobile) beraten; danach Spec gemäß Routing-Tabelle.

## Fallstricke
- Nur Session-Messages-401 (oder unlesbarer Body + 401) darf den Dialog öffnen — LLM-/Proxy-401 „Invalid API key" läuft durch dieselbe `toApiError`-Stelle (#620/#948-Weiche).
- `pp_silent_attempted` darf nur so zurückgesetzt werden, dass die Loop-Guards (`silent=unavailable`, `pp_just_logged_out`) wirksam bleiben — sonst Login-Redirect-Schleife (#396 PR B).
- jsdom: `window.location.reload` nicht direkt spypbar — mock-assignen (Memory 2026-08-25/#1095-Präzedenz).
- KoliBri-Buttons in JSDOM: Klick-Handler auf nativen Wrapper legen (UpdatePrompt-Kommentar oben).
- Silent-E2E: `/auth/google/silent` und `/auth/me` per `page.route` mocken — echter OAuth-Zyklus nicht deterministisch testbar.
- E2E-Viewport 375px: Bounding-Box-Assertions, nicht scrollWidth (Memory 2026-08-24).
