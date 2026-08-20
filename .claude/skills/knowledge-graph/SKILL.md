---
name: knowledge-graph
description: >-
  Nutze, wenn Repo-Dokumentation verlinkt, der Wissensgraph gepflegt, tote Links geprüft, verwaiste Dokumente gefunden oder der AGENTS.md-Index aktualisiert werden soll — auch automatisch bei jeder Änderung an .ai-knowledge/, docs/ oder AGENTS.md, selbst wenn nicht ausdrücklich nach dem Graphen gefragt wird. Trigger: "Wissensgraph", "Graph", "Obsidian", "verlinke die Doku", "Link-Check", "Index aktualisieren". Nicht für Code-Analyse oder UI-Arbeit.
version: 1.0.0
user-invocable: true
argument-hint: "[audit · verlinde · index] [ziel]"
---

# Knowledge Graph

Dieses Repo ist gleichzeitig ein Obsidian-Vault (Repo-Root). Die Dokumentation bildet einen
Wissensgraphen: Obsidians Graph View und Backlinks lesen dieselben relativen Markdown-Links, die
GitHub rendert. Dein Job ist es, diesen Graphen konsistent zu halten — sinnvolle Kanten setzen,
tote Kanten entfernen, keine Inseln, aktueller Index. Der Graph ist Zweitzweck-Nutzung: Er muss
ohne Obsidian genauso funktionieren (GitHub, Editor, Pipeline-Kontext).

## Geltungsbereich

- `.ai-knowledge/**`
- `docs/**` (lose Dateien, `adr/`, `spec/`)
- `AGENTS.md` und `README.md`

Alles andere bleibt außen vor: Code, Workflows, Prompts, Konfiguration, die Package-READMEs
(`server/`, `client/`, `frontend/`) und Repo-Metas (`CONTRIBUTING.md` usw.). Obsidian-interne
Dateien (`.obsidian/**`, `*.canvas`, `*.base`) niemals anfassen — das ist der persönliche Bereich
des Nutzers.

Interne Links aus Geltungsbereich-Dateien auf Ziele außerhalb (z. B. `server/README.md`) prüfst
du trotzdem auf Existenz — ein toter Link bleibt tot, egal wohin er zeigt. Dorthin wird aber
nichts zurückverlinkt und kein Index gepflegt.

## Link-Stil

Lies vor jeder Link-Arbeit [references/link-style.md](references/link-style.md). Dort stehen
Formate, Anker-Regeln und Anti-Patterns mit Repo-Beispielen. Kurzform: relative Markdown-Links im
bestehenden Stil der Datei, niemals `[[Wiki-Links]]` (GitHub rendert sie nicht).

## Modus: inkrementell (läuft automatisch mit)

Wenn du eine Datei im Geltungsbereich bearbeitest oder neu anlegst, ohne dass dieser Skill
explizit aufgerufen wurde:

1. **Neue Datei** → ergänze einen Eintrag in der Wissensbasis-Liste in `AGENTS.md`. Format wie
die bestehenden Zeilen: Link, Gedankenstrich, ein Kurz-Hook, was die Datei liefert.
2. **Bearbeitete Datei** → prüfe ihre Links: Existiert jede Zieldatei noch? Passt der Anker noch
zur Überschrift? Tote Links sofort korrigieren oder entfernen — ein toter Link ist schlimmer
als kein Link.
3. **Echte Querbezüge setzen** → wenn die Änderung einen thematischen Bezug zu einer anderen
Geltungsbereich-Datei hat, verlinke sie an der Stelle, wo der Bezug entsteht. Die Kante muss
vom Inhalt her begründet sein, nicht vom Thema bloß ähnlich.

Der inkrementelle Modus läuft **im Schlusscheck** der eigentlichen Aufgabe ab — er ersetzt die
Aufgabe nicht und erweitert sie nicht um Voll-Audits.

## Modus: `audit`

Voll-Prüfung des Graphen. Lese alle Geltungsbereich-Dateien, dann erhebe in dieser Reihenfolge:

1. **Tote Links:** Jeder interne Markdown-Link (Zieldatei + Anker) — existiert das Ziel?
Externe URLs werden nicht angefasst.
2. **Inseln:** Dateien im Geltungsbereich ohne einen einzigen eingehenden Link aus anderen
Geltungsbereich-Dateien. `README.md` als Einstiegspunkt, `docs/spec/issue-*.md` als
historisches Ticket-Archiv und neue, noch unverbundene Dateien sind **erwartbare Inseln** —
bewerte, bevor du algo-artig alles verdrahtest.
3. **Fehlende Kanten:** Paare, die inhaltlich aufeinander Bezug nehmen sollten, aber nicht
verlinkt sind. Nur Kanten nennen, die ein Leser wirklich folgen würde.
4. **Index-Abgleich:** Jede Geltungsbereich-Datei aus `.ai-knowledge/` hat einen Eintrag in der
`AGENTS.md`-Liste — und jeder Listeneintrag zeigt auf eine existierende Datei.

Dann wende die Fixes minimalinvasiv an: tote Links korrigieren/entfernen, fehlende Kanten setzen,
Index angleichen, Inseln nur verbinden, wo ein echter Bezug besteht. Berichte am Ende kompakt:
was du geändert hast und welche Findings du bewusst **nicht** behoben hast (mit je einem Satz
Begründung).

## Modus: `verlinde [ziel]`

Gezielt für eine Datei oder ein Thema Querverweise finden: Datei lesen, verwandte
Geltungsbereich-Dateien identifizieren, Kanten an den Stellen setzen, wo der Bezug im Text
entsteht. Auch hier gilt: nur Kanten mit echtem Informationswert.

## Modus: `index`

Nur der `AGENTS.md`-Abgleich aus dem Audit (Punkt 4), ohne Link-Prüfung.

## Kernregeln

- **Minimalprinzip:** Jede Zeile ist Wartungslast. Eine Kante entsteht nur, wenn ein Leser ihr
folgen würde, um etwas zu verstehen, das im Text gerade relevant wird. Kein Link-Spam, keine
"Siehe auch"-Sammlungen ohne konkreten Anlass.
- **Verlinken, nicht umschreiben:** Du ergänzt Links und Index-Einträge — du formulierst keine
Absätze um, um Verlinkbarkeit zu erzwingen.
- **Kein Stil-Bruch:** Relative Markdown-Links, GitHub-Anker, deutscher Text wie in der
jeweiligen Datei. Keine Wiki-Links, keine absoluten Pfade, keine Frontmatter-Migration.
- **Bestandsschutz:** Vorhandene, funktionierende Links bleiben stehen, auch wenn eine andere
Formulierung schöner wäre.
- **Berichtspflicht:** Jeder Lauf endet mit einer kurzen Zusammenfassung der Änderungen. Ein
Lauf ohne Änderungen endet mit "Graph konsistent" — kein Herbeizaubern von Arbeit.