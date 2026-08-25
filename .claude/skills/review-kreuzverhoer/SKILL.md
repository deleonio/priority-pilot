---
name: review-kreuzverhoer
description: "PR-Kreuzverhör — Pull Requests adversarial reviewen, Findings als Inline-Kommentare posten, Ampel-Urteil im ai-review-Sammelkommentar. Nutzen bei „review PR <Nr>“, „prüf/kreuzverhöre diesen PR“, Re-Review nach Fixup. CI-Phase 5/7 arbeitet mit derselben Methode (CI-Prompt: CI.md neben dieser Datei)."
allowed-tools: Read, Grep, Glob, Bash(gh *)
---

# PR-Kreuzverhör (Review von Pull Requests)

Prüft einen Pull Request **kritisch wie im Kreuzverhör**. Diese Datei ist die kanonische Methode
für lokale/manuelle Reviews — die CI-Review-Phase (5/7) setzt sie über den operativen Prompt
`CI.md` (neben dieser Datei) um.

PRs = Pull Requests von `deleonio/priority-pilot`. Voraussetzung: `gh` ist authentifiziert.

**Auswahlkriterium:** Geprüft wird ein konkret übergebener PR; ohne Angabe der zuletzt
geöffnete/aktualisierte offene PR (bzw. der aktuell per `Session-Fortsetzung` abonnierte PR).

## Haltung

Hinterfrage jede Annahme, jede Entscheidung, jeden Kompromiss – schonungslos und systematisch,
konstruktiv aber **adversarial**, statt Offensichtliches abzunicken. Belege statt Bauchgefühl:
jeder Punkt mit konkretem Datei-/Zeilenbezug.

- **Ast für Ast** durch den Entscheidungsbaum arbeiten. Baut eine Entscheidung auf einer anderen
  auf, zuerst die Grundlage klären.
- Nicht lockerlassen, bis auf jedem Punkt Übereinstimmung besteht.
- Fragen, die sich per eigener Recherche oder aus vorhandenen Informationen selbst beantworten
  lassen, **selbst beantworten** — nur fragen, was sich nicht selbst herausfinden lässt.

## Schritt 1 — PR verstehen

- Titel, Beschreibung und **vollständigen Diff** lesen:
  `gh pr view <pr> --json title,body,files,additions,deletions` und `gh pr diff <pr>`.
- Verknüpftes Ticket laden (Soll-Verhalten): die `closingIssuesReferences` des PR auflösen
  (`gh pr view <pr> --json closingIssuesReferences`) → `gh issue view <nr> --json body,comments`.
  Die **Akzeptanzkriterien** der Triage primär aus dem **Body-Block** lesen (Abschnitt zwischen
  `<!-- KI-ANALYSE:START … -->` und `<!-- KI-ANALYSE:END -->`); fehlt er (Alt-Issue), Fallback auf den
  jüngsten `🤖 KI-Analyse`-Kommentar. Die übrigen Kommentare bleiben Kontext (Dialog/Pings).
- Zielzustand klären: Welches Problem soll der PR lösen, und woran ist „fertig" erkennbar?

## Schritt 2 — Kreuzverhör (kritische Fragen)

Den Diff gegen diese Fragen prüfen:

