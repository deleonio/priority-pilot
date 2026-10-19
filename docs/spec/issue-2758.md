# Spec #2758 — Systemseitig erzeugte Aufgaben als „Balamentum“ kennzeichnen

## Ziel

Aufgaben, die aus einem Fürsorge-Vorschlag übernommen wurden (POST /tasks mit
`careTemplateKey`), tragen eine System-Herkunft statt eines Ersteller-Kontos: Antwort-DTO,
GET /tasks und MCP `task_list` liefern `createdById: null` und `createdByName: "Balamentum"`.
Die Aufgabenliste zeigt dafür den bestehenden Ersteller-Badge; CareHint „Übernehmen“ sendet
den `careTemplateKey` der Vorlage mit.

## Vertrag

- **Diskriminator ist ein neues Task-Flag** (Vorbild `aiDraft`, `server/src/models/task.ts:60`),
  gesetzt, wenn POST /tasks mit gültigem `careTemplateKey` aufgerufen wird — **nicht** die
  `createdById`-null-Regel: Bestandsaufgaben mit `createdById` null (angelegt vor #1213) dürfen
  NICHT als Balamentum erscheinen (kein Backfill, AK3). Das Flag wird beim `Task.create` in
  `POST /tasks` (`server/src/express/routes/tasks.ts:802`) gesetzt; dort wird `createdById`
  statt `requesterId` null gespeichert.
- **Anzeige:** `serializeTask` (`routes/tasks.ts:175`) löst für gekennzeichnete Aufgaben
  `createdByName: "Balamentum"` auf (ohne Namens-Lookup, da kein Ersteller-Konto existiert).
  MCP `task_list` (`server/src/mcp/tools.ts:432`) reicht die GET /tasks-Antwort unverändert
  durch — kein eigener Eingriff, der Passthrough-Vertrag wird per Listen-Endpunkt getestet.
- **Badge ohne TaskTree-Eingriff:** die bestehende Badge-Bedingung
  (`TaskTree.tsx:213`: `forUserName == null && createdByName != null && createdById !== userId`)
  zeigt System-Aufgaben automatisch (null ≠ userId). Eigene Aufgaben bleiben ohne Badge.
- **CareHint:** `uebernehmen` (`frontend/src/components/CareHint.tsx:211-227`) nimmt
  `careTemplateKey: vorschlag.templateKey` in das `TaskCreate`-Payload auf (Feld existiert
  bereits im Client-Vertrag, `client/src/schema.d.ts:4091`).
- **Unberührt:** Vorlagen-Apply (`templates.ts:52`) und CSV-Import (`taskImport.ts:302`) bleiben
  ohne System-Kennzeichnung (vom Nutzer initiiert); Serien-Instanzen erben weiter den
  Serien-Ersteller (#2757).

## Akzeptanzkriterien (AK1–AK5)

Wie im Harness-Kommentar (Ampel 🟢): POST mit `careTemplateKey` → System-Herkunft mit
`createdByName: "Balamentum"` (AK1), MCP-Passthrough (AK2), Aufgaben ohne Key unverändert +
Bestand ohne Flag ohne Backfill (AK3), Badge für System-Aufgaben (AK4), CareHint sendet den
Key (AK5).

## Tests

API-Ebene (`node:test`), neue Datei `server/src/express/tasks-system-created.test.ts`
(Vorlage: `tasks-created-by.test.ts`); UI-Ebene (Vitest) in `TaskTree.test.tsx` und
`CareHint.test.tsx`:

- **TF1 (AK1):** POST /tasks mit `careTemplateKey` → 201-DTO `createdById` null,
  `createdByName` „Balamentum“.
- **TF2 (AK1+AK2):** GET /tasks (die Antwortform, die `task_list` durchreicht) trägt für
  dieselbe Aufgabe `createdByName` „Balamentum“.
- **TF3 (AK3):** POST ohne Key → `createdById`/`createdByName` des Erstellers; direkt geseedete
  Bestandszeile ohne Flag und `createdById` null → `createdByName` null (kein Backfill —
  rote Leitplanke gegen eine naive null-Mapping-Regel).
- **TF4 (AK4, Spiegel-Guard):** DTO `createdById` null + `createdByName` „Balamentum“ rendert
  den Ersteller-Badge; eigene Aufgabe (`createdById` = userId) ohne Badge. TaskTree braucht
  keine Änderung — der Test sichert den Spiegel zwischen Server-DTO und Badge-Bedingung.
- **TF5 (AK5):** Übernehmen-Handler ruft `createTask` mit `careTemplateKey` der Vorlage.
