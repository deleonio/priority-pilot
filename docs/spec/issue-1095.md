# Spec: PWA-Update hängt — garantierter Reload nach Update-Bestätigung (#1095)

## Ziel

Ein Klick auf „Jetzt neu laden" im PWA-Update-Prompt führt **garantiert** zu genau einem
Page-Reload, sobald der neue Service Worker die Kontrolle übernimmt — unabhängig davon, ob
die interne `controlling`-Kette von vite-plugin-pwa durchläuft. Ohne Nutzerbestätigung
geschieht nichts (Bestätigungscharakter bleibt).

## Vorbedingungen

- `registerType: 'prompt'`, `skipWaiting: false`, `clientsClaim: true` bleiben unverändert
  (`frontend/vite.config.ts`, gesichert durch AK1a–AK1d in `UpdatePrompt.test.tsx`).
- Dialog-UI (KoliBri-Card, Texte, `.update-prompt`-CSS) bleibt unangetastet.
- `UpdatePrompt.tsx:34` delegiert heute nur an `updateServiceWorker(true)`; genau diese Naht
  wird um einen eigenen Fallback-Listener gehärtet.
- jsdom liefert kein `navigator.serviceWorker` — Unit-Tests stubben es als `EventTarget`
  und ersetzen `location` per `vi.stubGlobal` (jsdoms `location.reload` ist nicht spypbar).

## Verhalten (AK1–AK4)

| AK  | Trigger                                                       | Erwartung                                                                                                                                  |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| AK1 | Klick auf `pwa-update-reload`                                 | `updateServiceWorker(true)` (bereits #353 getestet) **und** Registrierung eines `controllerchange`-Listeners auf `navigator.serviceWorker` |
| AK1 | `controllerchange` nach Bestätigung                           | `window.location.reload()` wird ausgelöst                                                                                                  |
| AK2 | `controllerchange` mehrfach (Workbox-Pfad + eigener Fallback) | genau **ein** `location.reload()` (Idempotenz-Guard)                                                                                       |
| AK3 | `needRefresh=true` ohne Klick                                 | kein Listener, kein Reload — auch wenn `controllerchange` feuert; Update-Card bleibt offen; Offline-Card unberührt                         |
| AK4 | E2E, 375px                                                    | nach Bestätigung + Controller-Wechsel ist genau ein Reload nachweisbar; danach ist der Update-Prompt nicht sichtbar                        |

## Schritte

1. Unit (`frontend/src/components/UpdatePrompt.test.tsx`): `navigator.serviceWorker` als
   `EventTarget`-Stubb definieren, `location` per `vi.stubGlobal` durch `{ reload }` ersetzen.
2. Klick auf `pwa-update-reload` auslösen, danach `controllerchange` auf dem Stubb dispatchen.
3. E2E (`frontend/e2e/pwa-update-prompt.spec.ts`): reale Prompt-Struktur als Stellvertreter
   injizieren (Präzedenz #1034/#1077), Fallback-Muster verdrahten, `controllerchange` per
   `page.evaluate` feuern, Reload über `sessionStorage`-Zähler nachweisen.

## Erwartetes Ergebnis

- Bestätigung → genau ein Reload, neue Version wird geladen, Prompt verschwindet.
- Kein Bestätigung → kein Reload, Dialog bleibt offen.

## Testmapping

- AK1 → `UpdatePrompt.test.tsx` — Listener-Registrierung + Reload bei `controllerchange`.
- AK2 → `UpdatePrompt.test.tsx` — Idempotenz-Guard (mehrfach dispatcht → 1× reload).
- AK3 → `UpdatePrompt.test.tsx` — ohne Klick kein Listener/Reload (Regressionsschutz, initial grün).
  Dedup: `updateServiceWorker(true)`-Assertion existiert bereits (#353 AK3, #373 AK3a) — kein zweiter Test.
- AK4 → `pwa-update-prompt.spec.ts` — Browser-Mechanismus (dispatch → reload → prompt-freie App);
  die Komponentenlogik selbst tragen die Unit-Tests.
