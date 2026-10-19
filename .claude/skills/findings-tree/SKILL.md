---
name: findings-tree
description: "Findings-Tree — consolidate the weekly team-report findings into one epic with a ticket tree: collect the ci:* report issues (UX-Team, Rechts-Team, Code-Review-Team, Nit-Report, Prompt-Audit, Test-Maintenance), screen every finding for goal-orientation, importance and verifiability, consolidate findings that address the same gap into grouped candidates, and agree everything with the author in a dialog — questions before any creation, full drafts before the go — then cut the agreed catalog into a ticket tree via the ticket-tree catalog mode. Use for 'findings-tree', 'Findings einsammeln', 'Issue-Tree aus den Findings', 'Wochenfindings' (German: consolidate team findings into a ticket tree)."
argument-hint: "[optional: Fokus oder Label-Filter]"
---

# Workflow: Findings-Tree (team reports → one epic with a ticket tree)

Not a pipeline phase: runs locally, hand in hand with the author. The six team jobs report
weekly into `ci:*` issues; this run turns their findings into exactly **one** new epic with a
ticket tree. Nothing is created wild, nothing without the author's explicit go. The cutting
engine is [ticket-tree](../ticket-tree/SKILL.md) in **catalog mode**: Steps 1–5 here build the
agreed catalog, ticket-tree Steps 4–8 build the tree. This file's prose is English; everything
the author reads or answers stays German and follows the
[vermenschlichen](../vermenschlichen/SKILL.md) rules.

## Step 1 — Findings einsammeln (Bestand)

- Read [MEMORY.md](../../../.ai-memory/MEMORY.md).
- Collect the report issues: `gh issue list --state open --limit 200 --json number,title,labels`
  and keep everything carrying one of the report labels: `ci:ux-team`, `ci:rechts-team`,
  `ci:code-review-team`, `ci:nit-report`, `ci:prompt-audit`, `test-maintenance`.
- Read every report body and extract per report:
  1. the **Umsetzungs-Kandidaten** — already paste-ready ticket drafts, the primary pool;
  2. further **Funde** (ranked, with anchors) — secondary pool, only when a gap of their own;
  3. **Carry-over** items and their status (offen/umgesetzt/weggefallen) — an item that already
     lives in an open ticket is dedup material, never a new ticket;
  4. context where present (Bereichs-Check, Protokoll, Top-Nits).
- Build the inventory table (compact, shown in Step 4): Quelle (Issue), Finding-Kurzzeichen,
  Ein-Zeilen-Zusammenfassung, Anker, Risiko/Erlebnisgewinn, messbar?

## Step 2 — Sinnprüfung (three questions, all must hold)

Every finding passes three questions — only survivors become ticket material:

1. **Zielbeitrag (Relevanz)** — name the concrete benefit and for whom, judged against the
   guiding goal „ready for market“ (Stabilität, Payment, Rechnungen, Onboarding; keine
   unnötigen Features). „Schöner“ allein ist kein Nutzen — kosmetische Funde ohne fühlbaren
   Effekt fliegen.
2. **Wichtigkeit** — how much does it move the guiding goal (Risiko abwenden, Erlebnisgewinn,
   Wartungslast senken)? Drives the stage, not the cut.
3. **Verifizierbarkeit** — at least one acceptance criterion verifiable from outside is
   nameable. Ohne messbaren Nachweis wird ein Finding kein Ticket — höchstens eine Notiz im
   Epic.

Aktualität als Vorbedingung: die Fläche existiert noch, und keine dokumentierte Entscheidung
(`docs/adr/`, Phasen-Entscheidungen) widerspricht dem Finding — eine bewusste Entscheidung wird
nicht als Mangel neu gemeldet (Muster UX-Team-Methode).

Klassen je Finding: **Kandidat** · **Konsolidierung** (tritt einer Gruppe bei) · **Verwerfen**
(mit Ein-Zeilen-Begründung — nichts verschwindet still) · **Rückfrage** (der Autor entscheidet).

## Step 3 — Konsolidierung (cut by work, not by finding count)

Findings, die dieselbe Mangel oder Optimierung adressieren, verschmelzen:

- **Gruppieren, wenn:** gleiche Ursache oder gleiche Fläche (Ablauf/Schirm/Komponente); oder
  gleiche Mangel-Kategorie über Flächen hinweg (z. B. Preisauszeichnung auf Website UND in der
  App = ein Issue); und das Bündel bleibt software-technisch eine Einheit — eine Schicht, ein
  PR, „höchstens Mittel“ nach ticket-tree.
