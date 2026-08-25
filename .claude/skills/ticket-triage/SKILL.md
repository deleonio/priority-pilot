---
name: ticket-triage
description: "Ticket-Triage — offene GitHub-Issues analysieren, lektorieren, ggf. zerlegen, Analyse-Block (KI-ANALYSE) in den Body schreiben, Ampel setzen und Labels steuern. Nutzen bei ‚triage‘, ‚analysiere Issues‘, CI-Phase 1."
---

# Workflow: Ticket-Triage (GitHub Issues)

Nutzen, wenn du offene GitHub-Issues analysieren sollst — bewertet Umsetzbarkeit, schreibt den Body-Block mit Analyse und steuert die Folgophasen über Labels.

Tickets = GitHub-Issues von `deleonio/priority-pilot`. Voraussetzung: `gh` ist authentifiziert.

**Auswahlkriterium:** Analysiert werden alle **offenen** Issues, die **noch nicht** das Label
`ai:analysed` tragen. Eine **konkret übergebene Nummer** wird immer verarbeitet, auch wenn sie bereits `ai:analysed` trägt (Re-Triage).

## Schritt 1 — Ticket(s) wählen & analysieren

- Offene, noch nicht analysierte Issues finden:
  `gh issue list --state open --json number,title,labels --jq '[.[] | select((.labels | map(.name)) | index("ai:analysed") | not)] | .[] | "\(.number)\t\(.title)"'`
- Eine konkret übergebene Nummer hat Vorrang; sonst der Reihe nach (ältestes zuerst).
- **Batch-Verarbeitung:** Ohne konkrete Nummer **alle** passenden Issues in **einem** Lauf abarbeiten. Jedes Ticket vollständig durch die Schritte 1–5 führen, dann das nächste.
- Gibt es kein passendes Issue: klar sagen und stoppen.
- Pro Issue Details laden: bei **Erst-Triage** Titel + Beschreibung (`gh issue view <nr> --json title,body`);
  bei **Re-Triage** zusätzlich **nur die Delta-Kommentare** seit dem letzten `stand`.
- **Titel und Beschreibung** des Issues zusammen mit dem **Repo** zu einer Lösung konzipieren:
  relevante Dateien via Grep/Glob/Read finden, Architektur/Konventionen aus der Wissensbasis
  berücksichtigen — nicht raten.
- Ergebnis: Problemzusammenfassung, betroffene Dateien/Bereiche, Root Cause/Lösungsweg, offene Fragen/Risiken sowie **prüfbare Akzeptanzkriterien** und **Testfälle**.
- **Re-Triage bestehender Analyse:** Trägt das Issue bereits `ai:analysed`, lebt die Analyse in einem
  markierten Block im **Body** (`<!-- KI-ANALYSE:START stand=… -->` … `<!-- KI-ANALYSE:END -->`).
  1. Body laden, den Analyse-Block extrahieren und den `stand`-Timestamp auslesen.
  2. **Nur die Delta-Kommentare seit `stand` lesen** (NICHT den ganzen Thread).
  3. Die vorhandene Analyse **nicht unverändert übernehmen**: prüfen, ob sie zur (ggf. überarbeiteten)
     Aufgabenstellung samt Delta-Antworten **noch passt** und **vollständig** ist. Passt sie nicht mehr
     oder fehlen Aspekte: beantwortete offene Fragen **einarbeiten/entfernen**, Ampel ggf. kippen, AK
     aktualisieren — Lücken nicht stehen lassen.

## Schritt 2 — Beschreibung lektorieren (Inhalt unverändert)

- Die **Ticket-Beschreibung lektorieren**: Rechtschreibung, Grammatik und Verständlichkeit verbessern.
- **Der Inhalt darf dabei nicht verändert werden:** keine neuen oder entfernten Anforderungen,
  keine Bedeutungsänderung, keine zusätzlichen Annahmen.
- Lektorierte Fassung übernehmen — mehrzeiligen Body mit **echten Zeilenumbrüchen** übergeben, z. B.
  `gh issue edit <nr> --body-file -` mit Heredoc.
