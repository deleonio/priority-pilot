# Checklisten-Limit 20 → 50

**Stand:** 2026-10-10

## Ziel

Die Checkliste einer Aufgabe fasst bisher höchstens 20 Einträge (`MAX_CHECKLIST_ITEMS`,
server/src/express/routes/tasks.ts:77). Das Limit steigt auf 50; alle produktiven Nennungen
des Limits nennen fortan 50. Der einzige Prüfpunkt bleibt `validateChecklist` — UUID-`id`,
Titel 1–255 und `completed`-Regeln sind unverändert (AK3), die Fehlermeldung wird an die
Konstante gekoppelt (Template-Literal), damit sie bei künftigen Limit-Änderungen nicht
wieder driftet.

## Ablauf

1. POST `/tasks` mit genau 50 Checklisten-Einträgen → 201; der Response enthält alle 50
   Einträge, ein anschließendes GET `/tasks/:id` liefert sie persistent wieder (AK1).
2. PATCH `/tasks/:id` mit 50 Einträgen → 200 (AK1, PUT/PATCH-Pfad derselben Validierung).
3. POST `/tasks` mit 51 Einträgen → HTTP 400 mit der Meldung „checklist darf höchstens
   50 Einträge enthalten." (AK2).
4. Aufgaben mit ≤ 20 Einträgen verhalten sich byte-identisch wie bisher (AK3, Regression —
   die bestehenden ≤ 20-Tests laufen unverändert grün).
5. Alle produktiven Nennungen nennen 50 (AK4): `MAX_CHECKLIST_ITEMS = 50` inkl. dynamischer
   Fehlermeldung, KI-Prompt (llm.ts, „maximal 50 Einträge"), MCP-Werkzeugbeschreibung
   (mcp/tools.ts, „at most 50 entries"), openapi.yml an den drei Stellen (0–50 / max. 50).
   Die Overflow-Fixtures der MCP-Tests verwenden 51 Einträge.

## Erwartetes Ergebnis

- 50 Einträge sind anleg- und speicherbar (POST 201, PATCH 200), der 50. Eintrag ist
  persistent und im Response enthalten.
- Der 51. Eintrag wird mit HTTP 400 und einer Meldung abgewiesen, die das Limit 50 nennt;
  nichts wird angelegt oder geändert.
- Fehlermeldung und Limit teilen sich eine Quelle (`MAX_CHECKLIST_ITEMS`).
- Historische Spec-Artefakte (docs/spec/issue-2458.md, issue-2460.md) bleiben unangetastet.

## Testpflege

- Der alte Grenz-Test „mehr als 20 Checklist-Items → 400" (#531, AC4/T6, 21 Einträge)
  widerspricht AK1 (50 Einträge müssen anlegbar sein) und wird durch die 50/51-Grenztests
  ersetzt.
- Die MCP-Overflow-Fixtures (21 Einträge, /höchstens 20/) würden nach der Erhöhung fälschlich
  grün durchlaufen und werden auf 51 Einträge mit /höchstens 50/ angehoben.
