# Spec #1892 — Datenschutzerklärung vollständig

Ziel: `/datenschutz/` (nur Deutsch, alle Sprachfassungen verlinken darauf) beschreibt belegbar, was verarbeitet wird.

## Verarbeitungen (AK1)

Je ein h2-Abschnitt: Google-Login, Standort und gespeicherte Orte, Push, KI-Anbieter, PayPal, Google Play, Rechnungen, Feedback, MCP-Zugriff (Access-Tokens), Android-App. Jeder nennt **Zweck, Rechtsgrundlage, Speicherdauer, Empfänger** (Werte aus dem Code, keine Zusage ohne Beleg).

## Verantwortlicher und Rechte (AK2)

Name und Kontakt-E-Mail kommen aus `frontend/src/lib/operator.ts` (importiert). Genannt werden Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch, Beschwerde und die zuständige Aufsichtsbehörde.

## Verschlüsselung (AK3)

Keine Ende-zu-Ende-Aussage. Stattdessen HTTPS-Transportverschlüsselung und gehashte Speicherung der Access-Tokens.

## Erreichbarkeit (AK4)

Unverändert: Footer-Link in allen zehn Sprachen und Sitemap (`render.test.ts`, #1672).

Test-Pflege: die #1672-Assertion `/ende-zu-ende|e2e/` widerspricht AK3 und ist entfernt.
