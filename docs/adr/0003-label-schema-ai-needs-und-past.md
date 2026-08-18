# ADR 0003: Label-Schema `ai:needs-*` (Trigger) + `ai:<Vergangenheitsform>` (Done)

- **Status:** akzeptiert (2026-08-18, Issue #851)
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

| Phase        | Trigger                                     | Bemerkung                                                                                           |
| ------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1 Analyse    | `ai:needs-analyse`                          | Erst-Triage zusätzlich auf `issues.opened`; Re-Triage = Label setzen (statt früher Label entfernen) |
| 2 UX-UI      | `ai:needs-ux-ui`                            | Nicht-UI-Tickets bekommen es nie → Phase natürlicher Skip                                           |
| 3 Spec       | `ai:needs-spec`                             |                                                                                                     |
| 4 Umsetzung  | `ai:needs-impl`                             |                                                                                                     |
| 5 Review     | `ai:needs-review`                           | unverändert                                                                                         |
| 6 Fixup      | `ai:needs-fixup`                            | war `ai:needs-changes`                                                                              |
| 7 Documenter | _(Event: `pull_request.closed` + `merged`)_ | auf gemergtem PR nicht label-triggerbar                                                             |

**Done-Labels `ai:<Vergangenheitsform>`** — jede erfolgreiche Phase setzt ihr Done-Label UND den
Trigger der Folgephase (der Motor der Kette): `ai:analysed`, `ai:reviewed`, `ai:documented`.
**Begründung:** Die 4 Done-Marker `ai:ux-reviewed`, `ai:specified`, `ai:implemented`, `ai:fixed`
waren tote Marker ohne Trigger-/Guard-Logik (Issue #873). Ihr Setzen feuerte 4 (Issue) bzw. 3 (PR)
No-Op-Workflow-Runs. Die verbleibenden 3 Labels tragen Last: `ai:analysed` (Erst-Triage-ABSENT-Guard),
`ai:reviewed` (Gate-Trigger), `ai:documented` (fail-closed Idempotenz-Invariante).

**Info-Labels ohne Trigger:** `ai:needs-human` (KI stoppt; PR/Issue-Kommentar mit **Warum** und
**was der Mensch konkret beitragen/entscheiden soll**), `ai:to-big-issue` (Aufgabe zu groß — reines
Signal, löst bewusst nichts automatisch aus), `ai:continued` (Soft-Abort-Marker).

**Entfallen:** `ai:spec-ready`, `ux:ready`, `ai:ready`, `ai:needs-changes`, `ai:ready-to-merge`,
`ai:analyzed` (US-Schreibweise), `ux:failed` (aufgegangen in `ai:needs-human`).

### Konsequenzen für Einzelmechaniken

- **Nicht-UI-Skip ohne Extra-Label:** `ux:ready` als Skip-Marker entfällt — die Analyse setzt bei
  Nicht-UI direkt `ai:needs-spec`, die UX-Phase wird schlicht nie getriggert.
- **Gate-Merge auf `ai:reviewed`:** `ai:reviewed` ist Done-Label UND Gate-Trigger (setzt bei 🟢 UND
  🔴 — die Review-Runde ist in beiden Fällen abgeschlossen). Damit das Gate nicht auf einem stale
  `ai:reviewed` vorzeitig mergt, prüft es zusätzlich die ABSENZ von `ai:needs-fixup`,
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
