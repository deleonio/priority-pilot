# PWA-Update: garantierter Reload nach Update-Bestätigung

**Stand:** 2026-08-30

## Ziel

Ein Klick auf „Jetzt neu laden" im PWA-Update-Prompt führt **garantiert** zu genau einem Page-Reload, sobald der neue Service Worker die Kontrolle übernimmt — unabhängig davon, ob die interne `controlling`-Kette des Update-Plugins durchläuft. Ohne Nutzerbestätigung geschieht nichts (Bestätigungscharakter bleibt).

## Verhalten

| Trigger                                                      | Erwartung                                                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Klick auf „Jetzt neu laden" (`pwa-update-reload`)            | `updateServiceWorker(true)` **und** Registrierung eines `controllerchange`-Listeners auf `navigator.serviceWorker` |
| `controllerchange` nach Bestätigung                          | `window.location.reload()` wird ausgelöst                                                                          |
| `controllerchange` mehrfach (Plugin-Pfad + eigener Fallback) | genau **ein** `location.reload()` (Idempotenz-Guard)                                                               |
| Update verfügbar, ohne Klick                                 | kein Listener, kein Reload — auch wenn `controllerchange` feuert; Update-Card bleibt offen; Offline-Card unberührt |

## Erwartetes Ergebnis

- Bestätigung → genau ein Reload, neue Version wird geladen, Prompt verschwindet.
- Kein Bestätigung → kein Reload, Dialog bleibt offen.
