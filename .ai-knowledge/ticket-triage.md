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
- Pro Issue Details laden: bei **Erst-Triage** Titel + Beschreibung (`gh issue view <nr> --json title,body`);
  bei **Re-Triage** zusätzlich **nur die Delta-Kommentare** seit dem letzten `stand` (siehe Re-Triage
  unten), **nicht** den ganzen Thread.
- **Titel und Beschreibung** des Issues zusammen mit dem **Repo** zu einer Lösung konzipieren:
  relevante Dateien via Grep/Glob/Read finden, Architektur/Konventionen aus der Wissensbasis
  berücksichtigen — nicht raten.
- Ergebnis: Problemzusammenfassung, betroffene Dateien/Bereiche (mit Pfaden), Root Cause bzw.
  Lösungsweg, offene Fragen/Risiken sowie **prüfbare Akzeptanzkriterien** und die daraus
  abgeleiteten **Testfälle** (ausformuliert in Schritt 4; Hintergrund:
  [tdd-strategy.md](tdd-strategy.md)).
- **Re-Triage bestehender Analyse:** Trägt das Issue bereits `ai:analyzed`, lebt die Analyse in einem
  markierten Block im **Body** (`<!-- KI-ANALYSE:START stand=… -->` … `<!-- KI-ANALYSE:END -->`).
  1. Body laden, den Analyse-Block zwischen den Markern extrahieren und den `stand`-Timestamp auslesen:
     `gh issue view <nr> --json body -q .body`.
  2. **Nur die Delta-Kommentare seit `stand` lesen** (NICHT den ganzen Thread) — das sind die neuen
     User-Antworten seit der letzten Analyse:
     `gh issue view <nr> --json comments -q '.comments[] | select(.createdAt > "<stand>") | "\(.author.login): \(.body)"'`
  3. Die vorhandene Analyse **nicht unverändert übernehmen**: prüfen, ob sie zur (ggf. überarbeiteten)
     Aufgabenstellung samt Delta-Antworten **noch passt** und **vollständig** ist. Passt sie nicht mehr
     oder fehlen Aspekte: beantwortete offene Fragen **einarbeiten/entfernen** (der Block ist immer der
     aktuelle Stand, keine Historie), Ampel ggf. kippen, AK aktualisieren — Lücken nicht stehen lassen.
     Das Ergebnis ersetzt in Schritt 4 den Body-Block **in-place**.
- **Alt-Issue ohne Body-Block (Fallback/Migration):** Fehlt der `<!-- KI-ANALYSE:START -->`-Block
  (Analyse noch als alter Kommentar), den Block in Schritt 4 **neu anlegen**; vorhandene alte
  Analyse-Kommentare als überholt behandeln (ihr Inhalt darf zur Migration einmalig herangezogen
  werden), danach läuft alles über den Body.

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

## Schritt 2b — Titel optimieren (Inhalt unverändert)

Das Lektorat (Schritt 2) verbessert nur die **Beschreibung**; der **Titel** bleibt dabei unberührt
und kann inhaltlich „veralten" — besonders beim **Re-Triage** (Schritt 1), wenn die Beschreibung
nachträglich geändert wurde oder die Analyse das eigentliche Ziel präzisiert. Deshalb **am Ende der
Analyse** prüfen, ob der Titel noch passt, und ihn andernfalls optimieren.

- **Konsistenz prüfen:** Bildet der Titel die (lektorierte) **Beschreibung** und das **eigentliche
  Ziel des Tickets** (Beschreibung + Analyse-Ergebnis aus Schritt 4, ggf. Kommentar-Diskussion) noch
  treffend ab? Ist er kurz, präzise und inhaltlich stimmig?
- **Nur bei tatsächlicher Inkonsistenz anpassen** — analog zum Lektorat **inhaltlich treu**: keine
  Bedeutungsänderung, keine neuen Anforderungen, nur Anpassung an den tatsächlichen Inhalt
  (kürzer/präziser/passend formulieren). So wird **Titel-Drift** vermieden — Titel sollen bei jedem
  Re-Triage nicht ohne Grund „wandern".
