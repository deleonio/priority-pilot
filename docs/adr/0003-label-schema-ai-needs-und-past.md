# ADR 0003: Label-Schema `ai:needs-*` (Trigger) + `ai:<Vergangenheitsform>` (Done)

- **Status:** akzeptiert (2026-08-18, Issue #851); Done-Marker verschlankt (2026-08-18, Issue #873); Re-Triage zusätzlich via unlabeled (2026-08-18, s. Fortschreibung unten); `issues.opened` als Einstieg gestrichen (2026-08-18, s. Fortschreibung 2026-08-18b); Label-Familie `ai:model:*` ergänzt (2026-08-19, s. Fortschreibung 2026-08-19)
- **Kontext:** [docs/pipeline-flow.md](../pipeline-flow.md), [ADR 0002](0002-pipeline-7-phasen-ux-vor-spec.md)

## Kontext und Problem

Die Label-Kette der 7-Phasen-Pipeline war historisch gewachsen und inkonsistent:

1. **Gemischte Trigger-Muster:** Phasen triggerten auf `ai:spec-ready`, `ux:ready`, `ai:ready`,
   `ai:needs-review`, `ai:needs-changes` — kein erkennbares Schema. Wer Phase N startet, musste
   drei Dokumente konsultieren.
2. **Trigger- und Outcome-Semantik vermischt:** `ai:ready-to-merge` war gleichzeitig Review-Ergebnis
   UND Gate-Trigger; `ux:ready` war Skip-Marker UND Spec-Trigger; `ai:analyzed` war Vorbedingung,
   die per _Entfernen_ re-triggerte (unlabeled-Event).
3. **Races durch Koexistenz:** Review und `ai:needs-changes` konnten koexistieren (Autolabeler-Race);
   der Review-Precheck hatte keine ABSENT-Bedingung und lief dann trotzdem.
4. **Keine Aussage über abgeschlossene Phasen:** Ein Issue zeigte `ai:spec-ready`, aber ob die
   Spec wirklich durchgelaufen war, sagte das Label nicht — Trigger und Done waren dasselbe Label.

## Entscheidung

Vereinheitlichung auf **zwei orthogonale Label-Familien**:

**Trigger-Labels `ai:needs-*`** — jede Phase reagiert auf GENAU EIN Startlabel und konsumiert es
(Entfernen in der eigenen Post-Assertion):

| Phase        | Trigger                                     | Bemerkung                                                                                                                           |
| ------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1 Analyse    | `ai:needs-analyse`                          | Einziger Einstieg (kein `issues.opened` mehr, s. Fortschreibung 2026-08-18b); Re-Triage = Label setzen oder `ai:analysed` entfernen |
| 2 UX-UI      | `ai:needs-ux-ui`                            | Nicht-UI-Tickets bekommen es nie → Phase natürlicher Skip                                                                           |
| 3 Spec       | `ai:needs-spec`                             |                                                                                                                                     |
| 4 Umsetzung  | `ai:needs-impl`                             |                                                                                                                                     |
| 5 Review     | `ai:needs-review`                           | unverändert                                                                                                                         |
| 6 Fixup      | `ai:needs-fixup`                            | war `ai:needs-changes`                                                                                                              |
| 7 Documenter | _(Event: `pull_request.closed` + `merged`)_ | auf gemergtem PR nicht label-triggerbar                                                                                             |

**Done-Labels `ai:<Vergangenheitsform>`** — die erfolgreiche Phase setzt den Trigger der
Folgephase (der Motor der Kette) plus ein Done-Label, wo Logik es liest: `ai:analysed`,
`ai:reviewed`, `ai:documented` (Umfang siehe Fortschreibung #873 unten).

**Info-Labels ohne Trigger:** `ai:needs-human` (KI stoppt; PR/Issue-Kommentar mit **Warum** und
**was der Mensch konkret beitragen/entscheiden soll**), `ai:to-big-issue` (Aufgabe zu groß — reines
Signal, löst bewusst nichts automatisch aus), `ai:continued` (Soft-Abort-Marker).

**Entfallen:** `ai:spec-ready`, `ux:ready`, `ai:ready`, `ai:needs-changes`, `ai:ready-to-merge`,
`ai:analyzed` (US-Schreibweise), `ux:failed` (aufgegangen in `ai:needs-human`).

### Konsequenzen für Einzelmechaniken

- **Nicht-UI-Skip ohne Extra-Label:** `ux:ready` als Skip-Marker entfällt — die Analyse setzt bei
  Nicht-UI direkt `ai:needs-spec`, die UX-Phase wird schlicht nie getriggert.
- **Gate-Merge auf `ai:reviewed`:** `ai:reviewed` ist Done-Label UND Gate-Trigger (seit #873 bei 🟢
  und needs-human; bei 🔴 nur `ai:needs-fixup` — s. Fortschreibung). Damit das Gate nicht auf einem
  stale `ai:reviewed` vorzeitig mergt, prüft es zusätzlich die ABSENZ von `ai:needs-fixup`,
  `ai:needs-review` und `ai:needs-human`; der Fixup räumt `ai:reviewed` beim Konsum von
  `ai:needs-fixup` ab. Das schließt die ursprünglich beobachtete Race-Klasse (Aktion trotz
  ausstehendem Gegen-Label) systematisch ab.
- **Re-Triage via labeled statt unlabeled:** `issue-unblock.yml` setzt `ai:needs-analyse` (statt
  `ai:analyzed` zu entfernen). Symmetrisch zu allen anderen Phasen-Triggern.
- **VERDICT-Tokens:** Review-Verdicts heißen `reviewed`/`needs-fixup`/`needs-human` (vorher
  `ready-to-merge`/`needs-changes`) — Prompt-Vokabular und Labels verwenden dieselben Namen.

## Alternativen (verworfen)

- **Nur Rename, Semantik belieben** (`ai:ready-to-merge` → anders benennen, aber clean-only):
  wäre minimaler, ließe aber Trigger/Outcome-Vermischung und die fehlenden Done-Marker bestehen.
- **ABSENT-Guards im Review-Precheck statt Schema-Umbau:** hätte den Einzelfall (Review trotz
  `ai:needs-changes`) geflickt, nicht die Ursache (inkonsistentes Schema mit Koexistenz-Races).
- **Kurzform-Done-Labels (`ai:specd`, `ai:impled`):** kein echtes Englisch, schlechter lesbar.

## Konsequenzen

- **Positiv:** Ein Schema für alle Phasen (Trigger = `ai:needs-*`, konsumiert; Done = Vergangenheitsform);
  Issue-Label zeigen den Phasenfortschritt direkt; Nicht-UI-Skip ohne Zusatzlabel; Gate hardening
  gegen Stale-`ai:reviewed`.
- **Negativ:** Einmaliger Migrationsaufwand — offene Issues/PRs mit alten Labels müssen nach dem
  Merge manuell überführt werden (bewusst out of scope dieses PRs); historische `docs/spec/*.md`
  erwähnen alte Namen (kosmetisch).
- **Neutral:** `ai:to-big-issue` bleibt bewusst info-only (Signal an den Menschen, kein Auto-Flow);
  `ai:needs-human`-Kommentare folgen dem Format Warum + konkrete Handlungsoptionen.

## Fortschreibung 2026-08-18 (Issue #873): Done-Marker verschlankt

Der ursprüngliche Satz von sieben Done-Labels erwies sich im Betrieb als zu schwer: GitHub
Actions kann Label-Namen bei `issues:`-/`pull_request:`-Triggern nicht im `on:`-Block filtern —
jedes Label-Add startet bis zu 4 Issue- bzw. 3 PR-Workflows als No-Op. Vier Done-Marker
(`ai:ux-reviewed`, `ai:specified`, `ai:implemented`, `ai:fixed`) wurden von keiner Logik gelesen
und sind gestrichen; der Fortschritt steht im aktiven `ai:needs-*`-Label und in der Run-History.
Die übrigen drei tragen Last und bleiben: `ai:analysed` (Konsumiert-Check des unlabeled-
Re-Triage-Wegs + Parkplatz wartender Nachfolger im issue-unblock), `ai:reviewed`
(Gate-Trigger + Merge-Vorbedingung; wird beim 🔴-Verdict nicht mehr gesetzt, damit das Gate weder
grundlos läuft noch vor dem `ai:needs-fixup`-Add lesen kann), `ai:documented` (fail-closed
Idempotenz-Invariante des Documenters + Sweep-Kriterium).

Zusätzlich verbindliche Setz-Regeln (dokumentiert in docs/pipeline-flow.md): Label-Writes nur im
Post-Assertion-Step am Job-Ende, Removes zuerst, Done-Labels idempotent, Trigger der Folgephase
als letzter Write. Verworfen: ein zentraler Router-Workflow auf `repository_dispatch` — die
verbleibenden No-Ops sind Sekunden-Prechecks, der Umbau aller Phasen-Trigger stünde in keinem
Verhältnis.

## Fortschreibung 2026-08-18: Re-Triage zusätzlich via unlabeled

Das Entfernen von `ai:analysed` durch den Menschen ist als zweiter Re-Triage-Weg zurück: Workflow
01 hört zusätzlich auf `issues.unlabeled` (precheck-if gefiltert auf `ai:analysed`); der
Laufzeit-Guard ist der bestehende ABSENT-Pfad — das Label muss bis zum Job-Start abwesend bleiben,
sonst gilt der Trigger als konsumiert. `ai:needs-analyse` bleibt der Konsum- und Automatisierungsweg
(`issue-unblock` unberührt); die Trigger-Tabelle oben gilt weiterhin. Trade-off: Da GitHub
Label-Namen nicht im `on:`-Block filtern kann, startet 01 nun bei jedem Issue-`unlabeled`-Event
einen sofort übersprungenen Precheck-Run (v. a. durch die eigenen Konsum-Removes) — gleiche Klasse
wie die bekannten labeled-No-Ops („Sekunden-Prechecks", oben). Andere Phasen bleiben beim reinen
`ai:needs-*`-Schema (Nutzerentscheidung: nur die Analyse).

## Fortschreibung 2026-08-18b: `issues.opened` als Einstieg gestrichen

Ein neu geöffnetes Issue stößt die Analyse NICHT mehr an. Workflow 01 hört nur noch auf
`issues` [labeled/unlabeled]; der Einstieg in die Pipeline ist ausschließlich das manuell
gesetzte `ai:needs-analyse`. Grund (Nutzerentscheidung): kontrollierte Steuerung, welche
Tickets wann in den Flow gehen — Sammel-Anlage, Entwürfe, Rohnotizen und Fremd-Reports sollen
liegen bleiben, bis sie freigegeben werden, statt sofort LLM-Budget und eine Kette von
Folge-Workflows auszulösen.

Folgen:

- Der `author_association`-Guard (OWNER/MEMBER/COLLABORATOR) im precheck-`if` entfällt
  ersatzlos — er schützte nur den `opened`-Pfad. Labels kann ohnehin nur setzen, wer
  Schreib-/Triage-Rechte am Repo hat; die Zugangskontrolle ist damit strenger als vorher.
- Der ABSENT-Guard auf `ai:analysed` verliert seine Rolle als Erst-Triage-Schutz für
  vorgelabelte Sub-Issues (es gibt keine automatische Erst-Triage mehr) und ist jetzt
  ausschließlich der Konsumiert-Check des unlabeled-Wegs (Fortschreibung 2026-08-18).
  Die Logik in `check-phase-label.sh` bleibt unverändert.
- `issue-unblock.yml` ist unberührt: Es setzt `ai:needs-analyse` per App-Token und arbeitet
  damit weiterhin über den einzigen verbliebenen Einstieg.
- Preis: Tickets brauchen eine bewusste menschliche Freigabe. Wird das Label vergessen,
  passiert nichts — bewusst, das ist genau der gewünschte Kontrollpunkt.

## Fortschreibung 2026-08-18: Atomare Label-Transitionen für die PR-Phasen

Die Setz-Regeln oben („Removes zuerst, letzter Write") galten bislang für alle Phasen. Für die
PR-Phasen (Review, Fixup, Gate-Merge, Conflict-Scan, Autolabeler) gelten sie ab heute nicht mehr
einzeln — sie sind in `.github/scripts/label-transition.sh` aufgegangen: EIN API-Call (PUT
/issues/N/labels) ersetzt den gesamten Pipeline-Bestand (`ai:needs-review`, `ai:needs-fixup`,
`ai:reviewed`, `ai:needs-human`), Nicht-Pipeline-Labels bleiben unberührt. Auslöser war PR #890:
Einzel-Writes erzeugen Zwischenzustände (0 oder 2 Trigger-Labels) mit Minuten-Fenstern, in denen
wartende Läufe falsch starten — bis hin zu Review parallel zum Fixup —, und der Conflict-Scan
verletzte die Invariante „ai:needs-fixup ⇒ ai:needs-review entfernen" schlicht durch Vergessen.
Drei Ergänzungen: Start-Konsum (Review/Fixup entfernen ihr Trigger-Label direkt nach dem Setup,
guarded mit `--expect <Trigger>`), Final-Write mit Pre-State-Guard (`--expect none` verwirft
Stale-Writes, wenn zwischenzeitlich ein anderer Akteur geschrieben hat) und der Review-Precheck
verlangt zusätzlich die Abwesenheit von `ai:needs-fixup` (Doppel-Armung → Fixup gewinnt).
Vier Ergänzungen (PR #903): Guard 3 (Menschen-Parker) in `label-transition.sh` verhindert, dass
jede Transition ein klebendes `ai:needs-human` ersatzlos entfernt — nur der Mensch (UI) darf
es entfernen. Auslöser: Gate wischte Fixup-Verdict `ai:needs-human` kollateral → Endlosschleife.
Start-Konsum in 05/06 läuft seither nur nach frisch bestandener Phasen-Prüfung im selben Schritt. Die
Issue-Phasen (01–04) behalten bewusst das alte Modell — ihre Labels sind Einstiegs-Trigger ohne
Review↔Fixup-Loop, und der Umbau stünde in keinem Verhältnis (gleiche Abwägung wie beim
verworfenen Router). Verdict-Kanal: PR-LLM-Phasen schreiben ihr Verdict nach `/tmp/claude-verdict`
(das Log-Grep bleibt Übergangs-Fallback).

## Fortschreibung 2026-08-19 — dritte Label-Familie `ai:model:*`

Mit [ADR 0004](0004-analyse-getriebenes-routing.md) kommt eine dritte Kategorie hinzu, die weder
Trigger noch Done-Marker ist: **`ai:model:haiku|sonnet|opus`** ist **Konfiguration am Ticket** und
bestimmt, mit welchem Modell die Folgephasen starten.

Sie durchbricht bewusst zwei Regeln dieses ADR:

- **Sie wird nie konsumiert.** Trigger-Labels entfernt die Phase, die auf sie reagiert; `ai:model:*`
  bleibt kleben, weil es bei JEDEM erneuten Start neu gelesen werden muss — auch im
  Review↔Fixup-Zyklus.
- **Sie steht nicht in der `MANAGED`-Liste von `label-transition.sh`.** Eine Transition ersetzt
  diesen Bestand vollständig in einem API-Call; stünde die Modellwahl darin, wischte sie die erste
  Phasen-Transition weg — ausgerechnet dort, wo sie gebraucht wird. Diese Invariante ist in
  `label-transition.test.ts` abgesichert.

Genau eines der drei muss gesetzt sein. Keines oder mehrere brechen den Start ab und setzen
`ai:needs-human` mit Begründung (`resolve-model-label.sh`, fail-closed) — bewusst nicht still das
erste oder das teuerste nehmen.

Zusätzlich: **`ai:needs-impl` wird jetzt auch von der Analyse gesetzt**, nicht nur von der
Spec-Phase — nämlich dann, wenn die Spec übersprungen wird (ADR 0004, Entscheidung 3). Die Analyse
räumt es im Remove-vor-Add-Block entsprechend auch wieder ab, damit ein Re-Triage einen alten
Direkt-Trigger nicht kleben lässt.
