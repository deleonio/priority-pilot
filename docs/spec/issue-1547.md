# Spec — Issue #1547: LLM-Provider nutzergebunden (pro User eigene Custom-Provider)

Quelle: Harness-Marker-Kommentar (KI-ANALYSE, stand=2026-09-17T15:55:37Z), AK1–AK2. Parent: #1531.

## Ziel

Custom-LLM-Provider (`kind='custom'`) gehören einem Nutzer. Das `LlmProvider`-Modell erhält eine
nullable Spalte `userId` (`null` = instanzweit, Muster: Geo-Config #1098). Jeder `/llm-providers`-Endpunkt
löst den Session-Nutzer auf (Muster `resolveGeoUser` in `server/src/express/routes/geoConfig.ts:30-52`)
und schränkt Lesen und Schreiben auf `userId IS NULL OR userId = <nutzer>` ein.

## Vorbedingung

- Bestehende instanzweite Zeilen (`userId = null`, inkl. der Built-ins Mistral/OpenRouter) bleiben für
  alle Nutzer sichtbar, aktivierbar und (Built-ins: Modellwahl) nutzbar — unverändertes Verhalten.
- Die Spalte ist nullable; Bestandszeilen bleiben ohne Migration gültig (Sequelize/SQLite).

## Ablauf / Verhalten

1. **POST** legt die Zeile mit `userId` des Session-Nutzers an ( neu angelegte Custom-Provider sind
   immer nutzergebunden, nie instanzweit).
2. **GET** liefert dem Nutzer die instanzweiten Zeilen plus ausschließlich seine eigenen — Zeilen
   anderer Nutzer erscheinen nicht.
3. **PUT / DELETE / activate / models / test** auf eine Provider-ID eines anderen Nutzers verhält
   sich wie eine unbekannte ID: **404** (Built-in-Schutz bleibt davon unberührt: 400 wie bisher).
4. **apiKey** bleibt Write-Only: In keiner Response irgendeines Endpunkts (GET, POST, PUT, activate,
   Modellliste, Test) taucht das Feld `apiKey` oder der Schlüsselwert auf — auch nicht maskiert.

Nutzung des eigenen Providers für LLM-Aufrufe, Gate-/Kontingent-Bypass und Frontend folgen in
Nachfolger-Tickets (blocked-by-Kette, Parent #1531) — nicht Scope dieser Spec.

## Akzeptanzkriterien → Testfälle

Erweitert `server/src/express/routes/llmProviders.test.ts` (describe `#1547`):

| AK  | Testfall                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | TF1: Nutzer A und B legen je einen eigenen Provider an, zusätzlich existiert eine instanzweite Zeile (`userId = null`); DB-Zeilen tragen die jeweilige `userId`; GET je Nutzer zeigt instanzweite + eigene, nicht die des anderen. |
| AK1 | TF2: PUT/DELETE/activate von B auf A's Provider-ID → 404; Löschen durch den Eigentümer → 204.                                                                                                                                      |
| AK2 | TF3: Responses von GET, PUT, activate und Modellliste enthalten weder Feld `apiKey` noch den Klartext-Schlüssel (POST-Response und GET-Liste decken die Bestandstests bereits ab — keine Duplizierung).                            |

## Annahme (dokumentiert, nicht blockierend)

- Nutzerbindung über nullable Spalte `userId` statt separate Tabelle (aus der Parent-Analyse übernommen,
  im Analyse-Block verankert).
- OpenAPI-Schemata und Frontend-Typen werden in der Implementierungsphase mitgezogen (kein eigener AK —
  die AKs sind rein API-Verhalten).