- Übernehmen via `gh issue edit <nr> --title "<neuer Titel>"`.
- Ist der Titel bereits stimmig, **kein** Edit „pro forma" (gleiche Regel wie beim Lektorat).

## Schritt 3 — Zerlegen bei zu großen Tickets (optional)

Ein Ticket gilt als **zu groß**, wenn **mindestens eines** zutrifft:

- es berührt mehrere Schichten/Pakete des Monorepos (z. B. Frontend **und** Backend **und** DB),
- es enthält mehrere unabhängige Akzeptanzkriterien / „und"-verknüpfte Anforderungen,
- es ließe sich nicht sinnvoll in **einem** PR umsetzen/reviewen.

Trifft nichts davon zu, bleibt es beim normalen Ablauf (nur Analyse-Block im Body + Ping + Label).

Bei einem zu großen Ticket:

- **Vorbedingung — Labels sicherstellen:** Die in diesem Schritt verwendeten Labels (`ai:analyzed`,
  bei sofort umsetzbaren Teilaufgaben auch `ai:spec-ready`) müssen **existieren**, sonst schlägt
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

  <Kontext + Akzeptanzkriterien + Testfälle + Ampel>
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
- Sind Sub-Issues sofort umsetzbar (Ampel 🟢), zusätzlich `ai:spec-ready` setzen — entweder direkt
  beim Anlegen (`--label "ai:analyzed,ai:spec-ready"`) oder nachträglich
  (`gh issue edit <nr> --add-label "ai:spec-ready"`) —, damit die Spec-Stufe (`/spec-ticket`) die
  roten Tests schreibt.

## Schritt 4 — Lösungsvorschlag im Body-Block (mit Ampel)

- Den konzipierten Lösungsweg konkret und umsetzbar formulieren: betroffene Dateien, Schritte,
  Alternativen, Risiken, grobe Aufwandseinschätzung. Bei Zerlegung (Schritt 3) die angelegten
  Sub-Issues mit Nummern, Kurzbeschreibung und empfohlener Reihenfolge/Abhängigkeiten auflisten.
- **Akzeptanzkriterien & Testfälle (Pflichtbestandteil, Stufe 1 der [TDD-Strategie](tdd-strategy.md)):**
  Den Lösungsvorschlag um eine Liste **prüfbarer Akzeptanzkriterien** ergänzen (möglichst
  Given/When/Then) und je Kriterium den konkreten **Testfall** benennen — Testebene und Zieldatei
  nach Ticket-Typ:
  - **Backend-Logik / API** → `node:test`-Unit (`server/src/logics/*.test.ts`) bzw. API-Test
    (`server/src/express/*.test.ts`).
  - **Frontend-Logik** → Vitest-Unit (`frontend/src/lib/*.test.ts`).
  - **Feature / UI-Verhalten** → Akzeptanz-e2e (`frontend/e2e/*.spec.ts`, Stil `crud.spec.ts`).
  - **Reines Styling/Layout** → visuelle Verifikation statt Test (kurz begründen).

  Ziel: Die Umsetzung erhält eine **ausführbare** Zielvorgabe statt nur Prosa — das verhindert das
  „Schlingern" der KI. Akzeptanzkriterien und Testfälle gehören auch in die Sub-Issue-Bodies aus
  Schritt 3.

- **Umsetzbarkeits-Ampel** an den Anfang des Analyse-Blocks stellen — signalisiert, wie gut das Ticket
  umsetzbar ist:
  - 🟢 **grün** — klar umsetzbar: Anforderungen eindeutig, betroffene Dateien bekannt, in einem PR
    machbar **und prüfbare Akzeptanzkriterien + Testfälle liegen vor**.
  - 🟡 **gelb** — bedingt umsetzbar: offene Fragen/Annahmen, **Akzeptanzkriterien (noch) nicht
    prüfbar formulierbar**, größerer Umfang oder Zerlegung empfohlen (siehe Schritt 3).
  - 🔴 **rot** — noch nicht umsetzbar: Anforderungen unklar/widersprüchlich oder Infos fehlen;
    Rückfrage nötig, bevor implementiert wird.

  Die Farbwahl in einem Satz begründen.

