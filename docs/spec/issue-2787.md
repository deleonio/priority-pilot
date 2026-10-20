# Spec #2787 — Schreib-Antworten der Serien-Endpunkte tragen `createdByName`

## Ziel

Schreib-Antworten, die Aufgaben aus Serien erzeugen, nennen denselben Ersteller wie die
Aufgabenliste: `POST /series/:id/generate` und `POST /series/:id/instances` serialisieren ihre
Instanzen aktuell mit `serializeTask(task)` **ohne Kontext** (`routes/series.ts:861/904`) —
`createdByName` ist dort immer `null`, während `GET /tasks` denselben Task mit Anzeigename des
Serien-Erstellers zeigt. Dazu zwei Vertragslücken aus #2758: `POST /tasks` nimmt jeden nicht-leeren
`careTemplateKey` als System-Übernahme (auch Tippfehler), und die Übergabe einer System-Aufgabe
(PATCH mit Empfänger-`userId`) setzt `systemCreated` nicht zurück — die Aufgabe zeigt weiter
„Balamentum“, obwohl sie längst einen Ersteller hat.

## Vertrag

- **Namens-Kontext an den Serien-Schreib-Endpunkten:** beide Routen laden die Namen wie
  `serializeSeries` (`routes/series.ts:564/790`, Muster `loadUserNames([createdById, userId])`) und
  übergeben den Kontext an `serializeTask`. MCP `series_instantiate` (`mcp/tools.ts:849`) ruft
  denselben `/series/:id/instances`-Endpunkt und erbt die Korrektur.
- **Read-Orakel:** der `createdByName`-Wert einer Schreib-Antwort ist identisch mit dem Wert
  derselben Aufgabe in `GET /tasks` (Muster `tasks-created-by.test.ts:398-527`). Kein neuer
  persistierter Name — weiter die DTO-Auflösung über `context.names`.
- **`careTemplateKey` nur aus dem Katalog:** ein Schlüssel, der nicht in `CARE_VORLAGEN`
  (`logics/careSuggestionData.ts:28`) existiert, wird mit **400** abgewiesen — keine Aufgabe, kein
  `systemCreated`, kein `uebernommen`-Care-Event (ein still ignorierte Tippfehler würde die
  Wirkungsmessung verfälschen). Ein gültiger Schlüssel verhält sich unverändert
  (`createdById: null`, `createdByName: "Balamentum"`).
- **Übergabe setzt `systemCreated` zurück:** PATCH mit Empfänger-`userId` (#1252-Übergabe) setzt
  bei einer System-Aufgabe `systemCreated = false` mit — Antwort **und** Aufgabenliste zeigen
  danach `createdByName` des übergebenden Nutzers (der PATCH setzt `createdById` bereits, nur das
  Flag blieb stehen).
- **Unberührt:** `serializeTask`-Aufrufe mit leerem Kontext in anderen Routen; Bestandsaufgaben
  ohne Flag bleiben ohne Anzeigename (kein Backfill, #2758); System-Aufgaben ohne Übergabe zeigen
  weiter „Balamentum“.

## Akzeptanzkriterien

- **AK1:** Beide Serien-Schreib-Endpunkte liefern je Instanz `createdByName` = Anzeigename des
  Serien-Erstellers, identisch mit `GET /tasks` (Read-Orakel).
- **AK2:** MCP `series_instantiate` liefert `createdByName` des Serien-Erstellers.
- **AK3:** `POST /tasks` mit unbekanntem `careTemplateKey` → 400, keine Aufgabe, kein
  `uebernommen`-Event; gültiger Schlüssel unverändert.
- **AK4:** Übergabe einer System-Aufgabe setzt `systemCreated` zurück — Antwort und Liste nennen
  den Übergebenden.

## Testfälle

- **TF1 (AK1):** `series-instances.api.test.ts` — Abruf-Instanz: Schreib-Antwort nennt den
  Ersteller wie die Liste (Erweiterung des A-für-B-Tests); Generate: je generierter Instanz
  `createdByName` + Orakel-Gegenprobe.
- **TF2 (AK2):** `mcp/tools.test.ts` — `series_instantiate`-Ergebnis trägt `createdByName`
  des Erstellers, gleicher Wert wie in `task_list`.
- **TF3 (AK3):** `tasks-system-created.test.ts` — unbekannter Schlüssel → 400, Task-Anzahl
  unverändert, kein `uebernommen`-Ereignis.
- **TF4 (AK4):** `tasks-system-created.test.ts` — System-Aufgabe per PATCH (gemeinsame Gruppe,
  Empfänger-`userId`) übergeben; Antwort und Liste nennen den Übergebenden.
- Kein Frontend-/UI-Änderung → kein e2e.

## Test-Pflege

- `tasks-system-created.test.ts` (TF1/TF2 aus #2758) nutzt erfundene Schlüssel
  (`koerper-spaziergang`, `koerper-dehnen`) — nach der Katalog-Validierung würden sie mit 400
  rot. In diesem Spec-PR auf echte `CARE_VORLAGEN`-Schlüssel (`koerper-1`, `koerper-2`)
  umgestellt. `frontend`-Tests mit denselben Fake-Keys mocken die API und bleiben unberührt;
  `scores-care-suggestions.test.ts:422` betrifft den Dismissals-Endpunkt, nicht `POST /tasks`.
