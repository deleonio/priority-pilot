# Kosten-Baseline — Referenzlauf Ticket #912

- **Gemessen:** 2026-08-20 · Quelle: Workflow [`Kosten-Baseline`](../.github/workflows/cost-baseline.yml), [Lauf 32348989596](https://github.com/deleonio/priority-pilot/actions/runs/32348989596)
- **Ticket:** [#912](https://github.com/deleonio/priority-pilot/issues/912) — „Header-Toolbar: Avatar wieder ganz rechts positionieren", umgesetzt in [PR #926](https://github.com/deleonio/priority-pilot/pull/926)
- **Zweck:** die in [ADR 0004](adr/0004-analyse-getriebenes-routing.md) geforderte Messgrundlage („erst messen, dann umbauen")

Dies ist die erste vollständige Messung eines Tickets über alle Phasen. Sie deckt den
Zustand **nach** den Schritten 1–3 der Harness-Optimierung ab (label-getriebene Modellwahl,
angereicherter Analyse-Kontext, überspringbare Spec) und **vor** dem Zusammenlegen von Fixup
und Umsetzung ([ADR 0005](adr/0005-fixup-und-umsetzung-sind-eine-phase.md)).

## Zahlen

| Phase      | Läufe | Modell                           | Token in (inkl. Cache) | davon Cache-Write | davon Cache-Read |  Token out |  Kosten (USD) |
| ---------- | ----: | -------------------------------- | ---------------------: | ----------------: | ---------------: | ---------: | ------------: |
| analyse    |     2 | `glm-5.3`                        |              1.287.145 |                 0 |        1.162.560 |     19.198 |  _Fremdtarif_ |
| ux         |     2 | `glm-5-turbo`, `claude-sonnet-5` |              1.968.983 |            37.644 |        1.875.727 |      9.439 |  _Fremdtarif_ |
| spec       |     1 | `claude-sonnet-5`                |              4.095.063 |            89.237 |        4.005.730 |     27.669 |       $1.9517 |
| implement  |     1 | `claude-haiku-4-5-20251001`      |              1.631.191 |            36.380 |        1.594.517 |     10.598 |       $0.2582 |
| review     |     1 | `claude-haiku-4-5-20251001`      |                572.069 |            30.800 |          541.155 |     10.221 |       $0.1438 |
| documenter |     1 | `claude-haiku-4-5-20251001`      |                165.899 |            24.596 |          141.261 |      4.439 |       $0.0671 |
| **Summe**  | **8** |                                  |          **9.720.350** |       **218.657** |    **9.320.950** | **81.564** | **≥ $2.4208** |

Zeitraum: 2026-08-19T17:29:46Z bis 2026-08-20T03:02:37Z · Provider: `zai`, `claude`

**Die Kostenspalte ist unvollständig, nicht null.** Analyse und UX liefen (teilweise) über
`zai`; dort gelten Fremdtarife, und `cost` ist per Konstruktion `0` (siehe
[`.costs/SCHEMA.md`](../.costs/SCHEMA.md)). Die ausgewiesene Summe ist deshalb eine
**Untergrenze** über die Anthropic-Läufe. Die **Token-Zahlen sind vollständig** und für den
Vorher/Nachher-Vergleich die belastbarere Grösse.

## Was die Messung zeigt

### 1. Die Spec ist der mit Abstand teuerste Schritt

Von den messbaren $2.42 entfallen **$1.95 auf die Spec — rund 81 %.** Sie verbraucht ausserdem
42 % aller Eingabe-Token des Tickets. Der Grund ist die Modellwahl: Die Spec lief auf
`claude-sonnet-5`, während Umsetzung, Review und Dokumentation auf `claude-haiku-4-5` liefen.

Das ist der wichtigste Befund für die weitere Optimierung. Der Hebel aus Schritt 3
(überspringbare Spec) zielt genau hierauf — **bei diesem Ticket hat er nicht gegriffen**
(siehe unten).

### 2. Die label-getriebene Modellwahl funktioniert

Das Ticket trug `ai:model:haiku`. Umsetzung, Review und Dokumentation liefen tatsächlich alle
drei auf `claude-haiku-4-5-20251001` — zusammen $0.47 für die gesamte code-schreibende und
-prüfende Arbeit. Vor Schritt 1 wären das die Phasen-Defaults `opus` (Umsetzung, Review)
gewesen.

### 3. Fast alle Eingabe-Token sind Cache-Reads

9.320.950 von 9.720.350 Eingabe-Token (**96 %**) stammen aus dem Prompt-Cache und werden mit
etwa 0,1× abgerechnet. Ohne diesen Anteil läge die Rechnung um ein Vielfaches höher. Wer die
absolute Token-Zahl als Kostenmass liest, überschätzt die Kosten grob — die Aufteilung in der
Tabelle ist deshalb kein Beiwerk.

### 4. Analyse und UX liefen je zweimal

Das sind die Wiederholungen vom 2026-08-19 (das Ticket wurde nach Nutzer-Feedback neu
zugeschnitten), nicht ein Fehler der Pipeline. Für eine Baseline ist das die richtige
Zählweise: gemessen wird, was das Ticket **insgesamt** gekostet hat, nicht der Idealpfad.

### 5. Der Durchlauf brauchte keine Nacharbeit

Der Review war beim **ersten Durchgang grün** — es gibt keinen `fixup`-Eintrag. Genau der
Schleifen-Aufwand, den Hypothese 4 aus ADR 0004 als Kostenrisiko benennt, ist hier nicht
angefallen. Ein einzelnes Ticket belegt die Hypothese damit nicht, widerspricht ihr aber auch
nicht.

## Korrektur einer früheren Einschätzung

In der Zwischenauswertung dieses Laufs hatte ich aus dem Branch-Namen
`feat/issue-912-avatar-rechts` geschlossen, die **Spec sei übersprungen** worden und die
Umsetzung sei im Direkt-Modus gelaufen. **Das war falsch.** Die Messung zeigt einen
Spec-Lauf mit 4,1 Mio. Eingabe-Token auf `claude-sonnet-5`.

Der Fehler lag in der Methode, nicht im Detail: Ein Branch-Namensmuster ist kein Beleg für
einen Ausführungspfad. Die Kostendaten sind es — und sie standen zu dem Zeitpunkt bereits zur
Verfügung, nur nicht in lesbarer Form. Genau deshalb gibt es jetzt den Aggregator.

Praktische Folge: Die Spec-Skip-Logik aus Schritt 3 hat bei diesem Ticket **nicht** gegriffen.
Das ist erklärbar — das Ticket fasst `frontend/src/App.tsx` und `frontend/src/app.css` an,
also Anwendungscode, und für Anwendungscode ist der Skip in `resolve-spec-skip.sh` bewusst
gesperrt (der Test-Carve-out aus [ADR 0001](adr/0001-github-workflows-bleiben-ungetestet.md)
gilt nur für Workflows, Skripte, Config und Markdown). Der Skip verhielt sich also korrekt.

## Wie diese Messung zu wiederholen ist

```
# In GitHub: Actions → „Kosten-Baseline" → Run workflow → Ticket-Nummer eintragen
# Lokal gegen entpackte Artefakte:
node .github/scripts/cost-aggregate.ts --issue <n> --dir /tmp/costs
```

Die Datensätze liegen als Artefakte `claude-costs-<phase>-issue-<n>-<run_id>` an den
Phasen-Läufen — **90 Tage Aufbewahrung**. Wer die Baseline eines Tickets dauerhaft braucht,
muss sie vor Ablauf hierher übernehmen; danach ist sie nicht mehr rekonstruierbar.

## Offen

- **Ein Ticket ist keine Stichprobe.** Die Hypothesen aus ADR 0004 (günstige Modelle tragen
  die Folgeschritte; Review-Schleifen fressen die Ersparnis nicht auf) brauchen mehrere
  Tickets unterschiedlicher Aufwandsklasse, bevor sie als belegt gelten.
- **Die Analyse-Kosten sind nicht messbar,** solange sie über `zai` läuft. Ein Vergleich
  „starke Analyse vorne spart hinten" ist damit derzeit nur auf der Token-Achse führbar.
- **Kein Vorher-Wert.** Diese Messung ist die erste ihrer Art; ein Vergleich gegen die
  Pipeline vor Schritt 1 existiert nicht und ist nicht mehr herstellbar. Sie ist damit die
  Basis für künftige Vergleiche, nicht selbst ein Beleg für eine Ersparnis.