- Die Analyse als markierten **Block in den Issue-Body** schreiben (nicht mehr als angehängten
  Kommentar) — ein deutscher, klar strukturierter Markdown-Block zwischen den Markern, der bei jeder
  (Re-)Triage **in-place ersetzt** wird. Es gibt genau **einen** solchen Block pro Issue.
  - Kanonische Struktur:

    ```
    <!-- KI-ANALYSE:START stand=YYYY-MM-DDTHH:MM:SSZ -->
    ## 🤖 KI-Analyse — Lösungsvorschlag

    **Umsetzbarkeit:** 🟢/🟡/🔴 <kurze Begründung>

    ### Akzeptanzkriterien & Testfälle
    <AK + Testfälle — Pflichtblock, wird von Spec/Umsetzung gelesen>

    ### ❓ Offene Fragen
    - [ ] <Frage>   (ganzer Abschnitt entfällt, wenn keine offenen Fragen)
    <!-- KI-ANALYSE:END -->
    ```

  - `stand` = ISO-8601 UTC, bei **jedem** Schreiben neu setzen: `date -u +%Y-%m-%dT%H:%M:%SZ`.
  - **Erst-Triage:** den Block **unten an den (lektorierten) Body anhängen**.
  - **Re-Triage:** **nur** den Block zwischen START/END ersetzen; die Original-Beschreibung oberhalb
    des START-Markers **unverändert** lassen (keine Historie — der Block ist immer der aktuelle Stand).
  - Schreiben mit **echten Zeilenumbrüchen** (nicht literales `\n`) via `gh issue edit <nr> --body-file -`
    und Heredoc — den **vollständigen** neuen Body (Original-Beschreibung + Block) übergeben
    (Heredoc-Marker **ohne** Quotes, damit `${stand}` expandiert):

  ```sh
  stand="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  gh issue edit <nr> --body-file - <<EOF
  <lektorierte Original-Beschreibung — bei Re-Triage unverändert>

  <!-- KI-ANALYSE:START stand=${stand} -->
  ## 🤖 KI-Analyse — Lösungsvorschlag

  **Umsetzbarkeit:** 🟢/🟡/🔴 …
  <!-- KI-ANALYSE:END -->
  EOF
  ```

## Schritt 4b — Kurzer Ping-Kommentar (Benachrichtigung)

Body-Edits lösen **keine** GitHub-Benachrichtigung aus — deshalb pro Lauf **einen kurzen
Ping-Kommentar** (`gh issue comment`), **keine** Vollanalyse mehr (die steht ab jetzt im Body):

- 1 Satz, dass die Analyse in der Beschreibung steht — Erst-Triage: „🤖 Analyse steht in der
  Beschreibung."; Re-Triage: „🤖 Analyse aktualisiert (Beschreibung)."
- **Nur wenn offene Fragen bestehen:** den Issue-Autor mit `@<issue-author>` adressieren und die
  offenen Fragen als Liste anhängen, mit der Bitte, per Kommentar zu antworten — so wird die Antwort
  beim nächsten Re-Triage als Delta-Kommentar (Schritt 1) gelesen. Kippt die Ampel beim Re-Triage auf
  🟡/🔴 (Label-Entzug, Schritt 5), hier kurz darauf hinweisen.

  ```sh
  gh issue comment <nr> --body-file - <<'EOF'
  🤖 Analyse steht in der Beschreibung.

  @<issue-author> Offene Fragen:
  - [ ] <Frage>
  EOF
  ```

## Schritt 5 — Markieren (`ai:analyzed`; bei klarer Analyse 🟢 zusätzlich `ai:spec-ready`)

- Label `ai:analyzed` bei Bedarf anlegen:
  `gh label create "ai:analyzed" --color 1D76DB --description "Von der KI analysiert; Analyse als Body-Block vorhanden"`
- Setzen: `gh issue edit <nr> --add-label "ai:analyzed"`
- Damit fällt das Issue aus dem Auswahlkriterium von Schritt 1 heraus. (Beim Re-Triage ist das Label
  bereits gesetzt — dann genügt der aktualisierte Body-Block aus Schritt 4 plus der Ping aus Schritt 4b.)
