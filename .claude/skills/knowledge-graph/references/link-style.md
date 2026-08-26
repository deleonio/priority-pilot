# Link-Stil (Wissensgraph)

Verbindliche Formate für alle Kanten im Geltungsbereich des Skills. Der Stil folgt dem
Bestand in `.ai-knowledge/` — dort nichts umstellen, nur fortführen.

## Grundregel

Relative Markdown-Links in GitHub-Syntax. Obsidian baut Graph View und Backlinks aus genau
diesen Links — dieselbe Kante wirkt in beiden Welten. Wiki-Links sind verboten, weil GitHub
sie nicht rendert.

## Formate mit Repo-Beispielen

Innerhalb eines Ordners (z. B. `.ai-knowledge/` → `.ai-knowledge/`):

```markdown
- Ticket-Ablauf: [Ticket-Umsetzung](ticket-implementation.md), Regeln: [Projekt-Konventionen](project.md#konventionen)
- Testumfang: [TDD-Strategie → Testumfang](tdd-strategy.md#testumfang--so-viel-wie-nötig-so-wenig-wie-irgend-möglich)
```

Zwischen Ordnern (z. B. `.ai-knowledge/` → `docs/`):

```markdown
- Begründung in [ADR 0001](../docs/adr/0001-github-workflows-bleiben-ungetestet.md)
- Konzept: [Testing](../docs/testing.md#4-abgrenzung)
```

Von `AGENTS.md`/`README.md` (Repo-Root) in Unterordner — Pfad mit Ordner:

```markdown
- [TDD-Strategie](.ai-knowledge/tdd-strategy.md) — test-getriebene KI-Workflows (Stufen 1+2+3 adoptiert)
```

## Anker-Regeln

Anker sind GitHub-Autoidentifikation der Zielüberschrift: kleingeschrieben, Leerzeichen →
Bindestriche, Satzzeichen außer Bindestrichen entfernt, Umlaute bleiben erhalten. Mehrfache
Bindestriche kollabieren nicht (`nötig-so` → `--so`).

- Überschrift `## Testumfang — so viel wie nötig, so wenig wie irgend möglich`
- Anker `#testumfang--so-viel-wie-nötig-so-wenig-wie-irgend-möglich`

Vor dem Setzen eines Ankers die Zieldatei lesen und den Anker aus der echten Überschrift
ableiten — nicht raten.

## Index-Eintrag in `AGENTS.md`

Eine Zeile pro `.ai-knowledge/`-Datei in der Wissensbasis-Liste (Anschnitt):

```markdown
- [Projekt & Aufbau](.ai-knowledge/project.md) — Zweck, Monorepo, Befehle, Datenbank
```

Gedankenstrich mit je zwei Leerzeichen, danach ein Hook aus 3–8 Worten, der sagt, was die
Datei liefert — nicht, wie sie heißt.

## Anti-Patterns

- `[[Wiki-Links]]` — GitHub rendert sie nicht, der Graph verliert die GitHub-Seite.
- Absolute Pfade (`/docs/…`) und URL-artige Repo-Pfade — sie brechen beim Lokal-Klon.
- Zeilennummern-Anker (`datei.md#L42`) — brechen bei jeder Änderung der Zieldatei.
- Links in Code-Blöcken und Inline-Code: ignorieren beim Prüfen, nie dort hinein setzen.
- Externe URLs (github.com, …): gehören nicht zum internen Graphen; beim Audit nicht prüfen.
- "Siehe auch"-Listen am Dateiende als Kanten-Ausweichlager — eine Kante gehört an die
  Textstelle, wo der Bezug entsteht, sonst hat sie keinen Informationswert.
