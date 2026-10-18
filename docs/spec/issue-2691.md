# Spec #2691 — Anfrage-Validierung von Aufgaben und Serien in `logics/requestValidation.ts` zusammenführen

## Ziel

Die duplizierten, DB-freien Request-Validierungen wandern in das neue, reine Modul
`server/src/logics/requestValidation.ts` (Muster `pillarContributions.ts`): gemeinsame Feld-Helfer
plus ein generischer Ergebnistyp `ValidationResult`. Nach außen sichtbares Verhalten bleibt
unverändert — wortgleiche Meldungen, gleiche Status-Codes (400), gleiche Prüfreihenfolge je Route.

## Vorbedingungen

- Bestandssuite (`pnpm --filter server test`) bleibt unverändert grün — sie ist der
  Wortgleichheits-Spiegel (AK3): u. a. `server/src/express/series.api.test.ts`,
  `tasks-title-length.test.ts`, `tasks-address.test.ts`, `tasks-coordinates.test.ts`,
  `tasks-checklist.test.ts`, `series-title-length.test.ts`, `series-address.test.ts`.
- Route-spezifische Prüfungen bleiben an ihrem Ort — als Komposition in unveränderter Reihenfolge,
  damit die Fehler-Präzedenz bei mehrfach ungültigem Body erhalten bleibt:
  tasks — status, actualEffort, autoDeleteAfterDeadline, checklist (mit `completed`),
  pinned/pinnedAt, categoryId, completedAt (inkl. Zukunfts-Check), pillars-Wrapper;
  series — rhythm, active, autoCreate samt none-Regel (#2355), isPost-Defaults (#2404),
  Checkpunkte ohne `completed`.
- push.ts/pillars.ts ändern nur den Typ-Bezug (`ValidationResult` aus dem neuen Modul statt lokal).

## Vertrag `server/src/logics/requestValidation.ts`

| Export                    | Signatur                                                                                                   | Semantik (byte-genau aus den Routen übernommen)                                                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ValidationResult<T>`     | `type ValidationResult<T extends { ok: true }> = T \| { ok: false; message: string }`                      | Generischer Erfolgs-/Fehler-Kanal; bewahrt die vorhandenen Erfolgs-Keys `attrs` (tasks/series), `value` (push), `entries` (pillars).                                                                             |
| `FieldResult<T>`          | `type FieldResult<T> = ValidationResult<{ ok: true; value: T }>`                                           | Rückgabeform der Feld-Helfer.                                                                                                                                                                                    |
| `validateRequestBody`     | `(body: unknown) => FieldResult<Record<string, unknown>>`                                                  | Body-Objekt-Guard; Meldung wortgleich: `Request-Body muss ein Objekt sein.`                                                                                                                                      |
| `validateTitle`           | `(value: unknown, required: boolean) => FieldResult<string \| undefined>`                                  | Trim; `undefined` im Pflicht-Modus → `title ist erforderlich.`; Typ-/Leer-Verstoß (auch nur Whitespace) → `title muss ein nicht-leerer String sein.` — Typ-/Leer-Check läuft vor dem Pflicht-Check.              |
| `validatePriority`        | `(value: unknown) => FieldResult<number>`                                                                  | Ganzzahl 1–5; Meldung wortgleich.                                                                                                                                                                                |
| `validateEstimatedEffort` | `(value: unknown) => FieldResult<number>`                                                                  | Endliche Zahl 0.1–1; Meldung wortgleich.                                                                                                                                                                         |
| `validateDescription`     | `(value: unknown) => FieldResult<string \| null>`                                                          | String oder null; Meldung wortgleich.                                                                                                                                                                            |
| `validateAddress`         | `(value: unknown) => FieldResult<string \| null>`                                                          | String max. 255 oder null; Trim, Leer/Whitespace → null; Meldung wortgleich.                                                                                                                                     |
| `validateCoordinates`     | `(input: Record<string, unknown>) => FieldResult<{ latitude: number \| null; longitude: number \| null }>` | Paar-Prüfung −90/90 bzw. −180/180; Einzel-Koordinate oder `null` auf einer Seite normalisiert BEIDE Werte zu null; Meldungen wortgleich.                                                                         |
| `validateIsoDate`         | `(value: unknown, field: 'deadline' \| 'startDate', allowNull: boolean) => FieldResult<Date \| null>`      | Parameterisierter ISO-Parser: `null` nur bei `allowNull` erlaubt; Meldung je Variante als Wortliteral: `deadline muss ein gültiges ISO-Datum oder null sein.` bzw. `startDate muss ein gültiges ISO-Datum sein.` |

Die Meldungstexte stehen als Wortliterale im Modul (keine Template-Bausteine) — die Routen
referenzieren die Texte danach nicht mehr. Der Koordinaten-Paar-Block wird wie bisher nur
aufgerufen, wenn mindestens eines der beiden Felder im Body vorhanden ist (Guard bleibt in der
Route); `title`-Pflicht-Modus entspricht `requireTitle` (tasks) bzw. `isPost` (series).

## Tests (rote Spec-Tests, `server/src/logics/requestValidation.test.ts`)

- **TF1 (Unit-Vertrag):** je Helfer Grenzwerte und exakte Meldungen — priority 0/6 abgelehnt,
  1/5 angenommen; estimatedEffort 0.05/1.1 abgelehnt, 0.1/1 angenommen; title nur Whitespace
  abgelehnt + Trim + Pflicht-Modus; address Trim und Leer → null + 255-Grenze; description
  String/null; Koordinaten-Paar an den Grenzen, Überschreitungen mit wortgleicher Meldung,
  Einzel-Koordinate → beide null; Datums-Parser in beiden Varianten (`deadline` mit null-Erlaubnis,
  `startDate` ohne) mit wortgleichen Meldungen; Body-Guard.
- **TF2 (statischer Dedup-Spiegel, AK1/AK2):** über alle Production-`.ts`-Dateien unter
  `server/src` (ohne `*.test.ts`/`*.d.ts`): `type ValidationResult` und jede gemeinsame
  Meldung kommen ausschließlich in `requestValidation.ts` vor; die vier Routen-Dateien
  importieren aus `../../logics/requestValidation.js`.
- **TF3 (Spiegel, kein neuer Test):** die Bestandssuite bleibt grün und assertet die Meldungen
  an den Routen weiter (AK3) — wird erst in der Umsetzungsphase grün-fähig, hier unverändert.
