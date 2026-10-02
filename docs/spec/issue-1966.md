# Issue 1966 — Sprachangebot auf Deutsch und Englisch beschränken

## Ziel

Die App bietet in der Sprachauswahl nur noch die vollständig übersetzten Sprachen **Deutsch** und
**Englisch** an. Die übrigen 8 Locale-Ordner bleiben auf der Platte (der Schlüssel-Gleichstand-Test
von #1339 deckt sie weiter ab), verschwinden aber aus dem Bundle und aus der Auswahl.

## Verhalten

| #   | Verhalten                                                                                                                                         | Test                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| AK1 | `SUPPORTED_LANGUAGES` aus `frontend/src/i18n/config.ts` ist genau `['de', 'en']`                                                                  | `config.test.ts`                                                                                                |
| AK2 | Der i18next-Init erhält nur Ressourcen für `de` und `en` (keine 8 weiteren Sprachen im Bundle)                                                    | `config.test.ts`                                                                                                |
| AK3 | Die Sprachauswahl (LanguageSetting) bietet genau die Werte `de` und `en` an                                                                       | bereits durch `LanguageSetting.test.tsx` (Optionen == `SUPPORTED_LANGUAGES`) abgedeckt — Dedup, kein neuer Test |
| AK4 | Ein Sprachcode außerhalb der Allowlist (z. B. `fr` im localStorage/`changeLanguage`) landet auf `de` (Fallback via `supportedLngs`/`fallbackLng`) | `config.test.ts`                                                                                                |
| AK5 | Locale-Dateien der übrigen 8 Sprachen bleiben vorhanden; Schlüssel-Gleichstand über alle Dateien läuft weiter grün                                | bereits durch `locales.test.ts` abgedeckt — Dedup, kein neuer Test                                              |

## Mechanik

`SUPPORTED_LANGUAGES` bleibt aus `Object.keys(resources).sort()` abgeleitet; der Glob in
`config.ts` ist auf die Allowlist `['de', 'en']` beschränkt, sodass nur diese Sprachen in
`resources` und im Bundle landen — eine fertige Sprache kehrt durch Aufnahme in Allowlist und
Glob-Muster zurück.
`supportedLngs` + `fallbackLng: 'de'` fangen alte localStorage-Werte und Navigator-Sprachen
automatisch ab. Die Website (`website/src/i18n/`, 10 Sprachen) ist nicht Teil dieses Vertrags.

## Ebene

Nur Unit (Vitest) — reine Konfigurationslogik, kein neues UI-Verhalten, kein eigener E2E.
