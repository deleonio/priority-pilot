# Kantengewicht (0,1–1) durchsetzen und im Dialog bearbeitbar machen

**Stand:** 2026-09-14

## Ziel

Das Kantengewicht einer Abhängigkeit (`Dependency.weight`) ist heute serverseitig nur auf `>= 0` geprüft; der
gültige Bereich laut Vertrag (`TaskGraphEdge.weight`, UI-Slider) ist aber 0,1 bis 1. `POST /tasks/{id}/dependencies`
und das MCP-Werkzeug `task_link` setzen das ab jetzt durch. Im Abhängigkeits-Dialog wird das Gewicht eines
**bestehenden** Vorgängers sichtbar und änderbar (bisher nur beim Hinzufügen möglich).

## Serverseitige Validierung (AK1–AK4, AK6)

`POST /tasks/{id}/dependencies` (`server/src/express/routes/tasks.ts:881-887`):

- `weight` fehlt → Default `1` bleibt (unverändert, AK3).
- `weight` vorhanden und in `[0.1, 1]` → 201, Wert wird gespeichert (AK1), auch bei erneutem POST auf eine
  bestehende Kante (Idempotenz-Update, AK4).
- `weight` vorhanden und außerhalb `[0.1, 1]` (`0`, `0.05`, `1.1`, …) → 400, Fehlertext nennt den Bereich
  „0,1 bis 1" (AK2).

MCP `task_link` (`server/src/mcp/tools.ts:294-317`) ruft denselben Endpunkt auf und erbt die Validierung 1:1
(AK6) — ein Gewicht außerhalb des Bereichs liefert einen Fehler, `0.1`/`1` gelingen.

## UI: Gewicht einer bestehenden Abhängigkeit sehen und ändern (AK7–AK9)

`frontend/src/components/DependencyModal.tsx`, Liste „Aktuelle Vorgänger":

- Jede Zeile zeigt das aktuelle Gewicht des Vorgängers (`DependencyRef` wird um ein `weight`-Feld erweitert;
  Quelle ist Sache der Implementierung — z. B. Erweiterung von `buildDependencyMap`/`GET /forest`).
- Jede Zeile bekommt ein eigenes Bedienelement (Vertrag für die Tests: `KolInputRange`, `role="slider"`,
  zugänglicher Name `` `Gewicht: ${dependency.title}` ``, `_min=0.1 _max=1 _step=0.1`, analog zum bestehenden
  Hinzufügen-Slider `DependencyModal.tsx:155-173`).
- Eine Änderung ruft `api.addDependency({ id: task.id, dependencyInput: { dependingTaskId: dependency.id,
weight: <neuerWert> } })` auf (derselbe idempotente Endpunkt) und danach `onChanged()`.
- Mobile-First 375 px: der Dialog inklusive der Zeilen-Slider erzeugt keinen horizontalen Overflow.

## Dokumentation (AK10)

`server/src/models/dependency.ts:8` bekommt einen Kommentar, der Bereich (0,1–1) und Auswertungsort
(`calculateValueContribution` in `server/src/logics/value.ts`, `buildTaskGraph` in `server/src/logics/graph.ts`)
benennt. `openapi.yml` (`DependencyInput.weight`, `TaskGraphEdge.weight`) und die MCP-Beschreibung von
`task_link` (`server/src/mcp/tools.ts:304`) nennen denselben Bereich statt „>= 0" (kein eigener Test, ADR 0001 —
Vertragsdatei ist kein Anwendungscode; Konsistenz wird im Review geprüft).

## Erwartetes Ergebnis

- Werte außerhalb 0,1–1 sind über keinen Weg (API, MCP, UI) mehr speicherbar.
- Das Gewicht eines bestehenden Vorgängers ist im Dialog sichtbar und änderbar.
