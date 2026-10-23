# Spec: Ungültige Pfad-IDs liefern 400 statt 500 (#2548)

## Ziel

Alle Routen der acht betroffenen Router (`groups`, `admin`, `apiTokens`, `categories`,
`placeFavorites`, `knowledgeEntries`, `journal`, `calendar`) parsen Pfad-IDs einheitlich über
`parseId` (`server/src/express/http-error.ts`) und antworten auf nicht-numerische oder
nicht-positive IDs (`abc`, `0`, `-1`) mit **400** und dem Fehlervertrag `{ message }` —
statt heute 404 (unerreichbare/leere Suche) oder 500 (DB-Fehler durch `NaN`-Binding).
Für gültige IDs ändert sich nichts.

## Voraussetzungen

- Eingeloggter Nutzer (Session-Cookie); für `knowledge-entries` Plan `pro`.
- `parseId` existiert (`http-error.ts:60`) und ist durch die Routen des Musters
  `admin.ts:335-338` bereits erprobt.

## Schritte / erwartetes Ergebnis

Je Router mindestens eine Route mit ID `abc` im Pfad:

| Router           | Route                                           | heute   | künftig                    |
| ---------------- | ----------------------------------------------- | ------- | -------------------------- |
| groups           | `GET /groups/abc`                               | 500/404 | 400                        |
| apiTokens        | `DELETE /api-tokens/abc`                        | 404     | 400                        |
| categories       | `PATCH /categories/abc` (leerer Body)           | 400     | 400 (Spiegel, unverändert) |
| placeFavorites   | `DELETE /place-favorites/abc`                   | 404     | 400                        |
| knowledgeEntries | `PATCH /knowledge-entries/abc` (valider `text`) | 404     | 400                        |
| journal          | `PATCH /journal/abc` (valider `text`)           | 404     | 400                        |
| calendar         | `DELETE /calendar-sources/abc`                  | 404     | 400                        |

Nicht-positive IDs: `DELETE /api-tokens/0` und `/api-tokens/-1` → 400 (repräsentativ für den
`parseId`-Vertrag; deckt die Router, deren `!Number.isInteger`-Guard `0`/`-1` heute durchlässt).

`admin` ist bereits konform und durch `admin.api.test.ts` (`PATCH /admin/users/abc/plan` → 400)
abgedeckt — kein zusätzlicher Test (Dedup).

## Zuordnung Tests ↔ AKs

- **AK1** (kein `Number(req.params` außerhalb von Tests): manueller Grep-Nachweis in der
  PR-Beschreibung der Implementierung — kein eigener Test (laut Analyse-Block).
- **AK2** (je Router 400 + `{ message }`): `server/src/express/invalid-path-ids.test.ts` —
  ein Fall je Router (`abc`), jeder Fall via `expectError` (Status 400 + JSON-Body mit
  nicht-leerer `message`); zusätzlich `0`/`-1`.
- **AK3** (gültige IDs unverändert): Regressions-Schutz durch die bestehenden Router-Suites
  (`pnpm --filter server test` gesamt grün nach der Implementierung).
