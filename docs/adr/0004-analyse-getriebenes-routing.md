# ADR 0004 — Analyse-getriebenes Routing statt starrer 7-Phasen-Kette

- **Status:** Accepted
- **Datum:** 2026-08-19
- **Entscheidungsquelle:** Konzept „Harness-Optimierung" (User-Direktive); umgesetzt in
  [#911](https://github.com/deleonio/priority-pilot/pull/911) (Kosten-Baseline + Modellwahl),
  [#913](https://github.com/deleonio/priority-pilot/pull/913) (Analyse-Kontext),
  [#914](https://github.com/deleonio/priority-pilot/pull/914) (überspringbare Spec)
- **Schreibt fort:** [ADR 0002](0002-pipeline-7-phasen-ux-vor-spec.md) (Phasenkette),
  [ADR 0003](0003-label-schema-ai-needs-und-past.md) (Label-Schema)

## Kontext

Die Pipeline aus ADR 0002 führt jedes Ticket durch dieselben sieben Phasen, jede mit einem
statisch je Phase gesetzten Modell (`vars.CLAUDE_MODEL_*`). Im Realbetrieb erzeugte das vier
Probleme:

1. **Eskalation bei unpräzisen Tickets.** Ist die Beschreibung ungenau, macht der Agent
   irgendwas — und die Unschärfe pflanzt sich durch alle Folgeschritte fort.
2. **Redundante Analyse.** Jeder Schritt erschloss sich den Kontext neu, statt auf einer bereits
   erfolgten Analyse aufzusetzen. Starke Modelle liefen mehrfach für dieselbe Erkenntnis.
3. **Unkalkulierbare Review-Schleifen.** Findings erzeugen zusätzliche Durchläufe mit schwer
   vorhersagbaren Kosten.
4. **Multiplikatives Kostenrisiko.** Viele kleine Tickets × sieben Phasen = viele parallele
   Agenten mit jeweils voller Pipeline. Eine triviale Subtask lief auf demselben `opus` wie ein
   Architektur-Ticket.

Erschwerend: **Es gab keine Messgrundlage.** `.github/scripts/cost-record.ts` lag fertig im Repo,
war aber in keinem Workflow verdrahtet; `.costs/` enthielt nur `SCHEMA.md`. Aussagen über
Ersparnis wären Behauptungen geblieben.

## Entscheidung

**Rechenleistung vorne konzentrieren statt in Schleifen verteilen.** Eine starke Analysephase
erzeugt vollständig durchdachte Subtasks; alle Folgeschritte arbeiten auf diesem angereicherten
Kontext und laufen deshalb mit günstigeren Modellen. Ein Schritt läuft nur, wenn er für die
konkrete Subtask einen Beitrag leistet — diese Entscheidung trifft ausschließlich die Analyse
und dokumentiert sie am Ticket.

Vier Einzelentscheidungen setzen das um:

### 1. Die Analyse ist die zentrale Instanz und läuft auf `fable`

Sie zerlegt, reichert an und routet. Ihr Ergebnis steht strukturiert im `KI-ANALYSE`-Block des
Issue-Bodys: `UI-Bezug`, `Spec nötig`, `Aufwandsklasse`, `Betroffene Dateien`, `Randbedingungen`,
`Erwartetes Ergebnis`. **Akzeptanzkriterium:** Eine Subtask ist so beschrieben, dass ein günstiges
Modell sie ohne Rückgriff auf ein starkes Modell umsetzen kann.

Bei Uneindeutigkeit wird nicht geraten: Die Analyse setzt `ai:needs-human` mit einem Kommentar,
der **was** zu entscheiden ist, **worauf** es sich bezieht und **welche Optionen** bestehen
benennt. „Bitte prüfen" erfüllt das nicht.

### 2. Die Klassifikation steuert das Modell — über ein Label, nicht über eine Variable

Die Analyse stuft **je Subtask** ein und setzt genau ein Label `ai:model:haiku|sonnet|opus`. Die
Folgephasen lesen es rein statisch aus (`resolve-model-label.sh`) und starten mit dem passenden
`--model`. Kein LLM-Aufruf, kein Freitext-Parsing.

Ist das Label **mehrdeutig**, bricht der Start ab und das Ticket wird mit `ai:needs-human` beim
Menschen geparkt. Fehlt es ganz, entscheidet die **Herkunft** (fortgeschrieben mit
[PR #916](https://github.com/deleonio/priority-pilot/pull/916)):

| Lage                                                                       | Verhalten                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Analyse lief nachweislich (`ai:analysed` am Objekt oder verknüpften Issue) | **Parken** — sie schuldete ein Label, das Fehlen ist ein Defekt     |
| Keine Analyse-Herkunft (Harness-PR, manueller PR, Renovate)                | **Kein Parken** — Phasen-Default gilt, als Notice sichtbar gemacht  |
| Herkunft nicht bestimmbar (API nicht lesbar)                               | **Parken** — „unbestimmbar" ist nicht dasselbe wie „keine Herkunft" |

Die ursprüngliche Fassung parkte pauschal jeden Lauf ohne Label. Das war falsch: Nicht jeder PR
stammt aus einer Analyse — Harness-, Fremd- und Renovate-PRs haben nie ein Issue durchlaufen, das
ein Label hätte setzen können, und parkten dadurch dauerhaft. Der Fallback ist **kein stilles
Raten**, sondern der unveränderte Zustand vor dieser Entscheidung, für einen Pfad, den das Routing
nicht abdeckt.

Wo das Routing zuständig ist, bleibt die Auflösung als einzige im Repo **fail-closed** — inklusive
jeder unlesbaren API-Antwort.

Ab der zweiten Review-Runde am selben PR wird eine Stufe hochgesetzt (`haiku` → `sonnet` →
`opus`).

### 3. Die Spec-Phase ist überspringbar — aber nur, wo sie ihren Vertrag nicht liefern kann

Die Spec liefert **rote Tests** als Vertrag zwischen Analyse und Umsetzung. Für Tickets ohne
Anwendungscode (`server/src/**`, `frontend/src/**`, `frontend/e2e/**`) kann sie das per Definition
nicht: Der Test-Carve-out aus [ADR 0001](0001-github-workflows-bleiben-ungetestet.md) verbietet
Tests auf Workflows, Skripte, Config und Markdown. Übrig bliebe ein Spec-Dokument.

Genau dort — und nur dort — entfällt die Phase; die Analyse setzt direkt `ai:needs-impl`, die
Umsetzung legt Branch **und** PR selbst an (Direkt-Modus).

**TDD bleibt die Regel.** Berührt ein Ticket Anwendungscode, läuft die Spec, auch bei kleinen
Änderungen. `needs_ux ⇒ needs_spec` ist erzwungen: Ein UX-Entwurf ohne Spezifikation ist nicht
anschlussfähig.

### 4. Erst messen, dann umbauen

Die Token-/Kostenerfassung wurde **vor** allen anderen Änderungen verdrahtet, weil der Vorher-Wert
nach dem Umbau nicht mehr rekonstruierbar ist. Sie liest aus dem Claude-Code-Sitzungstranskript;
der `claude`-Aufruf selbst bleibt unangetastet.

## Begründung

- **Prozessisolation ist der Grund, warum das funktioniert.** Jede Phase ist ein eigener
  `claude -p`-Prozess mit eigenem Checkout und frischem Kontext. Nur deshalb kann eine `fable`-
  Analyse einmal laufen und anschließend _n_ `haiku`-Läufe folgen, ohne dass die teure Session
  resident bleibt.
- **Ein Label ist der einzig gangbare Träger der Modellwahl.** `--model` und `ANTHROPIC_MODEL`
  gelten nur für die Session, mit der sie gestartet werden; ein Wechsel mitten im
  nicht-interaktiven Lauf ist nicht möglich. Die Entscheidung muss **vor** dem Start feststehen
  und ohne LLM-Aufruf lesbar sein. Ein Label ist trivial abfragbar, am Ticket sichtbar, manuell
  überschreibbar, funktioniert an Issues **und** PRs und braucht keine zusätzliche Zustandshaltung.
- **Kein stilles Raten, in keiner Richtung.** Ein geratenes Modell liefe auf dem
  `.claude/settings.json`-Default, also potenziell dem teuersten. Eine geratene Spec-Entscheidung
  kostet den Testvertrag. Beide Gates brechen deshalb lieber ab, als anzunehmen — das ist das
  Sicherheitsventil gegen genau das Verhalten, das diesen Umbau ausgelöst hat.
- **Selbstauskünfte werden gegengeprüft.** `„Spec nötig: nein"` ist eine Aussage des LLM über sich
  selbst. `resolve-spec-skip.sh` prüft sie gegen die im selben Block deklarierten
  `Betroffene Dateien`: Zeigt auch nur ein Pfad in Anwendungscode, läuft die Spec trotzdem. Der
  Skip ist damit technisch begrenzt, nicht nur per Prompt — sonst würde er zum bequemen Default.
- **Fehleinstufungen nach unten sind teurer als nach oben.** Eine als `haiku` eingestufte schwere
  Subtask produziert Review-Schleifen, die den Ersparnisvorteil auffressen. Deshalb die
  Auto-Eskalation und die Prompt-Regel „im Zweifel eine Stufe höher".

## Verworfene Alternative: ein „Claude Team" mit Subagent-Rollen

Der naheliegende Gegenentwurf — die Phasen als Subagent-Rollen in **einem** Prozess statt als
getrennte Workflows — wurde geprüft und verworfen. Er ist für dieses Harness **teurer** und
technisch nicht tragfähig:

- **Er kehrt die Kostenlogik um.** Subagents leben in einem `claude -p`-Prozess: Die Elternsession
  bleibt über den gesamten Lauf resident, und jedes Subagent-Ergebnis fließt in ihren Kontext
  zurück. Die `fable`-Session orchestrierte dann jeden `haiku`-Schritt zu `fable`-Preisen, mit
  monoton wachsendem Kontext. Das ist strikt schlechter als der Ist-Zustand.
- **Pro-Subtask-Modellwahl ist damit unmöglich.** `.claude/agents/*.md`-Frontmatter `model:` ist
  statisch pro Rolle; `CLAUDE_CODE_SUBAGENT_MODEL` überschreibt _alle_ Subagents gleichzeitig.
  Es gibt keinen Mechanismus, der „diese Subtask `haiku`, jene `opus`" zur Laufzeit ausdrückt.
- **Der Hard Stop braucht die Prozessgrenze.** `ai:needs-human` parkt ein Ticket tagelang. Ein
  Prozess kann nicht warten — Actions-Jobs sind endlich (die Phasen arbeiten zusätzlich mit
  Soft-Deadlines von 600–840 s).
- **Serialisierung, Review und Spec-Vertrag sind an GitHub gebunden.** `concurrency`-Gruppen mit
  `queue: max`, der Review auf dem PR nach CI und der Draft-PR als Artefakt zwischen zwei Läufen
  lassen sich innerhalb eines Prozesses nicht nachbauen.

**Eng begrenzte Ausnahme:** Innerhalb der Analysephase sind Subagents sinnvoll — für das
leseintensive Fan-out, damit der `fable`-Elternkontext schlank bleibt. Das ist der einzige Ort, an
dem sie im Sinne des Ziels Token _sparen_ statt sie zu vervielfachen.

## Abgrenzung — was dieses ADR NICHT entscheidet

- **Zusammenlegung von Fixup und Umsetzung.** Inhaltlich sind beide nahezu deckungsgleich (eine
  Anforderung entgegennehmen und im Code umsetzen; der Unterschied ist die Kontextquelle). Die
  Zusammenlegung bleibt **offen**: Sie triggert auf verschiedenen Event-Objekten (`issues` vs.
  `pull_request`), verlangt eine Neufassung des „Fixup gewinnt"-Guards in `check-phase-label.sh`
  und liegt in einem laut ADR 0001 ungetesteten Bereich — bei **null Token-Ersparnis**. Erst nach
  einem belegten Referenzlauf neu zu bewerten.
- **GLM-Mapping über `ANTHROPIC_DEFAULT_*_MODEL`.** Das Ausgangskonzept sah dafür
  Environment-Variablen vor. Das Repo löst Modell-Aliase für `zai`/`openrouter` bereits über einen
  `jq`-Patch auf `settings.local.json` auf (`setup-claude/action.yml`), gespeist aus
  `vars.CLAUDE_CODE_SETTINGS_LOCAL_*`. Der bestehende Weg wird beibehalten; die Env-Variante wäre
  ein zweiter paralleler Mechanismus.
- **Effort-Level für die Analyse** (`--effort xhigh`/`max`) ist **offen** — vor einer Entscheidung
  gegen die aktuelle Claude-Code-CLI und die eingesetzten Provider zu verifizieren.

## Konsequenzen

- **Die Analyse wird teurer und langsamer.** Sie liest jetzt Code, um Kontext anzureichern. Das
  ist beabsichtigt: Der Aufwand fällt einmal an statt in jeder Folgephase erneut.
- **Ein analysiertes Ticket ohne `ai:model:*` läuft nicht.** Das ist der Preis dafür, dass kein
  Lauf mehr auf einem geratenen Modell startet. Bestandstickets, die `ai:analysed` tragen, brauchen
  ein Label (manuell oder per Re-Triage), sonst parken sie beim Menschen. Läufe **ohne**
  Analyse-Herkunft sind davon ausgenommen und nutzen den Phasen-Default (s. Entscheidung 2) —
  andernfalls stünde jeder Harness- und Renovate-PR dauerhaft still.
- **`ai:model:*` ist Konfiguration, kein Trigger.** Es steht bewusst **nicht** in der
  `MANAGED`-Liste von `label-transition.sh`: Eine Transition ersetzt diesen Bestand vollständig,
  und die Modellwahl muss den Review-Fix-Zyklus überleben. Diese Invariante ist durch Tests
  abgesichert.
- **Die Phasenkette aus ADR 0002 ist keine feste Reihenfolge mehr, sondern ein Routing.** Der
  Weg Analyse → UX → Spec → Umsetzung bleibt der Regelfall; die Analyse darf UX und Spec
  überspringen, wenn sie nichts beitragen. Die Serialisierungs-Begründung von ADR 0002 (UX vor
  Spec, Race-Freiheit) bleibt unberührt.
- **Testbarkeit trotz ADR 0001.** Die Entscheidungslogik liegt bewusst in Shell-Skripten unter
  `.github/scripts/` (`resolve-model-label.sh`, `resolve-spec-skip.sh`) statt inline in den
  Workflows. Skripte sind lokal ausführbar und mit `gh`-Stubs testbar — dieselbe Bauform wie
  `check-phase-label.sh`. Das umgeht ADR 0001 nicht, sondern nutzt seine Grenze: Getestet wird
  die Entscheidungslogik, nicht die YAML-Verdrahtung.
- **Die Hypothesen sind noch nicht belegt.** Ob eine starke Analyse günstige Modelle in den
  Folgeschritten tatsächlich trägt, ist am Referenzticket zu messen — die Baseline dafür steht
  jetzt. Bis dahin ist dieses ADR eine begründete Wette, keine gemessene Wahrheit.

## Fortschreibung von ADR 0002 und ADR 0003

**ADR 0002 (7 Phasen):** Die Phasenkette bleibt, wird aber bedingt. UX und Spec sind formell
optional; die Analyse entscheidet je Subtask. `needs_ux ⇒ needs_spec` bleibt erzwungen — an zwei
Stellen: in `resolve-spec-skip.sh` und im `ux-ready`-Pfad von `02-claude-ux.yml`, der immer
`ai:needs-spec` setzt.

**ADR 0003 (Label-Schema):** Die Familie **`ai:model:*`** kommt als dritte Kategorie hinzu —
weder Trigger (`ai:needs-*`) noch Done-Marker (`ai:<Vergangenheitsform>`), sondern
**Konfiguration am Ticket**:

| Label             | Bedeutung                       | Gesetzt von                              | Konsumiert |
| ----------------- | ------------------------------- | ---------------------------------------- | ---------- |
| `ai:model:haiku`  | Folgephasen laufen auf `haiku`  | Analyse (je Subtask), Mensch, Eskalation | nie        |
| `ai:model:sonnet` | Folgephasen laufen auf `sonnet` | dito                                     | nie        |
| `ai:model:opus`   | Folgephasen laufen auf `opus`   | dito                                     | nie        |

Genau eines muss gesetzt sein; keines oder mehrere brechen den Start ab. Das Label wird **nie**
konsumiert und überlebt alle Phasen-Transitions.

Ergänzend zu ADR 0003: **`ai:needs-impl` kann jetzt auch von der Analyse gesetzt werden** (wenn
die Spec übersprungen wird), nicht nur von der Spec-Phase.
