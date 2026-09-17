# Spec #1471 — Protokoll 2026-09-17: F-10, F-11, V-3

Quelle: Code-Review-Protokoll (Issue #1471), Sammel-PR per Nutzer-Direktive 2026-09-15.

## AK1 — `revise()` protokolliert unlesbare PayPal-Antwort (F-10)

**Ziel:** Der stille `{}`-Fallback in `server/src/logics/paypal.ts` (`revise()`, `res.json().catch(() => ({}))`) schluckt Parse-Fehler weiterhin kontrolliert — der Abo-Wechsel war serverseitig erfolgreich (`res.ok`), `revise()` darf nicht werfen. Der Fehler wird aber sichtbar: genau eine `console.warn`-Meldung mit Fehlerkontext (Parse-Fehler), analog PR #1480 (`apiTokenAuth.ts`).

**Vorbedingung:** `revise()` erhält von PayPal HTTP 200.

**Fälle:**

| Situation                                | Verhalten                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| 200 + ungültiges JSON                    | `revise()` löst mit `{}`; `console.warn` genau 1× mit Parse-Fehler-Kontext |
| 200 + gültige Antwort mit `approve`-Link | Rückgabe `{ approvalUrl }`; keine Warnung                                  |
| nicht-ok Status                          | unverändert: `throw` (bestehendes Verhalten)                               |

## AK2 — Begründungskommentar Cast `migrate.ts:105` (F-11)

Kein Verhaltens-Change: Der Cast `tableCheck as unknown[]` erhält einen Begründungskommentar analog `graph.ts:104-106` (Sequelize-Rohabfrage ohne generierten Typ). Kein Test (Kommentar-only); `migrate.test.ts` bleibt unverändert grün. `graph.ts` unangetastet.

## AK3 — arc42 §10 QS-Szenario für `#flexible` (V-3)

Doku-Change: `docs/arc42.md` §10 erhält für `#flexible` ein nachprüfbares QS-Szenario mit Messkriterium (Muster-Treue: ein etabliertes Muster je Problem, geprüft am Code-Review-Protokoll); Tabellenzeile Z. 324 verweist darauf. `#efficient` (Z. 325) bleibt unverändert offen. Kein Test (kein Anwendungscode).
