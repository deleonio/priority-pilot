# Issue 1095 — Triage (Phase 1), Stand 2026-08-28T16:17:01Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein KI-ANALYSE-Block; einziger Kommentar = github-actions-Qualitätscheck, keine Entscheidungen). Analyse-Block + Routing-Tabelle in den Body angehängt, Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-spec` gesetzt (ux=nein → direkt Spec). Kein Ping-Kommentar, kein Titel-/Body-Copyedit, kein Split (eine Komponente + Tests = ein PR). Issue offen gelassen (Schritt 6: Anforderung klar nicht erfüllt — kein controllerchange-Fallback im Code).

## Erledigt
- Issue geladen (`gh issue view 1095`), Trigger als Initial-Triage bestimmt, kompletten Body analysiert.
- Code-Recherche: `frontend/src/components/UpdatePrompt.tsx` (komplett gelesen), `frontend/vite.config.ts:72-90` (VitePWA: registerType 'prompt', skipWaiting false, clientsClaim true, importScripts push-sw.js, navigateFallback+Denylist), `frontend/e2e/pwa-update-prompt.spec.ts:1-60` (Header: echter SW-Zyklus bewusst ungetestet), `frontend/src/components/UpdatePrompt.test.tsx:28-91` (Hook + KoliBri gemockt), `frontend/public/push-sw.js` (keine message/skipWaiting-Handler — sauber).
- Analyse-Block + Routing-Tabelle (ux nein/-/-, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high) via `.ai-memory/issue-1095-{body,block,new}.md` + `gh issue edit --body-file` in den Body geschrieben; Landing verifiziert (Tail zeigt ai-phase-routing:END, Labels korrekt).

## Relevante Stellen
- `frontend/src/components/UpdatePrompt.tsx:34` — Klick-Handler ruft nur `updateServiceWorker(true)`; kein eigener `controllerchange`-Listener, kein Fallback, kein Dismiss der needRefresh-Card → hier kommt die Härtung (AK1/AK2) rein.
- `frontend/src/components/UpdatePrompt.tsx:42` — Offline-Card mit `setOfflineReady(false)` als lokalem Schließen-Muster; darf von der Änderung unberührt bleiben (AK3).
- `frontend/src/App.tsx:744` — Mount-Stelle von UpdatePrompt (kein Eingriff nötig).
- `frontend/vite.config.ts:72-90` — PWA-Konfiguration; BLEIBT unverändert (registerType 'prompt' ist durch Tests AK1a–d gesichert).
- `frontend/src/components/UpdatePrompt.test.tsx:201-215` — Konfigurations-Guard-Tests (registerType/cleanupOutdatedCaches/clientsClaim/skipWaiting) — nicht rot machen dürfen.
- `frontend/vitest.config.ts:18` — Stub-Plugin für `virtual:pwa-register` (Mock-Kontrakt für neue Unit-Tests).
- `frontend/e2e/pwa-update-prompt.spec.ts` — Erweiterungsziel für AK4; Präzedenzfälle: #373/#1077-Blöcke injizieren Struktur statt echtem SW-Zyklus.

## Annahmen
- Ursachen-Hypothese (Abreißen der vite-plugin-pwa-internen controlling→reload-Kette in echter PWA/Android) wurde NICHT am Gerät verifiziert — ist im Analyse-Block als Hypothese gekennzeichnet; die Lösung (controllerchange-Fallback + Idempotenz-Guard) ist unabhängig vom exakten Abbruchpunkt robust. node_modules sind in der Runner-Sandbox nicht installiert → Client-Quelltext von vite-plugin-pwa 1.3.0 nicht direkt gelesen, Version aus `frontend/package.json:50`.
- Kein UX-Lauf: reines Verhalten, Dialog-UI unverändert (Begründung steht im Analyse-Block).
- `updateServiceWorker(true)`-Reload-Semantik folgt der bekannten vite-plugin-pwa-Prompt-Mechanik (messageSkipWaiting → controlling/isUpdate → location.reload).

## Verworfen
- Titeländerung („Pwa update hängt oder geht nicht") — unpräzise, aber nicht substantiell falsch; pro-forma-Edit verboten.
- Body-Copyedit — Issue gut strukturiert (Problem/Soll/Messgrößen), kein inhaltlicher Gewinn.
- Split — eine Komponente + Tests, ein PR.
- `registerType: 'autoUpdate'` als Lösung — andere Update-Strategie, von bestehenden Tests gesperrt und inhaltlich nicht gefordert (Issue will Bestätigung + dann Auto-Restart).
- Timeout-Fallback (Reload nach X ms erzwingen) als AK — Risiko Vorzeitig-Reload gegen alten Cache; der Spec-Phase überlassen, nicht als AK verankert.
- MEMORY.md-Eintrag — kein neuer Fehler/Experience-Kriterium erfüllt.

## Offen
- `.ai-memory/issue-1095-{body,block,new}.md` sind Wegwerf-Artefakte der Body-Zusammensetzung — NICHT committen; nur diese Datei hier ist die Phasen-Notiz (rm brauchte früher Freigabe, siehe 1083/1090-Präzedenz).

## Nächster Schritt
- Spec-Phase (Label `ai:needs-spec` gesetzt): rote Tests für AK1–AK3 in `UpdatePrompt.test.tsx` (Mock-Hook + jsdom `navigator.serviceWorker`-Events + `window.location.reload`-Spy; jsdom hat keinen echten SW — ggf. `navigator.serviceWorker` selbst stubben) und AK4-Entwurf in `pwa-update-prompt.spec.ts`.

## Fallstricke
- jsdom liefert kein `navigator.serviceWorker`-Objekt mit dispatchbarem EventTarget — in Tests vorher einen Stubb (`Object.defineProperty`/Spy) setzen, sonst fliegt AK1 rot aus dem falschen Grund.
- `window.location.reload` in jsdom nicht ohne Weiteres spypbar (`navigation not supported`-Error erst bei Aufruf) → `location.reload` mock-assignen oder `window.location`-Objekt ersetzen.
- Doppelt-Reload-Guard: Workbox-interner Pfad UND eigener Listener können beide feuern — AK2 verlangt exakt 1× `reload()`; Listener-Registrierung NUR nach Klick, sonst verletzt AK3 (Auto-Reload ohne Bestätigung).
- Vorhandene #353/#373/#1034/#1077-Tests in denselben Dateien nicht kaputtspielen (insbesondere Konfigurations-Guards 201-215).
- E2E: keine echte SW-Zyklus-Erwartung aufbauen — Datei-Header begründet selbst, warum das nicht deterministisch geht; AK4 über Injektion/`page.evaluate` simulieren.
