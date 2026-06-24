# Workflow: PR-Kreuzverhör (Review von Pull Requests)

Prüft einen Pull Request **kritisch wie im Kreuzverhör** — werkzeug-unabhängig beschrieben. Konkrete
Slash-Commands (z. B. unter `.claude/commands/`) verweisen nur auf diese Schritte.

PRs = Pull Requests von `deleonio/priority-pilot`. Voraussetzung: `gh` ist authentifiziert.

**Auswahlkriterium:** Geprüft wird ein konkret übergebener PR; ohne Angabe der zuletzt
geöffnete/aktualisierte offene PR (bzw. der aktuell per `subscribe_pr_activity` abonnierte PR).

**Haltung:** konstruktiv, aber **adversarial** — jede Annahme hinterfragen statt Offensichtliches
abzunicken. Belege statt Bauchgefühl: jeder Punkt mit konkretem Datei-/Zeilenbezug.

## Schritt 1 — PR verstehen

- Titel, Beschreibung und **vollständigen Diff** lesen:
  `gh pr view <pr> --json title,body,files,additions,deletions` und `gh pr diff <pr>`.
- Verknüpftes Ticket laden (Soll-Verhalten): die `closingIssuesReferences` des PR auflösen
  (`gh pr view <pr> --json closingIssuesReferences`) → `gh issue view <nr> --comments`.
- Zielzustand klären: Welches Problem soll der PR lösen, und woran ist „fertig" erkennbar?

## Schritt 2 — Kreuzverhör (kritische Fragen)

Den Diff gegen diese Fragen prüfen:

- **Löst er das Problem?** Erfüllt die Änderung das im Ticket/in der Beschreibung genannte Ziel — ganz?
- **Edge Cases:** leere/sehr große Eingaben, Fehlerpfade, Grenzwerte, `null`/`undefined`, Nebenläufigkeit.
- **Einfachster Weg?** Geht es simpler? Unnötige Komplexität, Doppelung, toter Code, Über-Abstraktion?
- **Performance:** vermeidbare O(n²)-Schleifen, N+1-Queries (Sequelize), unnötige Allocations/Re-Reads.
- **Security:** Eingabevalidierung, Injection (SQL/Pfad), Secrets im Code, fehlende AuthZ-Prüfungen.

## Schritt 3 — Code-Qualität

- **Benennung & Lesbarkeit:** sprechende Namen, klare Funktionsschnitte, Kommentare nur wo nötig.
- **Tests (Pflicht-Gate):** Sind die Akzeptanzkriterien des Tickets durch **grüne** Tests abgedeckt?
  Decken sie die neuen Pfade und Edge Cases ab? Ist die test-getriebene Reihenfolge erkennbar (Tests
  als eigener/erster Commit, vgl. [ticket-implementation.md](ticket-implementation.md) Schritt 3)?
  **Fehlende Tests für ein Akzeptanzkriterium oder rote Tests verhindern ein 🟢** (Ausnahme: reines
  Styling/Layout, im PR begründet). Bei **Spec-PRs** (Stufe 3) zusätzlich: Wurden die **roten
  Spec-Tests aus dem ersten Commit unverändert grün** gemacht? Aufgeweichte/gelöschte oder dem Code
  angepasste Spec-Tests sind ein **Gewaltenteilungs-Bruch** → kein 🟢, außer eine Test-Korrektur ist
  im PR begründet zurückgemeldet und freigegeben.
- **Projekt-Konventionen** ([conventions.md](conventions.md)): Tabs, `strict`, ESM mit `.js`-Importen,
  keine Type-Assertions zum Unterdrücken von Fehlern, genau eine zentrale Prettier-Config.
- **Format/Lint:** Sind `pnpm format`/`pnpm lint` in der PR-Beschreibung belegt? Bei Zweifel nachhaken.

## Schritt 4 — Findings als Review-Kommentare posten

Pro Finding **ein konkreter, an Datei/Zeile verankerter Kommentar** — jeweils mit:

1. **Was** ist das Problem / die Frage (präzise, nicht vage).
2. **Warum** es zählt (Auswirkung: Bug, Risiko, Wartbarkeit, Performance …).
3. **Konkreter Vorschlag** zur Verbesserung (idealerweise mit Code-/Suggestion-Block).

- Gebündelt als **ein Review** mit inline verankerten Kommentaren posten, Event **`COMMENT`** (kein
  `APPROVE`/`REQUEST_CHANGES`): `gh api repos/{owner}/{repo}/pulls/<pr>/reviews` mit `event=COMMENT`,
  `body` (Zusammenfassung) und je Finding einem Eintrag in `comments[]` (`path`, `line`, `body`).
  Einzelne Kommentare alternativ über `repos/{owner}/{repo}/pulls/<pr>/comments`.
- **Kein** formales Approve/Request-Changes — der Merge bleibt beim Menschen.

## Schritt 5 — Zusammenfassendes Urteil mit Ampel

Review-Body (deutsch) mit **Ampel** am Anfang:

- 🟢 **solide** — keine relevanten Findings **und die Akzeptanzkriterien sind durch grüne Tests
  abgedeckt**: knappe Bestätigung, was gut gelöst ist.
- 🟡 **im Kern ok** — Nachbesserungen empfohlen: die Punkte gebündelt nennen.
- 🔴 **grundlegende Probleme** — löst das Ziel nicht / Bug / Sicherheits- oder Architekturproblem.

Danach die wichtigsten Findings als kurze Liste; Details stehen in den Inline-Kommentaren.

**CI-/Quality-Gate als Vorbedingung:** Ein grünes Inhalts-Urteil (🟢) ist **notwendig, aber nicht
hinreichend** für `ai:ready-to-merge` — die Pflicht-Checks (CI: Format/Lint/Build/Test) müssen
ebenfalls grün sein. In der GitHub-Actions-Pipeline übernimmt das ein deterministischer
Gate-Workflow (`.github/workflows/claude-pr-gate.yml`): Ist nach Abschluss mindestens einer der
Allowlist-Checks **CI** oder **Reviewer** rot, setzt er `ai:needs-changes` und stößt damit den Fixup
an — `ai:ready-to-merge` wird erst vergeben, wenn beide grün sind. Manuell
(`/kreuzverhoer-review`) gilt dieselbe Regel: bei rotem CI nicht auf 🟢 abschließen.

## Hinweise

- Posten von Review/Kommentaren schreibt **öffentlich** auf GitHub — vorher bestätigen lassen.
- Knapp und konkret bleiben; jeden Punkt an Code-Zeilen verankern und begründen.
- Reiner Review: **kein** Produktivcode ändern oder committen.
- In Claude Code lässt sich der PR per `subscribe_pr_activity` abonnieren — neue Commits/CI-/Review-
  Events landen dann direkt in der Session (Re-Review nach Fixes).
