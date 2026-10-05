# Spec #1979 — Balance-Check: Fragebogen ohne Konto

Ziel: Statische deutsche Seite `/balance-check/` (Slug hier festgelegt). Fünf Fragen (je Standard-Säule aus `SEED_PILLARS`, Skala 0-4), Auswertung im Browser, teilbar per URL. Nur Deutsch, kein Speichern, keine Aufrufe an `/api/`/`/auth/`.

## Datenvertrag (`website/src/assessment.ts`)

- `evaluateAssessment(answers: readonly number[]): { shares: number[]; focus: number | null }` — `shares` in `SEED_PILLARS`-Reihenfolge, ganze Prozent, Summe 100 (Largest-Remainder-Rundung); `focus` = Index des höchsten Werts (bei Gleichstand der erste). Alle Antworten 0: `shares` = `[0,0,0,0,0]`, `focus` = `null` (keine Division durch null).
- `encodeAnswers(answers): string` — fünf Ziffern, z. B. `[4,0,1,2,3]` → `"40123"`.
- `decodeAnswers(raw: string | null): number[] | null` — nur genau fünf Ziffern 0-4, sonst `null`.

## Rendering (`website/src/render.ts`)

- `renderAssessment({ locale: 'de', messages, siteUrl, allMessages })`: genau eine `h1`; 25 Radios (`type="radio"`), je Frage ein Name `q0`..`q4` mit den Werten 0-4; die fünf `SEED_PILLARS`-Namen stehen im Text; Link `href="/app/"`; kein `SIGNED_IN_REDIRECT`.
- Deutsche Startseite verlinkt `/balance-check/`; keine Sprachvariante unter `/<sprache>/`.

## Build

- `dist/balance-check/index.html`, Pfad in `sitemap.xml`, kein Pfad `/<sprache>/balance-check/`.

## Verhalten im Browser

- Ergebnisbereich `[data-result]` ist bis zur fünften Antwort nicht sichtbar, danach sichtbar (ohne Absenden-Knopf). Die URL trägt `?a=<fünf Ziffern>`; frisch geöffnet erscheint dasselbe Ergebnis. Ungültiges `a` → leerer Fragebogen ohne Ergebnis.
- Teilen-Knopf `[data-share]` (`navigator.share`, Fallback Link kopieren).
- Kein Cookie, kein `localStorage`/`sessionStorage`, keine Requests auf `/api/`/`/auth/`.
- 375 px: kein horizontaler Überlauf (Bounding-Box), Touch-Ziele der Antwort-Labels >= 44 px.

## Abdeckung

AK2/AK3/AK4 (Parsing): `website/src/assessment.test.ts`; AK2/AK5/AK6: `website/src/render.test.ts`-artig in `assessment.test.ts`; AK1/AK2/AK4/AK5/AK7: `website/e2e/assessment.spec.ts`.
