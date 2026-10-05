# Spec #2229 — Einladungs-Banner zum Start (Server-Schalter)

Vertrag für `GET /auth/me` und die Komponente `LaunchBanner`. Texte/Locales siehe AK5 (deckt
`frontend/src/i18n/locales.test.ts` ab); `website/` bleibt unberührt (AK6).

## Server (AK1)

- Voraussetzung: eingeloggter Nutzer.
- Schritt: `GET /auth/me`.
- Erwartung: Feld `launchBanner` ist `true`, wenn die Umgebungsvariable `LAUNCH_BANNER_ENABLED` den Wert `true` hat,
  sonst `false` (auch ohne gesetzte Variable). Die Variable wird je Anfrage gelesen (Neustart genügt, kein Code-Release).

## Komponente `LaunchBanner` (AK2, AK4)

Props: `enabled: boolean` (aus `/auth/me`), `onFeedback: () => void` (SPA-Navigation nach `/hilfe/feedback`).

- `enabled=false` → nichts im DOM.
- `enabled=true`, Schlüssel `launch-banner-dismissed` nicht in `localStorage` → Banner (`data-testid="launch-banner"`)
  mit Knöpfen `launch-banner-feedback` und `launch-banner-dismiss`.
- Schlüssel wird synchron beim ersten Render gelesen (kein Aufblitzen).
- „Schließen" setzt den Schlüssel und entfernt den Banner; ein Re-Mount zeigt ihn nicht mehr.
- „Feedback geben" ruft `onFeedback` auf (kein Voll-Reload).

## Ende-zu-Ende (AK3, AK4, AK7)

- Mit `launchBanner: true` in `/auth/me`: Banner sichtbar; Klick auf Feedback → `/app/hilfe/feedback`.
- Schließen + Reload → Banner bleibt weg.
- 375 px: Banner überlappt nicht mit der Kopfzeile, beide Knöpfe mindestens 44 px hoch.
