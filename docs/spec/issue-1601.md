# Spec: #1601 — Klassifikator-Regel für Säulen-Anteile (AK7)

Owner-Entscheidung 2 (Harness-Kommentar #1601, 23.09.2026): Ist die Summe der Klassifikator-Konfidenzen
≤ 100, bekommt jede vorgeschlagene Säule ihre Konfidenz als Anteil; der Rest (100 − Summe) wird
**gleichmäßig auf alle Säulen** verteilt (auch die vorgeschlagenen). Bei Summe > 100 bleibt die
bisherige proportionale Normierung. Danach gelten unverändert `SHARE_MIN` (5 %) und ganzzahlige
Rundung auf Summe exakt 100.

Ziel: Ohne Vorschlag für eine Säule (z. B. „Sinn") landet sie nicht mehr strukturell am Mindestanteil
5 %, sondern bekommt einen anteiligen Sockel aus dem Rest — Grundlage für den zeitbezogenen Füllstand.

## Geltungsbereich dieser Spec-Runde

Nur AK7 (Klassifikator-Regel, `toContributions` Server + `suggestionsToContributions` Frontend) ist
in dieser Runde spezifiziert und mit roten Tests belegt. AK1–AK6, AK8 (Soll-Kadenz-Feld, Migration,
zeitbezogener Füllstand, Punkte-Parität, Randfälle, Score-Unberührtheit) sind **nicht** Teil dieser
Runde — Begründung und Scope-Beschränkung stehen im PR-Body unter „Offene Fragen" (Zeitbudget des
Laufs). Ein Folgelauf ergänzt Spec + rote Tests für diese ACs.

## Vertrag AK7

Eingabe: Liste von Vorschlägen `{ pillarId, confidence }`, vollständige Säulenliste (`pillarIds`/
`Pillar[]`). Ungültige Vorschläge (fremde Säule, Dubletten, `confidence <= 0`) fallen vorher raus,
wie bisher.

- **Summe der gültigen Konfidenzen ≤ 100:** `shareᵢ = confidenceᵢ (0 wenn nicht vorgeschlagen) +
(100 − Summe) / n`, `n` = Anzahl aller Säulen des Kontos. Beispiel (5 Säulen, nur eine Säule mit
  Konfidenz 30): `share = 30 + 70/5 = 44` für die vorgeschlagene Säule, `0 + 14 = 14` für jede andere.
- **Summe > 100:** bisherige proportionale Normierung (`confidenceᵢ / Summe × 100`) unverändert.
- Danach: `SHARE_MIN` (5 %) als Untergrenze, ganzzahlige Rundung (Largest-Remainder) auf Summe exakt
  100 — wie in `distributeWithMinimum`/`roundSharesToTotal` bereits etabliert.

Betroffene Funktionen (Spiegelprinzip, #1596/#1635): `toContributions`
(`server/src/logics/reassignTaskPillars.ts`) und `suggestionsToContributions`
(`frontend/src/lib/pillar.ts`) müssen für dieselbe Eingabe dieselben Anteile liefern.

## Test-Pflege-Bedarf

Die bisherigen Erwartungswerte in `server/src/logics/pillarShares.test.ts`
(`toContributions — gleiche Verteilung wie das Frontend`) und
`frontend/src/lib/pillar.test.ts` (`describe('suggestionsToContributions', …)`, die Fälle mit einem
oder zwei Vorschlägen) beruhen auf der alten Regel (nicht vorgeschlagene Säulen bekommen strukturell
`SHARE_MIN`) und widersprechen AK7. Sie werden durch die neuen Erwartungswerte ersetzt.
