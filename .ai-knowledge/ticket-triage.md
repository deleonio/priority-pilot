# Workflow: Ticket-Triage (GitHub Issues)

KI-gestützte Analyse offener Tickets — **werkzeug-unabhängig** beschrieben. Konkrete
Slash-Commands (z. B. für Coding-Agent unter `commands/`) verweisen nur auf diese Schritte.

Tickets = GitHub-Issues von `deleonio/priority-pilot`. Voraussetzung: `gh` ist authentifiziert.

**Auswahlkriterium:** Analysiert werden alle **offenen** Issues, die **noch nicht** das Label
`ai:analysed` tragen. Das Label markiert ein Issue als erledigt und verhindert Doppel-Analysen —
der Workflow ist damit wiederholbar (idempotent). Eine **konkret übergebene Nummer** wird immer
verarbeitet, auch wenn sie bereits `ai:analysed` trägt (Re-Triage, siehe Schritt 1).

## Schritt 1 — Ticket(s) wählen & analysieren

- Offene, noch nicht analysierte Issues finden (index-unabhängig, **sofort konsistent**):
  `gh issue list --state open --json number,title,labels --jq '[.[] | select((.labels | map(.name)) | index("ai:analysed") | not)] | .[] | "\(.number)\t\(.title)"'`
  Hinweis: `gh issue list --state open --search '-label:"ai:analysed"'` funktioniert ebenfalls,
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
- **Re-Triage bestehender Analyse:** Trägt das Issue bereits `ai:analysed`, lebt die Analyse in einem
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

- **Vorbedingung — Labels sicherstellen:** Die in diesem Schritt verwendeten Labels (`ai:analysed`,
  bei sofort umsetzbaren Teilaufgaben auch `ai:needs-ux-ui`/`ai:needs-spec`) müssen **existieren**,
  sonst schlägt `gh issue create --label …` fehl. Das Anlegen aus Schritt 5 (`gh label create …`)
  daher **vor** der ersten Sub-Issue-Anlage ausführen.
- Aus der Analyse **2–5 möglichst unabhängige Teilaufgaben** ableiten (jede in **einem** PR
  umsetzbar). Abhängigkeiten explizit benennen und über die empfohlene Reihenfolge abbilden.
- Pro Teilaufgabe ein **Sub-Issue** anlegen — bereits mit Mini-Analyse + Ampel (Schritt 4) im Body,
  **inklusive der START/END-Marker**: Re-Triage (z. B. automatisches Unblock nach Merge des
  Vorgängers) erkennt den Analyse-Block nur mit Markern — ohne sie failt der Triage-Workflow hart.
  Body mit **echten Zeilenumbrüchen** übergeben (nicht literales `\n` — das landet sonst als Text
  im Issue), z. B. per `--body-file -` und Heredoc:

  ```sh
  gh issue create --title "<Teilaufgabe>" --label "ai:analysed" --body-file - <<'EOF'
  Teil von #<eltern-nr>

  <!-- KI-ANALYSE:START stand=<ISO-8601-UTC> -->
  <Kontext + Akzeptanzkriterien + Testfälle + Ampel>
  <!-- KI-ANALYSE:END -->
  EOF
  ```

- Sub-Issue als **echtes GitHub-Sub-Issue** unter das Eltern-Ticket hängen (Sub-Issue-Beziehung,
  nicht nur Textreferenz). `gh` hat dafür kein natives Kommando → via GraphQL (**Pflicht**,
  kein optionaler Schritt):
  `gh api graphql -f query='mutation($p:ID!,$c:ID!){addSubIssue(input:{issueId:$p,subIssueId:$c}){clientMutationId}}' -f p=<parent-node-id> -f c=<child-node-id>`
  (Node-IDs über `gh issue view <nr> --json id`.)
  **Fallback nur bei API-Fehler:** Falls die GraphQL-Mutation fehlschlägt (API-Fehler, Berechtigung
  nicht vorhanden o. ä.), als Notfallpfad eine **Task-Liste** (`- [ ] #<nr>`) im Eltern-Body
  eintragen — GitHub rendert daraus die Fortschrittsanzeige. Dabei den (in Schritt 2 lektorierten)
  Eltern-Body **nicht überschreiben**, sondern die Task-Liste **anhängen** (bestehenden Body laden,
  ergänzen, zurückschreiben), um keinen Inhalt zu verlieren. Den API-Fehler und den Grund für den
  Fallback im Ping-Kommentar (Schritt 4b) dokumentieren, damit der Mensch informiert ist.