- **Nicht gruppieren, wenn:** das Bündel „Komplex“ würde oder ein trennendes „und“ enthält —
  dann splitten (ticket-tree Step 4 Regel). Lieber zwei kleine tragfähige Tickets als ein
  aufgeblähtes.
- **Cross-Source-Doppel** (z. B. UX-Team und Nit-Report am selben Ablauf): in den besser
  belegten Kandidaten aufgehen lassen, der andere wird als unterstützende Referenz geführt.
- Je Gruppe festgehalten: Titelvorschlag (Area-Präfix), zusammengeführte Belege als Bullets,
  gemeinsames Ziel in einem Satz, messbares Kriterium.

## Step 4 — Dialog (hand in hand, vor allem Erstellen)

Dem Autor präsentieren (Deutsch, kompakt):

1. das Inventar (Quelle, Finding, Zusammenfassung),
2. der Konsolidierungsvorschlag (Gruppen mit zusammengeführten Belegen),
3. die Verwerfungsliste mit Begründungen (nichts wird still aussortiert),
4. die offenen Rückfragen.

Regeln: höchstens **3 Fragen je Runde**, jede mit Antwortoptionen; iterieren, bis der Autor zu
jeder Gruppe, jeder Verwerfung und jeder Priorität Ja sagt. Ein Finding, das der Autor nicht in
einem Satz erklären kann, wird kein Ticket. **In diesem Schritt entsteht nichts auf GitHub.**

## Step 5 — Maßnahmenkatalog (catalog-mode input)

Den abgestimmten Katalog festhalten: nummerierte Maßnahmen, je mit Titelvorschlag
(Area-Präfix), Quell-Findings (Issue + Finding-Kurzzeichen), Ziel (ein Satz), Stufe P0–P3
(P0 = ready-for-market-kritisch: Stabilität/Payment/Onboarding; dann Wichtigkeit), Aufwand
S/M/L, Verifizierbarkeit (das Abnahmekriterium), Konsolidierungs-Mitglieder. Der Katalog geht
später in den Epic-Body ein (ticket-tree Step 7) — kein eigenes Doku-File, außer der Autor
will es.

## Step 6 — Baum bauen (ticket-tree, catalog mode)

[ticket-tree](../ticket-tree/SKILL.md) **catalog mode** Steps 4–8 mit dem Katalog aus Step 5
abarbeiten: Issues von höchstens „Mittel“, `[<Stufe>/<Aufwand>]`-Titel, native `blocked-by`
nur für echte Abhängigkeiten, Wellen, Rang-Tabelle, Mermaid-Graph. Pro Lauf genau ein Epic —
`Epic: Fundings KW <KW> — Team-Rückmeldungen` oder ein thematischer Titel nach Autoren-Wahl.
Über ~15 Issues: thematische Gruppenebene nach ticket-tree Step 4b.

- **Step 6 des ticket-tree (Confirm) ist bindend:** jeder Issue-Draft in voller Länge, das
  ausdrückliche Go — auch wenn der Autor den Katalog schon mitgestaltet hat, werden die
  Drafts selbst abgesegnet, nicht eine Zusammenfassung davon.
- Label-Hygiene wie jeder ticket-tree-Lauf: keine Pipeline-Labels; der Einstieg erfolgt später
  je Issue über `ai:needs-analyse` (Welle 1 zuerst).
- Der Epic-Body führt die Quell-Reports (Links) unter dem Plan auf.

## Step 7 — Rückverfolgung + Report

- Nach dem Anlegen auf **jedem** Quell-Report-Issue kommentieren:
  `Findings dieses Reports sind im Baum: #<Epic> → #<Tickets> (Stand <Datum>).` — nur
  Kommentar, nie der Body: die Workflows ersetzen ihn wöchentlich.
- Report auf Deutsch (ticket-tree Step 8): Epic-URL, Issue-Anzahl, Wellen je einer Zeile,
  kritischer Pfad, was verworfen wurde und warum, offene Fragen an den PO.

## Haltung

Sinnstiftung vor Vollständigkeit: lieber fünf tragfähige Tickets als fünfzehn neue. Der Baum
ist fertig, wenn der Autor jede Zeile erklären kann — nicht, wenn alle Findings untergekommen
sind. Ein Lauf ohne ein einziges neues Ticket ist ein gültiges Ergebnis, wenn jede Verwerfung
begründet ist und Abgedecktes (offene Issues, laufende Epics) sauber referenziert.