- Ändert das Lektorat fachlich nichts, bleibt die Beschreibung unangetastet (kein Edit „pro forma").

## Schritt 2b — Titel optimieren (Inhalt unverändert)

- **Konsistenz prüfen:** Bildet der Titel die (lektorierte) **Beschreibung** und das **eigentliche
  Ziel des Tickets** noch treffend ab? Ist er kurz, präzise und inhaltlich stimmig?
- **Nur bei tatsächlicher Inkonsistenz anpassen** — analog zum Lektorat **inhaltlich treu**:
  keine Bedeutungsänderung, keine neuen Anforderungen.
- Übernehmen via `gh issue edit <nr> --title "<neuer Titel>"`.

## Schritt 3 — Zerlegen bei zu großen Tickets (optional)

Ein Ticket gilt als **zu groß**, wenn **mindestens eines** zutrifft:

- es berührt mehrere Schichten/Pakete des Monorepos,
- es enthält mehrere unabhängige Akzeptanzkriterien / „und"-verknüpfte Anforderungen,
- es ließe sich nicht sinnvoll in **einem** PR umsetzen/reviewen.

Bei einem zu großen Ticket:

- **Vorbedingung — Labels sicherstellen:** `ai:analysed`, bei sofort umsetzbaren Teilaufgaben auch `ai:needs-ux-ui`/`ai:needs-spec` müssen **existieren**.
- Aus der Analyse **2–5 möglichst unabhängige Teilaufgaben** ableiten (jede in **einem** PR umsetzbar).
- Pro Teilaufgabe ein **Sub-Issue** anlegen — bereits mit Mini-Analyse + Ampel im Body, **inklusive der START/END-Marker**.
- Sub-Issue als **echtes GitHub-Sub-Issue** unter das Eltern-Ticket hängen (GraphQL, Pflicht):
  `gh api graphql -f query='mutation($p:ID!,$c:ID!){addSubIssue(input:{issueId:$p,subIssueId:$c}){clientMutationId}}' -f p=<parent-node-id> -f c=<child-node-id>`
- **Bei sequenziellen Abhängigkeiten — native `blocked-by`-Relation setzen (Pflicht):**
  `gh api graphql -f query='mutation($b:ID!,$k:ID!){addBlockedBy(input:{issueId:$b,blockingIssueId:$k}){clientMutationId}}' -f b=<nachfolger-node-id> -f k=<vorgänger-node-id>`
- **Rekursionsschutz (Pflicht):** Sub-Issues werden direkt mit `ai:analysed` angelegt (sie **sind**
  bereits das Analyse-Ergebnis) und fallen so aus dem Auswahlkriterium von Schritt 1. Nur **eine** Zerlegungsebene zulässig.
- Sind Sub-Issues sofort umsetzbar (Ampel 🟢), zusätzlich den passenden Phasen-Trigger setzen (`ai:needs-ux-ui` bei UI-Bezug, sonst `ai:needs-spec`). **Bei sequenziellen Ketten (`blocked-by`) nur den ersten, unblockierten Sub-Issue** mit dem Trigger versehen.

## Schritt 4 — Lösungsvorschlag im Body-Block (mit Ampel)

- Den Lösungsweg konkret und umsetzbar formulieren: betroffene Dateien, Schritte, Alternativen, Risiken.
- **Akzeptanzkriterien & Testfälle (Pflichtbestandteil):**
  Den Lösungsvorschlag um eine Liste **prüfbarer Akzeptanzkriterien** ergänzen und je Kriterium den
  konkreten **Testfall** benennen — **nur für Anwendungscode** (`server/src/**`, `frontend/src/**`, `frontend/e2e/**`). Testebene und Zieldatei nach Ticket-Typ:
  - **Backend-Logik / API** → `node:test`-Unit (`server/src/logics/*.test.ts`) bzw. API-Test (`server/src/express/*.test.ts`).
  - **Frontend-Logik** → Vitest-Unit (`frontend/src/lib/*.test.ts`).
  - **Feature / UI-Verhalten** → Akzeptanz-e2e (`frontend/e2e/*.spec.ts`, Stil `crud.spec.ts`). Bei für den Nutzer sichtbaren UI-Funktionen zusätzlich ein **Mobile-First-Akzeptanzkriterium** (375px-Viewport) mit eigenem Testfall.
  - **Reines Styling/Layout** → visuelle Verifikation statt Test (kurz begründen).
  - **Nicht-Anwendungscode** → **keine Testfälle**.

- **Umsetzbarkeits-Ampel** an den Anfang des Analyse-Blocks stellen:
  - 🟢 **grün** — klar umsetzbar: Anforderungen eindeutig, betroffene Dateien bekannt, in einem PR machbar **und prüfbare AK + Testfälle liegen vor**.
  - 🟡 **gelb** — bedingt umsetzbar: offene Fragen/Annahmen, **AK (noch) nicht prüfbar formulierbar**, größerer Umfang oder Zerlegung empfohlen.
  - 🔴 **rot** — noch nicht umsetzbar: Anforderungen unklar/widersprüchlich oder Infos fehlen; Rückfrage nötig.

- Die Analyse als markierten **Block in den Issue-Body** schreiben:
  ```
  <!-- KI-ANALYSE:START stand=YYYY-MM-DDTHH:MM:SSZ -->
  ### UI-Bezug
  - UI-Bezug: ja|nein
  - Begründung: <kurz>

  ### Spec
  - Spec nötig: ja|nein
  - Begründung: <bei „nein" PFLICHT>

  ### Aufwandsklasse
  - Aufwandsklasse: haiku|sonnet|opus
  - Begründung: <woran der Aufwand hängt>

  ### Umsetzungskontext
  - Betroffene Dateien: `pfad/a.ts`, `pfad/b.ts`
  - Betroffene Komponenten: <Funktion/Klasse/Endpunkt/Custom-Element>
  - Vorhandenes Muster: `pfad/vorbild.ts` — <was dort gleichartig gelöst ist>
  - Randbedingungen: <was nicht brechen darf>
  - Erwartetes Ergebnis: <von außen beobachtbares Verhalten>

  ### Akzeptanzkriterien
  - AK1: <prüfbar formuliert>

  ### Testfälle
  <Testfall je AK, Ebene benannt>

  ### Ampel
  - Ampel: 🟢|🟡|🔴
  - Begründung: <kurz>

  ### ❓ Offene Fragen
  - [ ] <Frage>
  <!-- KI-ANALYSE:END -->
  ```
  - **`Spec nötig` steuert, ob die Spec-Phase läuft.** Übersprungen wird nur bei Tickets **ohne Anwendungscode**.
  - **`Aufwandsklasse` steuert das Modell der Folgephasen.** Der Workflow setzt daraus `ai:model:<klasse>`.
  - `stand` = ISO-8601 UTC, bei **jedem** Schreiben neu setzen: `date -u +%Y-%m-%dT%H:%M:%SZ`.
  - Schreiben via `gh issue edit <nr> --body-file -` mit Heredoc.

## Schritt 4b — Kurzer Ping-Kommentar

Pro Lauf **einen kurzen Ping-Kommentar** (`gh issue comment`):

- 1 Satz, dass die Analyse in der Beschreibung steht.
- **Nur wenn offene Fragen bestehen:** den Issue-Autor mit `@<issue-author>` adressieren und die offenen Fragen als Liste anhängen.

## Schritt 5 — Markieren (`ai:analysed`; bei klarer Analyse 🟢 zusätzlich den Phasen-Trigger)

- Label `ai:analysed` setzen: `gh issue edit <nr> --add-label "ai:analysed"`
- **Uneindeutige Aufgabenstellung → `ai:needs-human` statt einer geratenen Analyse.** Postet **genau einen** Kommentar, dessen erste Zeile exakt `<!-- ai-triage-decision -->` lautet, gefolgt von **Was zu entscheiden ist / Optionen / Empfehlung**.
- **Phasen-Trigger nach der Ampel:**
  - **🟢 grün →** zusätzlich den Folge-Trigger setzen: `ai:needs-ux-ui` bei UI-Bezug; sonst `ai:needs-spec`; sonst — wenn `Spec nötig: nein` die Prüfung besteht — direkt `ai:needs-impl`.
  - **🟡 gelb / 🔴 rot →** **keinen** Phasen-Trigger setzen. Trägt ein Issue beim **Re-Triage** bereits einen Phasen-Trigger, ihn **automatisch entfernen**.

## Schritt 6 — Autonomes Schließen (wenn Anforderungen bereits erfüllt)

Nach Schritt 5 prüft die KI genau **ein** Kriterium:

> **Sind die im Issue beschriebenen Anforderungen bereits vollständig im Codebase umgesetzt?**

Trifft das Kriterium eindeutig zu und liegt ein konkreter Beleg (Commit-SHA, PR-Nr. oder Datei/Zeile) vor, wird das Ticket geschlossen.

**Ablauf bei Erfüllung:**

```sh
gh issue comment <nr> --body-file - <<'CLOSE'
Die im Ticket beschriebenen Anforderungen sind bereits erfüllt.

Beleg: <Commit-SHA / PR-Nr. / Datei+Zeile>
CLOSE

gh issue close <nr> --reason "completed"
```

**Sicherheitsnetz:** Nur schließen, wenn ein **konkreter Beleg** vorliegt — kein Schließen auf Basis von Vermutungen.

## Hinweise

- Schritt 2, 3, 4, 4b und 5 schreiben **öffentlich** auf GitHub — vor der Ausführung bestätigen lassen, besonders bei Batch-Verarbeitung.
- **Kein Produktivcode committen**; Triage bedeutet nur Analyse, Lektorat, ggf. Zerlegung, Analyse-Block im Body, Ping-Kommentar und Label.