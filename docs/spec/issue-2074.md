# Spec: #2074 — Säulen nach Wichtigkeit antippen (Rangfolge-Treppe)

## Ziel

Im Aufgabendialog entsteht die Säulen-Verteilung durch Antippen in der Reihenfolge der
Wichtigkeit: die angetippten Säulen bekommen die Treppe 50/20/15/10/5 %, unangetippte Säulen
teilen den Rest gleichmäßig. Gespeichert wird immer die vollständige Verteilung über alle fünf
Säulen. Die 80/5/5/5/5-Regel samt Regelvorschlag-Block aus #1962 entfällt; der
Expertenmodus-Regler (#1984) und der KI-Vorschlag (`suggestPillars`, Vorrang) bleiben
unberührt. Konstanten (Treppe 50/20/15/10/5) identisch zum Server-Spiegel (#2075).

## Vertrag reine Funktion `distributionFromRankOrder` (`frontend/src/lib/pillar.ts`)

- Signatur: `(rankedPillarIds: readonly number[], pillars: readonly Pillar[]): TaskPillarContribution[]`.
- Rang 1..5 (Tipp-Reihenfolge) bekommt die Treppe 50/20/15/10/5; unangetippte Säulen teilen den
  Rest (`100 − Σ Treppe`) gleichmäßig — ganzzahlig per Largest Remainder, Gleichstand nach
  Säulen-Listenordnung (deterministisch, UX-Advisory).
- Ergebnis in Listenordnung, ganzzahlig, Summe exakt 100, `confidence` 100.
- Leere Rangfolge → Gleichverteilung (je 20 %); unbekannte Säulen-IDs werden ignoriert.
- Beispiele: `[1,2,3,4]` → 50/20/15/10/5 · `[1]` → 50/13/13/12/12 · `[1,2]` → 50/20/10/10/10.
- Ersetzt `suggestMainDistribution` (#1962) im Frontend.

## UI-Vertrag (TaskForm)

- Jede Säule ist eine zeilenhohe Tap-Fläche (KolButton, `secondary` — Speichern bleibt die eine
  Primäraktion); die Tipp-Reihenfolge erzeugt die Rangfolge, ein erneuter Tipp auf eine
  angetippte Säule nimmt ihren Rang zurück, verbleibende Ränge rücken auf, Anteile rechnen sich
  sofort neu.
- Label-Vertrag (Rang und Anteil als Text, nie nur Farbe): gerankt
  `Rang <n> von 5: <Name> — <Anteil> %`, ungerankt `<Name> — <Anteil> %`. Initial (ohne Tap):
  Gleichverteilung, also `<Name> — 20 %`.
- Die bestehende `aria-live`-Region zur Verteilung bleibt erhalten (Neuberechnungen werden
  angesagt).
- Edit-Flow: die Rangfolge wird aus der gespeicherten Verteilung abgeleitet (Anteile absteigend
  = Rang 1..n), danach gelten dieselben Tap-Bedienelemente.
- Schließen ohne Eingriff fragt nicht nach „ungespeicherte Änderungen" (Bestand #1584, bleibt).

## Speichern (AK4)

Anlegen und Bearbeiten von Aufgabe und Serie senden immer fünf Beiträge, jeder Anteil zwischen
5 und 80, Summe exakt 100. Ein Tipp auf die Hauptsäule genügt zum Speichern.

## Akzeptanzkriterien → Tests

| AK                                                                        | Testebene              | Datei                                                                         |
| ------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------- |
| AK1 (Tipp-Reihenfolge → 50/20/15/10/5, Rang/Anteil sichtbar)              | Unit + Component + E2E | `pillar.test.ts`, `TaskForm.test.tsx`, `issue-2074-saeulen-rangfolge.spec.ts` |
| AK2 (nur Hauptsäule: 50 %, Rest gleichmäßig 13/13/12/12, Summe 100)       | Unit + Component       | `pillar.test.ts`, `TaskForm.test.tsx`                                         |
| AK3 (erneuter Tipp nimmt Rang zurück, Ränge rücken auf)                   | Unit + Component       | `pillar.test.ts`, `TaskForm.test.tsx`                                         |
| AK4 (Anlegen/Bearbeiten Task+Serie: 5 Beiträge, [5,80], Summe 100)        | Component              | `TaskForm.test.tsx`                                                           |
| AK5 (375 px ohne horizontal Scrollen, Touch-Ziele ≥ 44 px, Rang als Text) | E2E                    | `issue-2074-saeulen-rangfolge.spec.ts`                                        |

## Test-Pflege (dieser PR)

- `pillar.test.ts`: #1962-Block `suggestMainDistribution` (80/5/5/5/5) entfernt — widerspricht
  AK1/AK2 (dieselbe Rolle, andere Verteilung; Issue: „Die Rang-Regel ersetzt
  `suggestMainDistribution`").
- `TaskForm.test.tsx`: Describe `#1962 — Hauptsäulen-Modus` entfernt — prüft Regelvorschlag-UI
  („Vorschlag übernehmen"/„Nicht übernehmen") und Ein-Säulen-Payload, die beide entfallen.
- `frontend/e2e/issue-1962-hauptsaule.spec.ts` gelöscht — prüft durchgängig die ersetzte
  Hauptsäulen-Select-/Regelvorschlag-UI; die tragenden Verträge (mit nur einem Tap speichern,
  375 px) übernimmt `issue-2074-saeulen-rangfolge.spec.ts`.

## Offene Punkte

- Speichern ohne jeden Tap: keine Rückfrage, Verteilung = Gleichverteilung (Deckung durch
  Bestandsverhalten `fillContributions`; kein eigener Test, da kein AK).
- Abgelöste e2e-Referenzen auf die Hauptsäulen-KolSelect in `issue-1061-task-address.spec.ts`
  (nur Kommentar) sind unkritisch.
