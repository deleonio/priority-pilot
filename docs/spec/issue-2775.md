# Helfer-Duplikate konsolidieren: `legalLanguage`-Auflösung und `formatDate`

**Stand:** 2026-10-20

Zwei Frontend-Helfer sind je Verbraucher dupliziert: der Sprach-Auflösungsausdruck für die
Rechtsseiten (in `Impress.tsx` und `ConsentStep.tsx`) und eine lokale `formatDate`-Kopie in
`TaskImportCard.tsx`. Ziel: genau eine Definitionsstelle je Helfer — **bei unveränderten
sichtbaren Ausgaben** (Import-Vorschau weiter kurzes Zahlenformat „2.11.2026“, Journal weiter
Langformat).

## Sprach-Helfer (`lib/operator.ts`)

- `lib/operator.ts` exportiert zusätzlich `currentLegalLanguage()` (keine Argumente): liest die
  Sprache aus der globalen i18next-Instanz (`import i18next from '../i18n/config'`, Muster
  `journalDate.ts`) als `i18next.resolvedLanguage ?? i18next.language` und liefert darüber das
  Ergebnis der bestehenden Funktion `legalLanguage` (`'en'` oder `'de'`).
  - `resolvedLanguage = 'en'` → `'en'`; `resolvedLanguage = 'fr'` → `'de'` (nicht unterstützte
    Sprachen fallen auf die deutsche Rechtssprache).
  - `resolvedLanguage = undefined` → Fallback auf `i18next.language`.
- `Impress.tsx` und `ConsentStep.tsx` nutzen `currentLegalLanguage()`; der Ausdruck
  `legalLanguage(i18n.resolvedLanguage ?? i18n.language)` steht in keiner Komponente mehr.
- Die Basisfunktion `legalLanguage(language)` bleibt exportiert und unverändert (`website/`
  teilt sich `OPERATOR`).

## Datumsformat (`lib/journalDate.ts`)

- `formatDate` wird die einzige Definitionsstelle für kurzes und langes Datum:
  `formatDate(date, options?)` mit `options.format: 'long' | 'short'` und `'long'` als Default
  (bestehende Aufrufe ohne Optionen verhalten sich unverändert).
- Eingabe: beide Formen sind gültig — reiner Kalendertag `YYYY-MM-DD` (Journal) **und** volle
  ISO-Instants wie `2026-11-02T00:00:00.000Z` (Import-Vorschau, UTC-Mitternacht aus
  `POST /task-import/preview`). Vor dem Formatieren wird auf den Kalendertag normalisiert.
- Zeitzonen-Semantik (AK4, gewählt): UTC-Mitternacht-Parsen + Formatierung mit
  `timeZone: 'UTC'` — der Kalendertag bleibt stabil, unabhängig von der Zeitzone des Nutzers
  bzw. des Runners. Begründung: die naive Variante (`toLocaleDateString` ohne `timeZone`)
  verschiebt den Tag für Zeitzonen westlich von UTC; mit UTC sehen Nutzer mit positivem Offset
  (u. a. DE, UTC+1) und CI (UTC) dieselbe Ausgabe wie zuvor.
- Kurzes Format (`format: 'short'`): nur Zahlen, ohne führende Nullen — in de
  `2.11.2026` (wie `toLocaleDateString(language)` ohne Optionen).
- `TaskImportCard.tsx` hat kein lokales `formatDate` mehr; die Vorschau-Beispiele formatieren
  über `journalDate.formatDate(deadline, { format: 'short' })`.
- `JournalTab`/`JournalStats` bleiben unangetastet (Langformat über den Default).

## Sichbare Ausgaben (unverändert)

- Import-Vorschau, Deadline `2026-11-02T00:00:00.000Z`, de → „2.11.2026“.
- Journal/JournalStats, de → „2. November 2026“ (Langformat).

## Testabdeckung

| AK      | Test                                                                        | Anlaufzustand                               |
| ------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| AK1     | `operator.test.ts` — Auflösungs-Helfer (en/fr/undefined-Fallback)           | rot (fehlender Export)                      |
| AK2/AK3 | `journalDate.test.ts` — Langformat unverändert, Instant-Eingabe, Kurzformat | rot (Instant + Option fehlen)               |
| AK3     | `TaskImportCard.test.tsx` — Spiegel: Vorschau zeigt „· 2.11.2026“           | grün (Regressionsschutz der Konsolidierung) |
| AK4     | PR-Body-Dokumentation — nicht als Unit-Test ausdrückbar                     | Dokumentationspflicht des Umsetzungs-PR     |
| AK5     | Bestandssuiten bleiben grün                                                 | Nachweis über Scoped-Läufe im Umsetzungs-PR |
