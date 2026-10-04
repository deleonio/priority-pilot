# Spec #1995 — Monatlicher Balance-Rückblick

## Ziel

Am Monatsanfang sieht die Nutzerin im Dashboard eine Rückblick-Card über den Vormonat: Säulenverteilung, Streak zum Monatsende, im Monat neu erreichte Meilensteine — als PNG teilbar und per Push angekündigt. Struktur und Bedienung folgen exakt der Wochen-Balance-Karte (#1968); Karte und Push enthalten keine Aufgabeninhalte.

## Voraussetzungen

- Eingeloggter Nutzer mit fünf Standard-Säulen; Erledigungen erzeugen `ScoreEntry`-Zeitpunkte; erreichte Meilensteine liegen sticky in `MilestoneReached` (`userId`, `schluessel`, `zeitpunkt`, Modell #1965).
- Vorhandene Bausteine: `berechneBalanceVerlauf` (kumulativer Verlauf, `logics/balanceHistory.ts`), `berechneStreak`/`tagIn` (`logics/streak.ts`), `sendPushToUser` + NotificationLog-Dedup (`logics/push.ts`, Muster `streakReminder.ts`/`carePush.ts`), `WeeklyBalanceCard.tsx`/`weeklyShareCard.ts` (#1968).

## Vertrag AK1 — `GET /scores/monthly-recap` (neu in `server/src/express/routes/scores.ts`)

Entscheidung der Spec: ein **neuer Endpunkt** statt Zusammenführung bestehender — der Rückblick ist eine Antwort, drei Roundtrips plus Client-Differenzbildung wären ein zweites Muster.

- Query: `monat=JJJJ-MM` (Pflicht; muss einen echten Kalendermonat benennen, sonst **400** mit `message`), `tz=` IANA-Zeitzone (optional; fehlt/unbekannt → Serverzone, kein Fehler — Muster `/scores/streak`). Ohne Session **401** (globale Gate-Regel).
- Antwort 200 `MonthlyRecap`:
  - `monat`: angefragter Monat (`JJJJ-MM`);
  - `saeulen[]`: `{ id, name, punkte }` je Säule — `punkte` = Differenz der kumulativen Säulenpunkte aus `berechneBalanceVerlauf` über das Fenster **[letzter Tag des Vormonats, letzter Tag des Monats]** (Stand am Monatsende minus Stand zum Fenstereintritt, eine Dezimalstelle) — exakt die Rechnung der Wochenkarte (#1968), Spiegel über `/scores/balance/history`;
  - `streak`: Streak-Stand am Monatsende (Stichtag Monatsende in der Nutzerzeitzone);
  - `meilensteine[]`: `{ schluessel, zeitpunkt }` — eigene `MilestoneReached`-Zeilen mit `zeitpunkt` im Monatsfenster („im Monat neu erreicht" — sticky-Bestand bleibt unangetastet, Auswahl strikt über `zeitpunkt`), aufsteigend nach `zeitpunkt`.
- Datenisolation: ausschließlich eigene Tasks/Entries/Meilensteine (`ownerScope`).

## Vertrag AK2 — `frontend/src/lib/monthlyShareCard.ts` (neu, Muster `weeklyShareCard.ts`)

- `erzeugeMonatsKarteSvg({ saeulen, streak, meilensteine, monat })` → SVG-String: je Säule Name + Wert, Streak, Monatslabel, Balamentum-Marke; **keine Aufgabeninhalte**; Säulen- und Meilenstein-Namen XML-escapen; Meilenstein-Texte **nur** bei nicht-leerer Liste (keine „0 Meilensteine"-Zeile — Fürsorge-Tonalität).
- `vormonat(datum: Date): string` → `JJJJ-MM` des Vormonats (lokale Zeit, Jahreswechsel-sicher).
- `monatsDateiname(monat: string): string` → `balamentum-monat-<JJJJ-MM>.png` (sprachneutral mit Monat, UX-Vorgabe).

## Vertrag AK3 — `server/src/logics/monthlyRecapPush.ts` (neu, Muster `streakReminder.ts`)

- `runMonthlyRecapPush(now? = new Date(), send?): Promise<{ usersNotified: number }>`; Registrierung im Scheduler (`server/index.ts`) — Verdrahtung ungetestet (ADR 0001).
- Je Nutzer: Recap-Monat = Vormonat der Nutzerzeitzone (ohne gültige Zone: UTC). Push-Payload `{ title, body, url }` (push-sw-Vertrag), Texte anerkennend ohne Schuld-Vokabular (Fürsorge-Tonalität, de-Referenz im UX-Block).
- Dedup: Prüfung `NotificationLog` mit `kind: 'monthly-recap'` und `dedupeKey: '<userId>:<JJJJ-MM>'` vor dem Versand; Log-Eintrag **erst nach** erfolgreichem Versand (`sent > 0`). Ein zweiter Lauf im selben Monat sendet nichts; ohne erfolgreichen Versand entsteht kein Log-Eintrag, der nächste Lauf sendet erneut.

## Vertrag AK4 — `frontend/src/components/MonthlyBalanceCard.tsx` (neu)

- Mount im Dashboard neben der WeeklyBalanceCard (`Dashboard.tsx`). Sichtbar **nur an Tag 1–7 des Monats** (Gate als Mount-Zustand wie der Sonntag-Gate #1968); danach verschwindet sie selbstständig.
- Datenabruf: `api.getMonthlyRecap({ monat: vormonat(heute), tz })` (neue api-Methode).
- Werte zusätzlich als Text im Card-DOM: Säulennamen + Werte, Streak, Meilensteine (SR-lesbar, AK2).
- Teilen = Web Share mit gerastertem PNG (2×, Rasterung erst im Klickpfad, `AbortError` ist kein Fehler); Download-Fallback mit `monatsDateiname(vormonat)`.
- testids: `monthly-balance-card`, `monthly-share`, `monthly-download`. KoliBri-Auswahl wie WeeklyBalanceCard (KolCard/KolButton/KolSpin/KolAlert — laut UX-Block gegen den Import-Kopf verifiziert).

## AK5 — Mobile-first

Card und Aktionen sind bei 375 px voll bedienbar: keine horizontale Ausdehnung über den Viewport, Teilen-Button zeilenfüllend und ≥ 44 px hoch (Bounding-Box-Prüfung, Muster `issue-1968-weekly-card.spec.ts`).

## Testfälle

| AK  | Datei                                                 | Art                                                                                    |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| AK1 | `server/src/express/scores-monthly-recap.test.ts`     | node:test API (401, 400, Verlaufs-Parität, tz-Streak, Meilenstein-Fenster + Isolation) |
| AK2 | `frontend/src/lib/monthlyShareCard.test.ts`           | Vitest Unit (SVG-Inhalt, Köder, Escaping, Vormonat/Dateiname)                          |
| AK3 | `server/src/logics/monthlyRecapPush.test.ts`          | node:test Unit (1 je Monat, Dedup-Zweitlauf, kein Log ohne Versand + Retry)            |
| AK4 | `frontend/src/components/MonthlyBalanceCard.test.tsx` | Vitest RTL (Gate, Datenabruf, DOM-Text, Share, Download)                               |
| AK5 | `frontend/e2e/monthly-balance-card.spec.ts`           | Playwright 375 px (Auth-Gate, Fenster an/aus, Viewport/Touch)                          |

## Bewusst ungetestet

- Scheduler-Verdrahtung in `server/index.ts` (ADR 0001), i18n-Texte der zehn Sprachdateien, OpenAPI-Schema-Anmeldung (Typvertrag der Impl-Phase).
- SVG→PNG-Rasterung (Canvas-Stub-Territorium, Muster #1968 — der Adapter ist dünn und durch die Share-/Download-Tests mitgedeckt).

## Offene Fragen

- keine — Fenster (Tag 1–7), Streak-Stichtag (Monatsende) und Push-Ton sind durch UX-Block/Analyse festgezurrt.
