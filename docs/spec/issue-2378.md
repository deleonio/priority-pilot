# Spec #2378 — Android-Build der Web-App (SPA ohne Service Worker, feste Site-URL)

Bezug: [ADR 0021](../adr/0021-android-app-spa-ohne-service-worker.md). Rote Tests: `frontend/src/lib/siteOrigin.test.ts`.

## Ziel

Ein zweiter Vite-Build (`build:android`, Modus `android`) liefert die SPA für den Capacitor-Wrapper: Basis `/`, kein Service Worker, kein Manifest, eigener Ausgabeordner. Alle Server- und Link-Bezüge zeigen auf die feste Site-URL.

## Vorbedingung

- `SITE_URL` (z. B. `https://balamentum.example`) ist beim Android-Build gesetzt und wird als `VITE_SITE_URL` ins Bundle gereicht.

## Verhalten

| Fall                                | `getApiBase()`                                | `getPublicOrigin()`      |
| ----------------------------------- | --------------------------------------------- | ------------------------ |
| `VITE_SITE_URL` gesetzt             | `<SITE_URL>/api/v1`                           | `<SITE_URL>`             |
| `VITE_SITE_URL` leer (Website)      | `/api/v1`                                     | `window.location.origin` |
| Site-URL mit Leerraum/Slash am Ende | wird normalisiert (trim, Slashes am Ende weg) | wie links                |

- AK3: api-Fassade, Logout, `/auth/me`, Balance-Variante und beide Rechnungs-PDF-Links nutzen `getApiBase()`.
- AK4: Einladungs-, Empfehlungs-, Rechts- und MCP-Link nutzen `getPublicOrigin()`.
- AK1/AK2/AK5 (Build-Ausgabe, Abbruch ohne `SITE_URL`, Website-Build unverändert) sind Vite-Build-Verhalten ohne Test-Rahmen im Repo; Nachweis im Implementierungs-PR (Befehle im KI-ANALYSE-Block, Testfälle).
