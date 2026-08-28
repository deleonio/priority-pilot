# Issue 1095 — Spec (Phase 2), Stand 2026-08-28T16:26Z

## Erledigt
- Spec geschrieben: `docs/spec/issue-1095.md` (AK1–AK4 + Testmapping + jsdom-Stubb-Notiz).
- Rote Unit-Tests in `frontend/src/components/UpdatePrompt.test.tsx`, neuer describe-Block „UpdatePrompt — Reload-Fallback bei Controller-Wechsel (#1095)" (VOR dem #1034-Block eingefügt): AK1 Listener-Registrierung (Zeile ~247), AK1 reload bei controllerchange (~263), AK2 Idempotenz 3× dispatch → 1× reload (~279), AK3 ohne Klick kein Listener/Reload (~289, initial grün gewollt). Lauf: **3 rot (AK1 ×2, AK2) / 18 grün** — genau die neuen Verhaltenstests, keine Alt-Tests beschädigt.
- E2E AK4 in `frontend/e2e/pwa-update-prompt.spec.ts` angehängt (describe „PWA Update-Reload-Fallback (#1095)"): reale Prompt-Struktur injiziert, Klick → eigener `controllerchange`-Listener, 3× Dispatch auf echtem `navigator.serviceWorker`, Reload-Nachweis über `sessionStorage`-Zähler `pwa-reloads`, danach Dashboard sichtbar + `.update-prompt` count 0; 375×667.
- `tsc --noEmit` (frontend) grün; vitest-Lauf grün außer den 3 roten.

## Relevante Stellen
- `frontend/src/components/UpdatePrompt.tsx:34` — einzige Änderungsstelle für Impl: Klick-Handler um Listener-Registrierung + Idempotenz-Guard erweitern.
- `frontend/src/components/UpdatePrompt.test.tsx` — neue Suite; nutzt `navigator.serviceWorker`-EventTarget-Stubb (beforeEach) + `vi.stubGlobal('location', { reload })` + `vi.unstubAllGlobals()` (afterEach).
- `frontend/e2e/pwa-update-prompt.spec.ts` — AK4-Block, Muster wie #1034/#1077 (Injektion statt echtem SW-Zyklus).
- `frontend/vite.config.ts` — BLEIBT unverändert (AK1a–d-Guard-Tests sichern registerType 'prompt').

## Annahmen
- Impl löst den Reload über `window.location.reload()` aus (so im Spec/Tabelle genagelt) — Unit-Test spy daran.
- Listener wird erst bei Klick registriert (AK3 erzwingt das); Workbox-interner Reload-Pfad wird vom Guard nicht erfasst, aber AK2 fordert nur genau 1 Reload aus der Komponente.
- E2E ist ein Mechanismus-Test (Browser-Kette dispatch → reload → prompt-freie App), die Komponentenlogik tragen AK1–AK3; initial grün (Proxy-Muster), im PR-Body begründet.

## Verworfen
- Spy auf `window.location.reload` via `vi.spyOn`/`Object.defineProperty` — jsdom: `reload` ist own, non-configurable, non-writable („Cannot redefine property"), auch auf `Location.prototype` nicht greifend → `vi.stubGlobal('location', {reload})` (verifiziert: ersetzt `window.location`, Spy greift).
- Neuer Test für `updateServiceWorker(true)` bei Klick — bereits durch #353 AK3 + #373 AK3a gedeckt (Dedup, steht im Spec-Testmapping).
- Timeout-Fallback (Reload nach X ms) als Test — im Triage verworfen (Risiko Vorzeitig-Reload), nicht AK.
- Änderung an `vitest.config.ts` (globales location-Stubbing) — Config gehört nicht in den Spec-PR; Stubb lokal in der Suite reicht.

## Offen
- E2E-Lauf (`npx playwright test e2e/pwa-update-prompt.spec.ts`) im Hintergrund gestartet — Ergebnis nachtragen; wenn rot: vermutlich Web-Component-`kol-button` ohne Shadow-Klickpfad auf den injizierten `span` (Klick geht direkt auf `[data-testid]`, sollte ok sein) oder Server-Boot.
- Wegwerf-Artefakte aus Triage (`.ai-memory/issue-1095-{body,block,new}.md`) untracked, NICHT committen.

## Nächster Schritt
- E2E-Ergebnis in den PR-Body nachtragen; danach Impl-Phase: `UpdatePrompt.tsx:34` — bei Klick `navigator.serviceWorker.addEventListener('controllerchange', guard)` mit Reload-Flag, Guard verhindert Doppel-Reload, `window.location.reload()`.

## Fallstricke
- jsdom hat KEIN `navigator.serviceWorker` → Stubb mit `Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:new EventTarget()})`, afterEach `Reflect.deleteProperty` (sonst leakt der Stubb in andere Tests der Datei).
- `location.reload` ist in jsdom unspypbar (non-configurable) — nur `vi.stubGlobal('location', {reload})` funktioniert; danach zwingend `vi.unstubAllGlobals()`.
- Reload-Spy in den Tests heißt `reloadMock` und wird in `beforeEach` neu erzeugt — Assertions dürfen nicht auf alte Mock-Instanzen gehen.
- E2E: `sessionStorage` ist der einzige Reload-Beweis, der den Neustart überlebt (JS-Closure-Zustand stirbt beim Reload).
