# Spec #2772 — Server: Request-Validation bündeln und Array-Lücken schließen

## Ziel

Request-Validierung wird gebündelt und eine stille Lücke bei mehrfach gesendeten Query-Parametern
geschlossen — ohne dass sich eine bestehende 400-Meldung ändert (API-Vertrag).

## Voraussetzungen

- Eingeloggte Session (Cookie); alle berührten Endpunkte liegen unter `/scores`, `/journal`,
  `/users`, `/groups` bzw. `/push`.
- Express parst mehrfach gesendete Query-Parameter zu Arrays (`?tz=UTC&tz=Europe/Berlin` →
  `req.query.tz === ['UTC', 'Europe/Berlin']`).
- Die Feld-Helfer aus `server/src/logics/requestValidation.ts` (#2691) sind das Muster:
  wortgleiche Meldungen, Dedup-Spiegel-Tests im Modul.

## Verhalten

### 1. Nicht-leer-String-Helfer (`validateNonEmptyString(value, field)`)

- Ablehnung (Fehler-Kanal) bei: kein String (`undefined`, Zahl, Array, null), Leerstring,
  reiner Whitespace — Meldung wortgleich: `` `<field> muss ein nicht-leerer String sein.` ``.
- Erfolg (Erfolgs-Kanal): liefert den String unverändert zurück.
- `routes/push.ts` ersetzt damit alle Inline-Guards dieses Musters: `endpoint` und `keys.p256dh`/
  `keys.auth` im Subscribe-Guard, den Unsubscribe-Endpoint-Guard und den invertierten Guard in
  `fcmTokenOf` (die Längen-Grenze 4096 bleibt dort als Zusatzprüfung, `null`-Rückgabe ebenfalls).
- Kein Bestandstest der Push-Endpunkte wird umformuliert; die wortgleichen 400-Meldungen werden
  auf Modulebene gespiegelt (TF4).

### 2. Query-Einzelwert-Regel (Array → 400)

Mehrfach gesendete String-Query-Parameter der JSON-API sind ein Bedienfehler → 400 (mit
`message`), statt still auf Default/Fallback/Leerfilter zu fallen. Gilt für:

| Route                                      | Parameter             | Bisher (still)                 | Künftig |
| ------------------------------------------ | --------------------- | ------------------------------ | ------- |
| `GET /scores/care-suggestions/rejections`  | `taskId`              | ungefilterte Liste (200)       | 400     |
| `GET /scores/balance*` u. a. Scores-Routen | `tz`, `monat`, `jahr` | Fallback Serverzeit/leer (200) | 400     |
| `GET /journal/stats`                       | `granularitaet`, `tz` | Default `tag`/Serverzeit (200) | 400     |
| `GET /users/search`                        | `query`               | Leerfilter → `[]` (200)        | 400     |
| `GET /groups/:id/duo`                      | `tz`                  | Fallback Serverzeit (200)      | 400     |

- Einzelne ungültige Werte verhalten sich unverändert: `taskId=abc` → 400
  („taskId muss eine Ganzzahl sein.“), `granularitaet=monat` → 400, kurze `query` → `[]` (200),
  unbekannte einzelne `tz` → Fallback Serverzeit (200).
- **Ausnahme:** `auth.ts` (`error`-Parameter) bleibt beim Bestandsverhalten — OAuth-Redirect-Flow,
  kein JSON-API-Vertrag.
- Die exakten Fehlertexte der neuen Array-400er sind nicht Teil des Vertrags (nur Status 400 mit
  `message`).

### 3. Body-Seite

`rejectArrays` in `validateRequestBody` bleibt Opt-in (Semantik `llmProviders`/`pillarAdvisor`);
keine Default-Änderung, keine Vertragsänderung für Array-Bodies.

## Testfälle

| TF  | AK      | Ebene/Datei                                                                                                 | Inhalt                                                                                     |
| --- | ------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| TF1 | AK1     | `server/src/express/scores-care-suggestions.test.ts`                                                        | `taskId=1&taskId=abc` → 400 statt ungefilterter Liste                                      |
| TF2 | AK2/AK3 | `server/src/express/push.test.ts`, `push-fcm.test.ts`                                                       | Bestandsfälle (dedup — bereits vorhanden, bleiben unangetastet)                            |
| TF3 | AK4     | `scores-balance-history.test.ts`, `journal-stats.test.ts`, `users-search.test.ts`, `groups-duo.api.test.ts` | je ein Array-Fall (`tz`, `granularitaet`, `query`, `tz`) → 400                             |
| TF4 | AK3     | `server/src/logics/requestValidation.test.ts`                                                               | `validateNonEmptyString` hält die Meldungen wortgleich zu den bisherigen push.ts-Literalen |

`monat`/`jahr` (scores) und `tz` (journal) laufen über denselben gemeinsamen Helfer und sind über
die Vertreterfälle je Datei abgedeckt (Analyse TF3: Vertreter je Parametergruppe).
