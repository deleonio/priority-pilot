# Spec #2757 — Serien-Instanzen übernehmen den Ersteller der Serie

## Ziel

Jede aus einer Serie erzeugte Aufgaben-Instanz trägt denselben Ersteller wie ihre Serie
(`createdById`): Die Aufgabenliste (GET /tasks) und MCP `task_list` zeigen den Anzeigename des
Erstellers an — analog zu direkt erstellten Aufgaben (#1213). Bestandsserien ohne Ersteller
(`createdById` null, `server/src/models/series.ts:77`) erzeugen Instanzen ohne Ersteller.

## Vertrag

- **Fixort:** `createInstanceFromSeries` (`server/src/logics/series.ts:188`) übernimmt
  `createdById: series.createdById ?? null` in den `Task.create`-Snapshot. Die Funktion ist die
  gemeinsame Kopierlogik beider Erzeugungswege — `generateDueInstances` (Generierungslauf,
  `POST /series/generate-all` und Auto-Job) und `createOnDemandInstance` (`POST
/series/:id/instances`) — damit deckt eine Stelle alle Wege ab.
- **Kein Fallback:** Bleibt `series.createdById` null (Alt-Bestand), trägt die Instanz
  `createdById = null` — insbesondere wird NICHT der Serien-Eigentümer (`userId`) als Ersteller
  eingetragen.
- **Gruppenfall A für B:** Serie mit `userId` = B (Empfänger) und `createdById` = A (Ersteller):
  jede Instanz behält `userId` = B und trägt `createdById` = A (Felder nicht vertauschen,
  Muster #1222/#1253).
- **Anzeige unverändert:** `createdByName` wird nicht persistiert — die bestehende DTO-Auflösung
  (`routes/tasks.ts:215`, `context.names`) liefert den Anzeigename des Erstellers, sobald die
  Instanz `createdById` trägt. MCP `task_list` nutzt dieselbe Serialisierung.
- **Unberührt:** `notifyCreatorOfInstances` (`series.ts:230`) liest `series.createdById` weiterhin
  von der Serie; Lese-Scope-Erweiterung um `createdById` (#1213) greift für Instanzen automatisch.

## Akzeptanzkriterien (AK1–AK4)

Wie im Harness-Kommentar (Ampel 🟢): Instanz übernimmt `createdById` der Serie auf allen
Erzeugungswegen (AK1), Gruppenfall A für B mit korrekt getrennten Feldern (AK2), null bleibt null
(AK3), GET /tasks und MCP `task_list` zeigen `createdByName` des Erstellers (AK4).

## Tests

API-Ebene (`node:test`), Erweiterung `server/src/express/series-instances.api.test.ts`
(Vorlagen: `tasks-created-by.test.ts`, eigener #2357-Block):

- **TF1a (AK1, Abruf-Weg):** Serie mit `createdById` → `POST /series/:id/instances` → Instanz in
  der DB mit `createdById` = Serien-Ersteller.
- **TF1b (AK1, Generierungs-Weg):** Serie mit `createdById`, `autoCreate` →
  `POST /series/generate-all` → alle neuen Instanzen mit `createdById` = Serien-Ersteller.
- **TF2 (AK3):** Serie ohne `createdById` → Abruf-Instanz mit `createdById = null` (kein
  Eigentümer-Fallback).
- **TF3 (AK2+AK4):** A legt Serie für B an (`userId` = B, `createdById` = A) → B erzeugt Instanz:
  `userId` = B, `createdById` = A; GET /tasks (als B) liefert `createdByName` = Anzeigename von A.
