# ADR 0020 — Serien mit Schalter „Automatisch anlegen", Vorlage = Serie ohne Automatik

- **Status:** Accepted (2026-10-07)
- **Datum:** 2026-10-07
- **Kontext:** [Epic #2353](https://github.com/deleonio/priority-pilot/issues/2353) („Vorlagen auf Abruf"), Issue #2354, [arc42 Abschnitt 6.3](../arc42.md)

## Kontext

Serien erzeugen ihre Instanzen heute über `POST /series/generate-all` (idempotent), ausgelöst von der App. Für „Vorlagen auf Abruf" sollen Aufgaben auch ohne feste Wiederholung aus einer Serie entstehen können, nur wenn Nutzer sie anfordern. Datenmodell und Begriffe sind entschieden, aber nirgends festgehalten. Außerdem ist „Vorlage" bereits für die Projekt-Vorlagen der Website vergeben (`/vorlagen/`, #1993).

## Entscheidung

**1. Schalter „Automatisch anlegen" an der Serie.** Ist er an, legt ein täglicher Server-Job die Instanzen an (neben den Tickern in `server/src/scheduler/index.ts`). Die Instanzerzeugung läuft damit serverseitig und nicht mehr nur über `generate-all`.

**2. Vorlage = Serie ohne Automatik.** Ist der Schalter aus, ist die Serie eine Vorlage: Der Job rührt sie nicht an, Aufgaben entstehen nur auf Abruf.

**3. Abruf-Instanzen bleiben live mit der Serie verknüpft.** Eine Aufgabe, die aus einer Vorlage abgerufen wird, behält die Verknüpfung zur Serie; Änderungen an der Serie wirken wie bei automatisch angelegten Instanzen.

**4. Verworfene Alternativen:**

- **Eigene Vorlagen-Entität:** zweites Modell mit eigener Pflege, Synchronisation und Verknüpfung; eine Serie mit Schalter deckt denselben Zweck mit dem vorhandenen Modell ab.
- **Nullable `rhythm`/`startDate`:** macht Pflichtfelder optional und verteilt Sonderfälle („Serie ohne Rhythmus") über jede Stelle, die Serien liest; ein expliziter Schalter hält das Modell eindeutig.

**5. Begriffe.** „Vorlage" bezeichnet in der App eine Serie ohne „Automatisch anlegen". „Projekt-Vorlage" bezeichnet die Bibliothek der Website (`/vorlagen/`, #1993). Die beiden Begriffe werden in UI, Doku und Code nicht vermischt.

## Konsequenzen

- Der Job und der Schalter entstehen in Folge-Tickets von #2353; dieses ADR ändert keinen Code. [arc42 6.3](../arc42.md) beschreibt den Zielzustand.
- `generate-all` bleibt als idempotenter Baustein erhalten, der Job nutzt ihn.
- Texte in der App sagen „Vorlage", Texte zur Website-Bibliothek „Projekt-Vorlage".
