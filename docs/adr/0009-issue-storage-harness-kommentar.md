# ADR 0009 — Issue-Storage: Phasen-Ausgaben wohnen im Harness-Kommentar

- **Status:** Accepted (2026-08-30) — Fortschreibung von [ADR 0007](0007-issue-storage-harness-branch.md) (Issue-Storage im Repo) um die Issue-Seite
- **Datum:** 2026-08-30
- **Kontext:** ADR 0007 (Harness-Branch), ADR 0004 (analysegetriebenes Routing), Workflow `0/6 Issue-Validator`

## Kontext

Die Analyse (Triage) schrieb ihren KI-ANALYSE-Block samt `ai-phase-routing`-Tabelle per
`gh issue edit` in die **Issue-Beschreibung**, die UX-Beratung ihren KI-UX-Block ebenso.
Der Issue-Validator (`00-issue-quality-check.yml`) feuert auf **jedes** Body-Edit
(`issues: [opened, edited]`) — sein Skip griff nur, wenn der Analyse-Block schon im Body
stand. In dem Fenster zwischen Copyedit-Edit und Block-Write (und bei jedem Strukturbruch)
lief die volle Güteprüfung auf dem phasen-geschriebenen Body: **rot**, Label
`ticket:incomplete`, Feedback-Kommentar. Der Post-Check der Triage reagierte auf
Strukturbruch mit `ai:needs-human` — UX und Spec standen wiederholt still (beobachtet an
#1121: alle vier Template-Überschriften durch den Analyse-Rewrite zerstört).

Dazu ein konzeptioneller Bruch: Der Body ist das **vom Menschen validierte Eingabeartefakt**
(Vorab-Check prüft genau ihn), wurde aber von der Pipeline als Speicher für ihre eigenen
Ausgaben zweckentfremdet — zwei Schreiber, ein Feld, ein Validator dazwischen.

## Entscheidung

**Alle Phasen-Ausgaben an Issues wohnen in genau EINEM Marker-Kommentar pro Ticket —
dem Harness-Kommentar.** Seine erste Zeile ist byte-exakt `<!-- ai-harness -->`; die
einzelnen Inhalte bleiben in ihren bewährten, markierten Abschnitten darin:

| Abschnitt                    | Schreiber   | Leser                              |
| ---------------------------- | ----------- | ---------------------------------- |
| `KI-ANALYSE:START/END`       | Triage (01) | UX, Spec, Impl, Review, 01-Post    |
| `ai-phase-routing:START/END` | Triage (01) | `resolve-phase-routing.sh` (02–05) |
| `KI-UX:START/END`            | UX (02)     | Spec, Impl                         |

Vier Punkte gehören zur Entscheidung:

**1. Der Issue-Body bleibt ab der Validierung unberührt.** Keine Phase ruft
`gh issue edit --body` auf; die Triage copyedited die Beschreibung nicht mehr
(Titel-Korrekturen bleiben erlaubt — der Validator prüft nur den Body). Der Validator
feuert damit nur noch auf Autoren-Edits, was sein Zweck ist.

**2. Upsert statt Append.** Jede Phase aktualisiert denselben Kommentar per
Read-Modify-Write und ersetzt nur ihren eigenen Abschnitt (fremde Abschnitte bleiben
bytegleich stehen) — ein Kommentar pro Ticket, kein Spam. Mechanik agent-seitig (restricted
Tier, nur `gh`): Node-ID per `gh issue view --json comments`, Update per
`gh api graphql` (`updateIssueComment`) mit `-F b=@-`-Heredoc; workflow-seitig kapselt
[`harness-comment.sh`](../../.github/scripts/harness-comment.sh) das Lesen — dasselbe
Upsert-Muster wie der `<!-- ai-quality -->`-Markerkommentar.

**3. Leser-Vertrag: Kommentar zuerst, Body als Legacy-Fallback.** Prompts, Skills und
`resolve-phase-routing.sh` lesen jeden markierten Abschnitt zuerst aus dem
Harness-Kommentar; fehlt er, fällt jeder **Abschnitt für sich** auf den Issue-Body zurück
(Tickets vor dieser Umstellung). Mid-Pipeline-Tickets laufen so ohne manuelle Migration
weiter.

**4. Validator-Skip über das Label.** `verify-issue-quality.sh` skippt den Vorab-Check,
wenn `ai:analysed` klebt (oder — Legacy — der Body noch einen Analyse-Block trägt):
Storage-ort-unabhängig deckt das „Ticket ist in der Pipeline" ab.

## Begründung

Ein Speicherort pro Schreibseite: Der Body gehört dem Autor (und seinem Validator), der
Harness-Kommentar der Pipeline — die Edit-Race-Fläche zwischen Phasen und Validator
entfällt vollständig, statt sie (wie der alte Body-Block-Skip) nur in einem Fenster zu
umschiffen. Die Sicherheitsleine für Schwachmodelle (#566: „Block als Kommentar statt in
den Body gepostet") kehrt ihre Richtung um und wird zur Normalfall-Mechanik: Der
Post-Check der Triage migriert jeden Analyse-Block aus Body oder marker-losem Kommentar
in den Harness-Kommentar und failt nur hart, wenn er nirgends existiert. Der
Template-Struktur-Post-Check bleibt als Sicherheitsleine für Autoren-Edits und die
Legacy-Bereinigung.

## Konsequenzen

- `01-claude-triage.yml` parst UI-Bezug, Aufwandsklasse und Spec-Skip aus dem
  Harness-Kommentar; `resolve-phase-routing.sh` liest die Routing-Tabelle von dort
  (Fixture-Test `resolve-phase-routing.test.ts` sichert die Quellen-Auswahl).
- Re-Triage liest Delta-Kommentare seit `stand` und überspringt dabei den
  Harness-Kommentar selbst.
- Der Harness-Kommentar ist das Issue-seitige Gegenstück zum Harness-Branch aus
  ADR 0007 (Repo-seitig): zwei Speicherorte, ein Ticket-Kontext.
- Abreißkante: Künftige Phasen mit Issue-Ausgaben hängen ihren Abschnitt in den
  bestehenden Harness-Kommentar — kein neuer Markerkommentar pro Phase.
