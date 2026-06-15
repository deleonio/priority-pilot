# Workflow: Ticket-Triage (GitHub Issues)

KI-gestützte Analyse offener Tickets — **werkzeug-unabhängig** beschrieben. Konkrete
Slash-Commands (z. B. für Claude Code unter `.claude/commands/`) verweisen nur auf diese Schritte.

Tickets = GitHub-Issues von `deleonio/priority-pilot`. Voraussetzung: `gh` ist authentifiziert.

**Auswahlkriterium:** Analysiert werden alle **offenen** Issues, die **noch nicht** das Label
`ai:analyzed` tragen. Das Label markiert ein Issue als erledigt und verhindert Doppel-Analysen —
der Workflow ist damit wiederholbar (idempotent). Eine **konkret übergebene Nummer** wird immer
verarbeitet, auch wenn sie bereits `ai:analyzed` trägt (Re-Triage, siehe Schritt 1).

## Schritt 1 — Ticket(s) wählen & analysieren

- Offene, noch nicht analysierte Issues finden (index-unabhängig, **sofort konsistent**):
  `gh issue list --state open --json number,title,labels --jq '[.[] | select((.labels | map(.name)) | index("ai:analyzed") | not)] | .[] | "\(.number)\t\(.title)"'`
  Hinweis: `gh issue list --state open --search '-label:"ai:analyzed"'` funktioniert ebenfalls,
  nutzt aber den GitHub-Suchindex (einige Sekunden Verzögerung nach dem Labeln). Bei
  **Batch-Läufen** die `--json`/`jq`-Variante bevorzugen, sonst kann ein gerade gelabeltes
  Issue erneut ausgewählt werden.
- Eine konkret übergebene Nummer hat Vorrang; sonst der Reihe nach abarbeiten (ältestes zuerst).
- **Batch-Verarbeitung:** Ohne konkrete Nummer **alle** passenden Issues in **einem** Lauf abarbeiten
  (ältestes zuerst), nicht nur das erste. Jedes Ticket vollständig durch die Schritte 1–5 führen und
  **erst dann** das nächste beginnen — so bleibt der Lauf jederzeit konsistent abbrechbar.
- **Kontextbudget:** So viele Tickets pro Lauf verarbeiten, wie der Kontext zuverlässig zulässt. Wird
  er knapp, das **aktuelle** Ticket sauber zu Ende führen (inkl. Label aus Schritt 5), dann
  **stoppen** und die noch offenen Nummern für einen Folgelauf nennen. Da gelabelte Issues aus dem
  Auswahlkriterium fallen, nimmt ein erneuter Lauf die Reste automatisch auf (idempotent). Bei
  Batch-Läufen die `--json`/`jq`-Auswahl (oben) bevorzugen, sonst kann ein gerade gelabeltes Issue
  erneut gewählt werden.
- Gibt es kein passendes Issue: klar sagen und stoppen (nichts erfinden).
- Pro Issue Details laden: `gh issue view <nr> --comments`
- **Titel und Beschreibung** des Issues zusammen mit dem **Repo** zu einer Lösung konzipieren:
  relevante Dateien via Grep/Glob/Read finden, Architektur/Konventionen aus der Wissensbasis
  berücksichtigen — nicht raten.
- Ergebnis: Problemzusammenfassung, betroffene Dateien/Bereiche (mit Pfaden), Root Cause bzw.
  Lösungsweg, offene Fragen/Risiken.
- **Re-Triage bestehender Analyse:** Liegt bereits ein `ai:analyzed`-Kommentar vor (z. B. weil die
  Beschreibung nachträglich geändert/ergänzt wurde), die vorhandene Analyse **nicht unverändert
  übernehmen**. Prüfen, ob sie zur (ggf. überarbeiteten) Aufgabenstellung **noch passt** und
  **vollständig** ist. Passt sie nicht mehr oder fehlen Aspekte, die Analyse **aktualisieren bzw.
  ergänzen** (neuer Kommentar, der den Stand korrigiert/vervollständigt) — Lücken nicht stehen
  lassen.