- **`ai:spec-ready` nach der Ampel aus Schritt 4 steuern** — nur eine **klar umsetzbare** Analyse
  geht in die Spec-Stufe, alles andere bleibt beim Menschen:
  - **🟢 grün →** zusätzlich `ai:spec-ready` setzen. Label bei Bedarf vorher anlegen
    (`gh label create "ai:spec-ready" --color FBCA04 --description "Analyse klar; rote Tests folgen vor der Umsetzung"`),
    dann `gh issue edit <nr> --add-label "ai:spec-ready"`. Damit schreibt die Spec-Stufe
    (`/spec-ticket`, siehe [ticket-spec.md](ticket-spec.md)) die roten Tests und gibt das Issue
    anschließend per `ai:ready` zur Umsetzung frei. **Nicht** direkt `ai:ready` setzen — das ist der
    Output der Spec-Stufe, nicht der Triage.
  - **🟡 gelb / 🔴 rot →** **kein** `ai:spec-ready` (und kein `ai:ready`) setzen — offene
    Fragen/Risiken klärt der Mensch und gibt ggf. von Hand frei. Trägt ein Issue beim **Re-Triage**
    bereits `ai:spec-ready` oder `ai:ready`, ist die Ampel aber auf 🟡/🔴 gekippt: beide
    **automatisch entfernen**
    (`gh issue edit <nr> --remove-label "ai:spec-ready" --remove-label "ai:ready"`), damit
    Spec/Umsetzung das Issue nicht unbeaufsichtigt aufgreifen (Race Condition), und im Ping-Kommentar
    (Schritt 4b) darauf hinweisen — die erneute Freigabe entscheidet der Mensch.
- Konsistenz zu Schritt 3: Bei Zerlegung werden 🟢-Sub-Issues nach derselben Regel direkt mit
  `ai:spec-ready` angelegt.

## Hinweise

- Schritt 2 (Lektorat), 3 (Sub-Issues anlegen + verknüpfen), 4 (Analyse-Block im Body), 4b
  (Ping-Kommentar) und 5 (Label) schreiben **öffentlich** auf GitHub (Issue-Body, neue Issues,
  Kommentar/Label, Benachrichtigungen) — vor der Ausführung bestätigen lassen, besonders bei
  Batch-Verarbeitung mehrerer Issues. Die Bestätigung kann **einmal für den ganzen Batch** eingeholt
  werden; danach die Issues ohne weitere Rückfrage abarbeiten.
- **Kein Produktivcode committen**; Triage bedeutet nur Analyse, Lektorat, ggf. Zerlegung,
  Analyse-Block im Body, Ping-Kommentar und Label.

## Schritt 6 — Autonomes Schließen (wenn Anforderungen bereits erfüllt)

Nach Schritt 5 (Labeln) prüft die KI genau **ein** Kriterium:

> **Sind die im Issue beschriebenen Anforderungen bereits vollständig im Codebase umgesetzt?**

Trifft das Kriterium eindeutig zu und liegt ein konkreter Beleg (Commit-SHA, PR-Nr. oder Datei/Zeile) vor, wird das Ticket geschlossen. Andernfalls bleibt es offen.

**Ablauf bei Erfüllung:**

```sh
# Erst Schließ-Kommentar mit konkretem Beleg posten
gh issue comment <nr> --body-file - <<'CLOSE'
Die im Ticket beschriebenen Anforderungen sind bereits erfüllt.

Beleg: <Commit-SHA / PR-Nr. / Datei+Zeile>
CLOSE

# Dann Ticket schließen
gh issue close <nr> --reason "completed"
```

**Sicherheitsnetz:**

- Nur schließen, wenn ein **konkreter Beleg** (Commit-SHA, PR-Nr. oder Datei/Zeile) vorliegt — kein Schließen auf Basis von Vermutungen.
- Den Beleg **immer** im Schließ-Kommentar nennen, bevor `gh issue close` aufgerufen wird.
- Bei Unsicherheit (🟡-Grenzfall): Ticket offen lassen, Mensch entscheiden lassen — kein spekulatives Schließen.