- **Bei sequenziellen Abhängigkeiten — native `blocked-by`-Relation setzen (Pflicht):** Bauen die
  Sub-Issues aufeinander auf (gleiche Dateien, „A2 nach A1", Reihenfolge A1 → A2 → A3), die
  Abhängigkeit **maschinenlesbar** als native GitHub-Issue-Dependency hinterlegen — nicht nur als
  Prosa —, damit sie beim Merge automatisch aufgelöst wird (letzter Punkt in diesem Schritt). Jeder
  Nachfolger wird von seinem direkten Vorgänger **geblockt** (A1 blockt A2, A2 blockt A3):
  `gh api graphql -f query='mutation($b:ID!,$k:ID!){addBlockedBy(input:{issueId:$b,blockingIssueId:$k}){clientMutationId}}' -f b=<nachfolger-node-id> -f k=<vorgänger-node-id>`
  (Node-IDs über `gh issue view <nr> --json id`.) Nur **echte** Reihenfolge-Abhängigkeiten verknüpfen;
  unabhängige Sub-Issues bleiben ohne `blocked-by`. Die Kanten gedrosselt setzen — die Dependency-API
  kann bei zu schnellen Schreibzugriffen sekundär rate-limiten.
- **Rekursionsschutz (Pflicht):** Sub-Issues werden direkt mit `ai:analysed` angelegt (sie **sind**
  bereits das Analyse-Ergebnis) und fallen so aus dem Auswahlkriterium von Schritt 1 — sie werden
  nicht erneut triagiert/zerlegt. Es ist nur **eine** Zerlegungsebene zulässig: ein Sub-Issue wird
  **nicht** weiter zerlegt. Maximal **5** Sub-Issues, um eine Issue-Flut zu vermeiden.
- Sind Sub-Issues sofort umsetzbar (Ampel 🟢), zusätzlich den passenden Phasen-Trigger setzen
  (`ai:needs-ux-ui` bei UI-Bezug, sonst `ai:needs-spec`) — entweder direkt
  beim Anlegen (`--label "ai:analysed,ai:needs-spec"`) oder nachträglich
  (`gh issue edit <nr> --add-label "ai:needs-spec"`) —, damit die Spec-Stufe (`/spec-ticket`) die
  roten Tests schreibt. **Bei sequenziellen Ketten (`blocked-by`, s. o.) nur den ersten,
  unblockierten Sub-Issue** mit dem Trigger versehen; die geblockten Nachfolger bleiben bei
  `ai:analysed` (auch wenn selbst 🟢) und werden **automatisch freigegeben, sobald ihr Vorgänger
  gemergt ist**: [`claude-issue-unblock.yml`](../.github/workflows/claude-issue-unblock.yml) setzt
  dann ihr `ai:needs-analyse` (per App-Token) und stößt eine Re-Triage gegen den neuen Code-Stand an, die
  ihrerseits den Phasen-Trigger setzt (🟢) oder mit Hinweisen beim Menschen bleibt (🟡/🔴). So läuft die
  Kette Glied für Glied, ohne dass mehrere „gleiche Dateien"-Sub-Issues gleichzeitig in Umsetzung
  gehen und kollidieren.

## Schritt 4 — Lösungsvorschlag im Body-Block (mit Ampel)

- Den konzipierten Lösungsweg konkret und umsetzbar formulieren: betroffene Dateien, Schritte,
  Alternativen, Risiken, grobe Aufwandseinschätzung. Bei Zerlegung (Schritt 3) die angelegten
  Sub-Issues mit Nummern, Kurzbeschreibung und empfohlener Reihenfolge/Abhängigkeiten auflisten.
- **Akzeptanzkriterien & Testfälle (Pflichtbestandteil, Stufe 1 der [TDD-Strategie](tdd-strategy.md)):**
  Den Lösungsvorschlag um eine Liste **prüfbarer Akzeptanzkriterien** ergänzen (möglichst
  Given/When/Then) und je Kriterium den konkreten **Testfall** benennen — **nur für Anwendungscode**
  (`server/src/**`, `frontend/src/**`, `frontend/e2e/**`). Testebene und Zieldatei nach Ticket-Typ:
  - **Backend-Logik / API** → `node:test`-Unit (`server/src/logics/*.test.ts`) bzw. API-Test
    (`server/src/express/*.test.ts`).
  - **Frontend-Logik** → Vitest-Unit (`frontend/src/lib/*.test.ts`).
  - **Feature / UI-Verhalten** → Akzeptanz-e2e (`frontend/e2e/*.spec.ts`, Stil `crud.spec.ts`). Bei für
    den Nutzer sichtbaren UI-Funktionen zusätzlich ein **Mobile-First-Akzeptanzkriterium**
    (375px-Viewport, kein horizontales Scrollen — siehe [conventions.md](conventions.md)) mit eigenem
    Testfall aufnehmen, Muster `login.spec.ts` AK5 / `task-tree.spec.ts` AK-6.
  - **Reines Styling/Layout** → visuelle Verifikation statt Test (kurz begründen).
  - **Nicht-Anwendungscode** (`.github/workflows`, `.github/scripts`, `setup-claude`-Composite,
    CI-Plumbing, Config-Dateien, **oder Markdown-Inhalt — egal wo, nicht nur unter `docs/`**)
    → **keine Testfälle**. Akzeptanzkriterien stattdessen als prüfbare Aussagen formulieren
    („Abschnitt X vorhanden", „Pfad Y stabil"), die Erfüllung im PR-Body belegen; die Spec-Stufe
    schreibt dafür keine roten Tests (Begründung:
    [ticket-spec.md](ticket-spec.md) Schritt 2 — String/YAML/Config-Match ist ein Change-Detector
    ohne Biss; ADR 0001).

  Ziel: Die Umsetzung erhält eine **ausführbare** Zielvorgabe statt nur Prosa — das verhindert das
  „Schlingern" der KI. Akzeptanzkriterien und Testfälle gehören auch in die Sub-Issue-Bodies aus
  Schritt 3.

- **Umsetzbarkeits-Ampel** an den Anfang des Analyse-Blocks stellen — signalisiert, wie gut das Ticket
  umsetzbar ist:
  - 🟢 **grün** — klar umsetzbar: Anforderungen eindeutig, betroffene Dateien bekannt, in einem PR
    machbar **und prüfbare Akzeptanzkriterien + Testfälle liegen vor** (Ausnahme reine Doku/Pattern:
    hier sind **prüfbare Akzeptanzkriterien** ohne Testfälle ausreichend — siehe Ticket-Typ oben).
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
    ### UI-Bezug
    - UI-Bezug: ja|nein
    - Begründung: <kurz>

    ### Spec
    - Spec nötig: ja|nein
    - Begründung: <bei „nein" PFLICHT — warum eine Spezifikation nichts hinzufügt>

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
    <Testfall je AK, Ebene benannt (node:test | Vitest | e2e)>

    ### Ampel
    - Ampel: 🟢|🟡|🔴
    - Begründung: <kurz>

    ### ❓ Offene Fragen
    - [ ] <Frage>   (ganzer Abschnitt entfällt, wenn keine offenen Fragen)
    <!-- KI-ANALYSE:END -->
    ```

  - **`Spec nötig` steuert, ob die Spec-Phase läuft.** Die Spec liefert rote Tests als Vertrag für
    die Umsetzung; TDD bleibt die Regel. Übersprungen wird nur, wo dieser Vertrag gar nicht
    entstehen kann: bei Tickets **ohne Anwendungscode** (`server/src/**`, `frontend/src/**`,
    `frontend/e2e/**`). Für Workflows, Skripte, Config und Markdown verbietet der Test-Carve-out
    ([ticket-spec.md](ticket-spec.md) Schritt 2, ADR-0001) ohnehin Tests — die Spec-Phase produzierte
    dort nur ein Dokument.
    - **Technisch begrenzt, nicht nur per Prompt:** `resolve-spec-skip.sh` prüft die Angabe gegen
      die im selben Block deklarierten `Betroffene Dateien`. Zeigt auch nur ein Pfad in
      Anwendungscode, läuft die Spec trotzdem. Jede Unsicherheit (Feld fehlt, unlesbar, keine
      Pfade) führt ebenfalls zu „Spec läuft" — ein überflüssiger Lauf kostet Token, ein
      fälschlich übersprungener kostet den Vertrag.
    - **`needs_ux ⇒ needs_spec`:** UI-Bezug erzwingt die Spec — an zwei Stellen verankert, im
      Skript und im `ux-ready`-Pfad von `02-claude-ux.yml` (der immer `ai:needs-spec` setzt).
    - **Ohne Spec:** Die Analyse setzt direkt `ai:needs-impl`; die Umsetzung legt Branch **und**
      PR selbst an (Direkt-Modus in `04-claude-implement.yml`).
    - Die Aufwandsklasse ist davon **entkoppelt**: Eine `haiku`-Subtask kann eine Spec brauchen,
      eine `opus`-Subtask rein serverseitig ohne Testpflicht sein.
  - **`Aufwandsklasse` steuert das Modell der Folgephasen.** Der Workflow setzt daraus genau ein
    `ai:model:<klasse>`-Label; `resolve-model-label.sh` liest es vor jedem Claude-Start. Fehlt es
    oder ist es mehrdeutig, bricht die Folgephase ab und parkt mit Begründung beim Menschen —
    es wird bewusst **nicht** still das teuerste Modell genommen.
  - **`Umsetzungskontext` ist der Kern der Phase.** Die Analyse ist der einzige Schritt auf dem
    starken Modell; alle Folgeschritte laufen günstiger und dürfen die Analyse nicht wiederholen
    müssen. Pfade werden **am Code verifiziert** (Read/Glob), nicht geraten — ein erfundener Pfad
    ist schlechter als keiner. Bei Sub-Issues wird der Kontext **je Sub-Issue eigenständig**
    ausgefüllt, kein Verweis aufs Eltern-Ticket: die Umsetzung liest nur ihr eigenes Ticket.
  - **Breite Recherche über einen Explore-Subagent** (Task-Tool) delegieren und nur das Ergebnis
    zurückholen. Subagents laufen über `CLAUDE_CODE_SUBAGENT_MODEL` auf einem günstigeren Modell;
    direktes Lesen zöge jede Datei in den teuren Elternkontext.

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

## Schritt 5 — Markieren (`ai:analysed`; bei klarer Analyse 🟢 zusätzlich den Phasen-Trigger)

- Label `ai:analysed` bei Bedarf anlegen:
  `gh label create "ai:analysed" --color 1D76DB --description "Von der KI analysiert; Analyse als Body-Block vorhanden"`
- Setzen: `gh issue edit <nr> --add-label "ai:analysed"`
- Damit fällt das Issue aus dem Auswahlkriterium von Schritt 1 heraus. (Beim Re-Triage ist das Label
  bereits gesetzt — dann genügt der aktualisierte Body-Block aus Schritt 4 plus der Ping aus Schritt 4b.)
- **Uneindeutige Aufgabenstellung → `ai:needs-human` statt einer geratenen Analyse.** Lässt sich
  eine Unklarheit nicht selbst auflösen (Code lesen, bestehendes Verhalten prüfen, Ticket-Historie),
  wird nichts vorsorglich analysiert. Die Analyse gibt `VERDICT: needs-human` aus und postet **genau
  einen** Kommentar, dessen erste Zeile exakt `<!-- ai-triage-decision -->` lautet, gefolgt von
  **Was zu entscheiden ist / Worauf es sich bezieht / Optionen / Empfehlung**.
  - **Begründungspflicht ist technisch erzwungen:** Der Workflow sucht den Marker über
    `needs-human-explain.sh lookup --ticket <nr> --mode triage`. Fehlt er, postet der Workflow eine
    Ersatz-Diagnose — das Label wird nie ohne Begründung gesetzt. „Bitte prüfen" oder „unklar"
    erfüllt die Anforderung nicht: es verlagert die Analysearbeit zurück auf den Menschen.
  - **Wirkung:** `check-phase-label.sh` blockt mit diesem Label **jede** Folgephase, auch wenn ein
    Trigger klebt.
  - **Fortsetzen:** `ai:needs-human` zu entfernen hebt nur die Sperre auf — es startet nichts.
    Da das Ticket nach der Analyse `ai:analysed`, aber keinen Phasen-Trigger trägt, braucht es
    zusätzlich einen Anstoß: Frage im Ticket beantworten, dann `ai:needs-analyse` setzen
    (Re-Triage mit der Antwort als Delta-Kommentar) — oder, wenn die Analyse bereits taugt,
    direkt den Folge-Trigger `ai:needs-ux-ui` bzw. `ai:needs-spec` setzen.

- **Phasen-Trigger nach der Ampel aus Schritt 4 steuern** — nur eine **klar umsetzbare** Analyse
  geht weiter in die Pipeline, alles andere bleibt beim Menschen:
  - **🟢 grün →** zusätzlich den Folge-Trigger setzen, in dieser Reihenfolge: `ai:needs-ux-ui` bei
    UI-Bezug; sonst `ai:needs-spec`; sonst — wenn `Spec nötig: nein` die Prüfung in
    `resolve-spec-skip.sh` besteht — direkt `ai:needs-impl` (Spec übersprungen). Label bei Bedarf vorher anlegen
    (`gh label create "ai:needs-ux-ui" --color FBCA04 --description "UX-Beratung läuft als nächste Phase"` bzw.
    `gh label create "ai:needs-spec" --color FBCA04 --description "Spec-Stufe schreibt rote Tests"`),
    dann `gh issue edit <nr> --add-label "ai:needs-ux-ui"` bzw. `"ai:needs-spec"`. Damit schreibt die
    Spec-Stufe (`/spec-ticket`, siehe [ticket-spec.md](ticket-spec.md)) die roten Tests und gibt das Issue
    anschließend per `ai:needs-impl` zur Umsetzung frei. **Nicht** direkt `ai:needs-impl`
    setzen — das ist der Output der Spec-Stufe, nicht der Triage.
    **UI-Bezug-Entscheidung:** Der Analyse-Body-Block enthaelt das Feld `UI-Bezug: ja|nein` (siehe
    BODY-BLOCK-FORMAT oben). Bei **UI-Bezug: nein** (Nicht-UI-Ticket) setzt der Workflow
    `ai:needs-spec` — damit wird die UX-Beratungs-Phase ([ticket-ux.md](ticket-ux.md)) uebersprungen.
    Bei **UI-Bezug: ja** setzt der Workflow `ai:needs-ux-ui` — die UX-Phase laeuft als Phase 2 VOR
    der Spec und schreibt den KI-UX-Block.
  - **🟡 gelb / 🔴 rot →** **keinen** Phasen-Trigger (`ai:needs-ux-ui`/`ai:needs-spec`/`ai:needs-impl`)
    setzen — offene Fragen/Risiken klärt der Mensch und gibt ggf. von Hand frei. Trägt ein Issue beim
    **Re-Triage** bereits einen Phasen-Trigger, ist die Ampel aber auf 🟡/🔴 gekippt: ihn
    **automatisch entfernen**
    (`gh issue edit <nr> --remove-label "ai:needs-ux-ui" --remove-label "ai:needs-spec" --remove-label "ai:needs-impl"`),
    damit Spec/Umsetzung das Issue nicht unbeaufsichtigt aufgreifen (Race Condition), und im Ping-Kommentar
    (Schritt 4b) darauf hinweisen — die erneute Freigabe entscheidet der Mensch.
- Konsistenz zu Schritt 3: Bei Zerlegung werden 🟢-Sub-Issues nach derselben Regel direkt mit dem
  passenden Phasen-Trigger angelegt.

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