- **Löst er das Problem?** Erfüllt die Änderung das im Ticket/in der Beschreibung genannte Ziel — ganz?
- **Edge Cases:** leere/sehr große Eingaben, Fehlerpfade, Grenzwerte, `null`/`undefined`, Nebenläufigkeit.
- **Einfachster Weg?** Geht es simpler? Unnötige Komplexität, Doppelung, toter Code, Über-Abstraktion?
- **Performance:** vermeidbare O(n²)-Schleifen, N+1-Queries (Sequelize), unnötige Allocations/Re-Reads.
- **Security:** Eingabevalidierung, Injection (SQL/Pfad), Secrets im Code, fehlende AuthZ-Prüfungen.
- **Regression/Obsoleszenz:** Macht die Änderung bestehende Tests oder Verhalten **außerhalb des
  Diffs** obsolet oder widerspricht sie ihnen (Anforderung geändert)? **Hinweis:** Obsolete Tests sollten bereits in der Spec-Stufe entfernt worden sein (ticket-spec.md). Falls trotzdem noch ein Widerspruch auffällt → als Finding benennen („Test-Pflege-Bedarf" mit Datei/Zeile) — nicht still hinnehmen, aber auch nicht selbst ändern (Anpassung/Entfernung entscheidet der Mensch bzw. ein Folge-Spec).
- **KoliBri-First bei UI-Änderungen** ([conventions.md](../../../.ai-knowledge/conventions.md)): Eigenes Styling ohne KoliBri-Alternative?
  Im Zweifel via `mcp__kolibri-mcp__search` nach Alternativen suchen. Fehlende Begründung der
  Eigene-Styling-Entscheidung im PR-Body ist ein Finding.

## Schritt 3 — Code-Qualität

- **Benennung & Lesbarkeit:** sprechende Namen, klare Funktionsschnitte, Kommentare nur wo nötig.
- **Tests (Pflicht-Gate):** Sind die Akzeptanzkriterien des Tickets durch **grüne** Tests abgedeckt?
  Decken sie die neuen Pfade und Edge Cases ab? Ist die test-getriebene Reihenfolge erkennbar (Tests
  als eigener/erster Commit, vgl. [ticket-implementation](../ticket-implementation/SKILL.md) Schritt 3)?
  **Fehlende Tests für ein Akzeptanzkriterium oder rote Tests verhindern ein 🟢** (Ausnahme: reines
  Styling/Layout, im PR begründet). Bei **Spec-PRs** (Stufe 3) zusätzlich: Wurden die **roten
  Spec-Tests aus dem ersten Commit unverändert grün** gemacht? Aufgeweichte/gelöschte oder dem Code
  angepasste Spec-Tests sind ein **Gewaltenteilungs-Bruch** → kein 🟢, außer eine Test-Korrektur ist
  im PR begründet zurückgemeldet und freigegeben.
- **Test-Substanz statt Test-Menge** ([tdd-strategy.md → Testumfang](../../../.ai-knowledge/tdd-strategy.md#testumfang--so-viel-wie-nötig-so-wenig-wie-irgend-möglich)):
  Viele Tests sind kein Qualitätsmerkmal. Bei jedem neuen Test gegenprüfen, ob er überhaupt scheitern
  **kann** — Tests, die nur bestätigen, dass eine Datei den selbst geschriebenen String enthält, sind
  ein Finding („tautologischer Test"), kein Pluspunkt. Ebenso ein Finding: ein All-Quantor („für alle
  X gilt…") ohne Absicherung, dass die geprüfte Menge nicht leer ist.
- **Projekt-Konventionen** ([conventions.md](../../../.ai-knowledge/conventions.md)): Tabs, `strict`, ESM mit `.js`-Importen,
  keine Type-Assertions zum Unterdrücken von Fehlern, genau eine zentrale Prettier-Config.
- **Mobile-First bei UI-Änderungen** ([conventions.md](../../../.ai-knowledge/conventions.md)): neue `@media`-Regeln als
  `min-width` (Aufwärts-Kaskade), kein `max-width`-Downgrade vom Desktop aus. Breite Tabellen/Grids ohne
  schmale Alternative auf Handy-Breite prüfen (horizontales Scrollen des Kerninhalts vermeiden). Fehlt
  bei sichtbarer UI-Änderung ein 375px-Viewport-e2e-Test (siehe `login.spec.ts` AK5,
  `task-tree.spec.ts` AK-6 als Muster), ist das ein Finding — Ausnahme nur, wenn im PR begründet.
- **Impeccable-Audit bei UI-PRs** (#828): Bei Änderungen unter `frontend/` das Kreuzverhör um
  `/impeccable audit` (Skill in `.claude/skills/impeccable/`) ergänzen — fünf Dimensionen
  (Accessibility, Performance, Theming, Responsive, Implementation Integrity, je 0-4). Der
  Detektor (`node .claude/skills/impeccable/scripts/detect.mjs <dateien…>`, Exit 2 = Findings)
  liefert deterministische Belege statt Vermutungen; False Positives im Kontext verifizieren und
  als solche benennen.
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

### Einen KI-Sammelkommentar pflegen (Konsolidierung statt Duplikate)

Über die Fixup-Schleife (`ai:needs-review` → Review → `ai:needs-changes` → Fixup → …) läuft der
Kreuzverhör mehrfach am selben PR. Damit sich **nicht jede Runde ein neuer Kommentar** ansammelt und
der PR unübersichtlich wird, pflegt der Review **genau einen** zusammenfassenden KI-Sammelkommentar
pro PR — er wird fortgeschrieben statt dupliziert. (Die inline-an-Zeile verankerten Findings aus
Schritt 4 bleiben davon unberührt — sie lassen sich nicht so dedupliziert fortschreiben und veralten
ohnehin mit dem Diff; konsolidiert wird der **Sammelkommentar** mit dem Urteil.)

- **Markerbasierte Identifikation:** Der Sammelkommentar trägt als erste Zeile einen versteckten
  HTML-Marker `<!-- ai-review -->`, an dem er in Folge-Runden wiedergefunden wird.
- **Suchen statt blind anlegen:** Vor dem Posten den **bestehenden** markierten Kommentar des KI-Bots
  **per API suchen** — robuster als `gh pr comment --edit-last`, weil zwischenzeitlich andere
  Bots/Menschen kommentiert haben können (so vom Owner bestätigt):
  `gh api repos/{owner}/{repo}/issues/<pr>/comments` und nach `<!-- ai-review -->` filtern.
- **Update statt Neuanlage:** Wird ein markierter Kommentar **gefunden**, ihn **aktualisieren/
  fortschreiben** (`gh api --method PATCH repos/{owner}/{repo}/issues/comments/<id> -f body=…`) — die
  Comment-ID bleibt dabei gleich. Wird **nicht gefunden** (existiert noch kein markierter Kommentar),
  ihn **einmalig neu anlegen** (`gh pr comment` mit dem Marker als erster Zeile).
- **Diff-Scoping bei Folge-Review (Kosten-/Zeitersparnis):** Wird ein bestehender Sammelkommentar
  gefunden (Folge-Review nach einem Fixup-Push), NICHT den kompletten PR-Diff erneut komplett
  durchgehen. Stattdessen dessen `updatedAt`-Zeitstempel aus der API-Antwort auslesen und nur die
  Commits/den Diff **seit diesem Zeitpunkt** prüfen (`gh pr view --json commits` gefiltert auf
  `committedDate > updatedAt`, darauf `git diff`) — bereits in „Behobene Anmerkungen" geführte Punkte
  nicht erneut aufrollen. Ticket-Kontext und Architektur-Berührpunkte bleiben dabei im Blick (nicht
  rein diff-lokal urteilen). Fehlt der markierte Kommentar (Erstreview), immer den vollständigen Diff
  prüfen (Schritt 1 bleibt unverändert).
- **Struktur des Sammelkommentars** (Status-Zeile, dann Abschnitte nach Bedarf):
  - **🎯 Review-Status** — Zeile 2 (nach dem Marker): `reviewed | needs-fixup | needs-human`
    plus 1–2 Sätze Kontext (Modus, Runde, Ergebnis).
  - **✅ Behobene Anmerkungen** — eine **History-Tabelle** der über die Runden bereits
    erledigten Findings (Spalten: **#** | Finding | Behoben via | **Datum**). Beim
    Fortschreiben wandern erledigte Punkte dorthin, sodass die historische Sicht erhalten
    bleibt, was schon behandelt wurde.
  - **⏸️ Entscheidungs-Findings** — nur bei needs-human: Pro Finding Nummer `<F>` (stabil
    über Runden), Was/Wo, 2–3 Optionen JE mit stabiler Options-ID `` `<F>.<n>` `` (z. B.
    `4.1`) und Aufwand/Risiko, Empfehlung mit ID und Begründung. Abschließend die
    **Auswahl-Zeile**: Der Mensch antwortet per Kommentar mit der Options-ID und setzt
    `ai:needs-fixup` (Umsetzung) bzw. `ai:needs-review` (Akzeptieren) — das Fixup setzt die
    gewählte Option um, ohne neu zu bewerten.
  - **📋 Offene Findings** — nur bei needs-fixup: die Punkte der **aktuellen** Runde (mit
    Ampel, Datei/Zeile, Vorschlag).
  - **Footer** — `Review-Typ: Kreuzverhör | Fixup-Nachweis` und `Updated: JJJJ-MM-TT`.

**CI-/Quality-Gate als Vorbedingung:** Ein grünes Inhalts-Urteil (🟢) ist **notwendig, aber nicht
hinreichend** für `ai:ready-to-merge` — die Pflicht-Checks (CI: Format/Lint/Build/Test) müssen
ebenfalls grün sein. In der GitHub-Actions-Pipeline übernimmt das ein deterministischer
Gate/Auto-Merge-Workflow (`.github/workflows/pr-gate-merge.yml`): Ist nach Abschluss
mindestens einer der Allowlist-Checks **CI** oder **Reviewer** rot, setzt er `ai:needs-changes` und
stößt damit den Fixup an — `ai:ready-to-merge` wird erst vergeben, wenn beide grün sind (sind beide
grün und `ai:ready-to-merge` gesetzt, mergt derselbe Workflow den PR). Manuell (dieser Skill) gilt
dieselbe Regel: bei rotem CI nicht auf 🟢 abschließen.

## Hinweise

- Posten von Review/Kommentaren schreibt **öffentlich** auf GitHub — vorher bestätigen lassen.
- Knapp und konkret bleiben; jeden Punkt an Code-Zeilen verankern und begründen.
- Reiner Review: **kein** Produktivcode ändern oder committen.
- In Coding-Agent lässt sich der PR per `Session-Fortsetzung` abonnieren — neue Commits/CI-/Review-
  Events landen dann direkt in der Session (Re-Review nach Fixes).