## Schritt 2 — Beschreibung lektorieren (Inhalt unverändert)

- Die **Ticket-Beschreibung lektorieren**: Rechtschreibung, Grammatik und Verständlichkeit
  verbessern (klare Sätze, einheitliche Begriffe, saubere Markdown-Struktur).
- **Der Inhalt darf dabei nicht verändert werden:** keine neuen oder entfernten Anforderungen,
  keine Bedeutungsänderung, keine zusätzlichen Annahmen. Im Zweifel wörtlich lassen und die offene
  Frage stattdessen in der Analyse (Schritt 4) vermerken.
- Lektorierte Fassung übernehmen — mehrzeiligen Body mit **echten Zeilenumbrüchen** übergeben (nicht
  literales `\n`), z. B. `gh issue edit <nr> --body-file -` mit Heredoc.
- Ändert das Lektorat fachlich nichts, sondern nur die Form: ist die Beschreibung bereits sauber,
  bleibt sie unangetastet (kein Edit „pro forma").

## Schritt 3 — Zerlegen bei zu großen Tickets (optional)

Ein Ticket gilt als **zu groß**, wenn **mindestens eines** zutrifft:

- es berührt mehrere Schichten/Pakete des Monorepos (z. B. Frontend **und** Backend **und** DB),
- es enthält mehrere unabhängige Akzeptanzkriterien / „und"-verknüpfte Anforderungen,
- es ließe sich nicht sinnvoll in **einem** PR umsetzen/reviewen.

Trifft nichts davon zu, bleibt es beim normalen Ablauf (nur Kommentar + Label).

Bei einem zu großen Ticket:

- **Vorbedingung — Labels sicherstellen:** Die in diesem Schritt verwendeten Labels (`ai:analyzed`,
  bei sofort umsetzbaren Teilaufgaben auch `ai:ready`) müssen **existieren**, sonst schlägt
  `gh issue create --label …` fehl. Das Anlegen aus Schritt 5 (`gh label create …`) daher **vor**
  der ersten Sub-Issue-Anlage ausführen.
- Aus der Analyse **2–5 möglichst unabhängige Teilaufgaben** ableiten (jede in **einem** PR
  umsetzbar). Abhängigkeiten explizit benennen und über die empfohlene Reihenfolge abbilden.
- Pro Teilaufgabe ein **Sub-Issue** anlegen — bereits mit Mini-Analyse + Ampel (Schritt 4) im Body.
  Body mit **echten Zeilenumbrüchen** übergeben (nicht literales `\n` — das landet sonst als Text
  im Issue), z. B. per `--body-file -` und Heredoc:

  ```sh
  gh issue create --title "<Teilaufgabe>" --label "ai:analyzed" --body-file - <<'EOF'
  Teil von #<eltern-nr>

  <Kontext + Akzeptanzkriterien + Ampel>
  EOF
  ```

- Sub-Issue als **echtes GitHub-Sub-Issue** unter das Eltern-Ticket hängen (Sub-Issue-Beziehung,
  nicht nur Textreferenz). `gh` hat dafür kein natives Kommando → via GraphQL:
  `gh api graphql -f query='mutation($p:ID!,$c:ID!){addSubIssue(input:{issueId:$p,subIssueId:$c}){clientMutationId}}' -f p=<parent-node-id> -f c=<child-node-id>`
  (Node-IDs über `gh issue view <nr> --json id`.) Fallback, falls die Mutation nicht verfügbar ist:
  eine **Task-Liste** (`- [ ] #<nr>`) im Eltern-Body — GitHub rendert daraus die Fortschrittsanzeige.
  Dabei den (in Schritt 2 lektorierten) Eltern-Body **nicht überschreiben**, sondern die Task-Liste
  **anhängen** (bestehenden Body laden, ergänzen, zurückschreiben), um keinen Inhalt zu verlieren.
- **Rekursionsschutz (Pflicht):** Sub-Issues werden direkt mit `ai:analyzed` angelegt (sie **sind**
  bereits das Analyse-Ergebnis) und fallen so aus dem Auswahlkriterium von Schritt 1 — sie werden
  nicht erneut triagiert/zerlegt. Es ist nur **eine** Zerlegungsebene zulässig: ein Sub-Issue wird
  **nicht** weiter zerlegt. Maximal **5** Sub-Issues, um eine Issue-Flut zu vermeiden.
- Sind Sub-Issues sofort umsetzbar (Ampel 🟢), zusätzlich `ai:ready` setzen — entweder direkt beim
  Anlegen (`--label "ai:analyzed,ai:ready"`) oder nachträglich
  (`gh issue edit <nr> --add-label "ai:ready"`) —, damit sie für `/implement-ticket` bereitstehen.

## Schritt 4 — Lösungsvorschlag als deutscher Kommentar (mit Ampel)

- Den konzipierten Lösungsweg konkret und umsetzbar formulieren: betroffene Dateien, Schritte,
  Alternativen, Risiken, grobe Aufwandseinschätzung. Bei Zerlegung (Schritt 3) die angelegten
  Sub-Issues mit Nummern, Kurzbeschreibung und empfohlener Reihenfolge/Abhängigkeiten auflisten.
- **Umsetzbarkeits-Ampel** an den Anfang des Kommentars stellen — signalisiert, wie gut das Ticket
  umsetzbar ist:
  - 🟢 **grün** — klar umsetzbar: Anforderungen eindeutig, betroffene Dateien bekannt, in einem PR
    machbar.
  - 🟡 **gelb** — bedingt umsetzbar: offene Fragen/Annahmen, größerer Umfang oder Zerlegung
    empfohlen (siehe Schritt 3).
  - 🔴 **rot** — noch nicht umsetzbar: Anforderungen unklar/widersprüchlich oder Infos fehlen;
    Rückfrage nötig, bevor implementiert wird.

  Die Farbwahl in einem Satz begründen.

- Als **deutschen** Kommentar (Markdown, klar strukturiert) an das Issue anhängen — mit **echten
  Zeilenumbrüchen** (nicht literales `\n`), z. B. per `--body-file -` und Heredoc:

  ```sh
  gh issue comment <nr> --body-file - <<'EOF'
  🤖 KI-Analyse — Lösungsvorschlag

  **Umsetzbarkeit:** 🟢/🟡/🔴 …
  EOF
  ```

## Schritt 5 — Als analysiert markieren

- Label `ai:analyzed` bei Bedarf anlegen:
  `gh label create "ai:analyzed" --color 1D76DB --description "Von der KI analysiert; Lösungsvorschlag als Kommentar vorhanden"`
- Setzen: `gh issue edit <nr> --add-label "ai:analyzed"`
- Damit fällt das Issue aus dem Auswahlkriterium von Schritt 1 heraus. (Beim Re-Triage ist das Label
  bereits gesetzt — dann genügt der aktualisierte Kommentar aus Schritt 1/4.)

## Hinweise

- Schritt 2 (Lektorat), 3 (Sub-Issues anlegen + verknüpfen), 4 (Kommentar) und 5 (Label) schreiben
  **öffentlich** auf GitHub (Issue-Body, neue Issues, Kommentar/Label, Benachrichtigungen) — vor der
  Ausführung bestätigen lassen, besonders bei Batch-Verarbeitung mehrerer Issues. Die Bestätigung
  kann **einmal für den ganzen Batch** eingeholt werden; danach die Issues ohne weitere Rückfrage
  abarbeiten.
- **Kein Produktivcode committen**; Triage bedeutet nur Analyse, Lektorat, ggf. Zerlegung,
  Kommentar und Label.
