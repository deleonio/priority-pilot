# Workflow: Ticket-Spec (rote Tests vor der Umsetzung)

Schreibt für ein freigegebenes Ticket die **roten Tests** (ausführbarer Vertrag) aus den
Akzeptanzkriterien — **bevor** der Produktivcode entsteht. Werkzeug-unabhängig beschrieben; konkrete
Slash-Commands (z. B. unter `commands/`) verweisen nur auf diese Schritte.

Diese Stufe ist die **Gewaltenteilung** der TDD-Strategie (Stufe 3, siehe
[tdd-strategy.md](tdd-strategy.md)): Wer die Tests schreibt (dieser Workflow), schreibt **nicht** den
Code (die Umsetzung, [ticket-implementation.md](ticket-implementation.md)). So entstehen keine
tautologischen Tests, die nachträglich dem Code angepasst werden — die Tests sind der von einer
**anderen** Instanz festgelegte, einklagbare Vertrag.

Tickets = GitHub-Issues von `deleonio/priority-pilot`. Voraussetzung: `gh` ist authentifiziert.

**Auswahlkriterium:** Bearbeitet werden **offene** Issues mit Label `ai:spec-ready` (von der Triage
bei klarer Analyse 🟢 gesetzt, siehe [ticket-triage.md](ticket-triage.md) Schritt 5), für die **noch
kein** offener (Draft-)PR existiert (Idempotenz).

Label-Kette: `ai:analyzed` → **`ai:spec-ready` (dieser Workflow)** → `ai:ready` (Umsetzung) → PR.

## Schritt 1 — Ticket wählen & Branch anlegen

- Offene Issues mit `ai:spec-ready` finden (index-unabhängig, sofort konsistent):
  `gh issue list --state open --label "ai:spec-ready" --json number,title --jq '.[] | "\(.number)\t\(.title)"'`
- Eine konkret übergebene Nummer hat Vorrang; sonst der Reihe nach (ältestes zuerst).
- **Idempotenz:** Existiert bereits ein offener PR mit `Closes #<nr>` für das Issue, **nicht** erneut
  spezifizieren — der Vertrag steht schon. Lauf für dieses Issue beenden.
- Kontext + Analyse laden: den **Akzeptanzkriterien + Testfälle**-Block (Triage Schritt 4) primär aus
  dem **Body-Block** des Issues lesen (`gh issue view <nr> --json body -q .body`, Abschnitt zwischen
  `<!-- KI-ANALYSE:START … -->` und `<!-- KI-ANALYSE:END -->`). Fehlt der Body-Block (Alt-Issue),
  Fallback auf den jüngsten `🤖 KI-Analyse`-Kommentar (`gh issue view <nr> --comments`). Fehlt der
  AK-Block ganz, ist das Issue für die Spec-Stufe nicht reif: zurück an die Triage (Re-Triage), nicht
  raten.
- Branch von `main` anlegen (nicht auf `main`): `git switch -c feat/issue-<nr>-<kurzname>`.

## Schritt 2 — Rote Tests schreiben (der Vertrag)

- Je Akzeptanzkriterium den/die Testfälle als **echte, ausführbare** Tests schreiben — Testebene und
  Zieldatei nach Ticket-Typ (wie in der Triage festgelegt):
  - **Backend-Logik / API** → `node:test` (`server/src/logics/*.test.ts`,
    `server/src/express/*.test.ts`).
  - **Frontend-Logik** → Vitest (`frontend/src/lib/*.test.ts`).
  - **Feature / UI-Verhalten** → Akzeptanz-e2e (`frontend/e2e/*.spec.ts`, Stil `crud.spec.ts`).
  - **Reines Styling/Layout** → keinen Test erzwingen; im PR-Body begründen, dass/warum stattdessen
    visuell verifiziert wird (dann ggf. nur ein minimaler Smoke-Test).
  - **Reines Doku/Pattern-Konzept** (neue/erweiterte Markdown-Seite unter `docs/`, ohne dass Code
    entsteht) → **keinen Test schreiben**. Tests auf den Inhalt einer Markdown-Datei können per
    Konstruktion nichts prüfen, das nicht schon dasteht — sie sind reine Change-Detector-Strings
    („die Datei enthält den String, den ich hineingeschrieben habe") und fallen durch das
    Aufnahmekriterium der [TDD-Strategie → Testumfang](tdd-strategy.md#testumfang--so-viel-wie-nötig-so-wenig-wie-irgend-möglich).
    Stattdessen im PR-Body die Akzeptanzkriterien durchgehen und je AC belegen (Zitat/Link auf den
    Abschnitt), dass das Dokument es erfüllt. Der Review prüft die AC-Erfüllung im Text, nicht per
    Test. (Präzedenzfälle #549, #557 haben diese Pathologie etabliert und wurden zurückgebaut.)
- **Dedup vor dem Schreiben:** Per `grep` prüfen, ob ein Akzeptanzkriterium bereits durch einen
  bestehenden Test abgedeckt ist (Feature-/Funktionsnamen in den Test-Verzeichnissen). Bereits
  abgedeckt → **nicht** duplizieren, nur fehlende AKs testen. Widerspricht ein AK einem bestehenden
  Test (Anforderung geändert, Test obsolet)? → den **alten Test ENTFERNEN** (Datei löschen oder Test-Funktion entfernen) und im PR-Body im Abschnitt „Test-Pflege-Bedarf" benennen (Datei:Zeile + Begründung), **warum er entfernt wurde** (welches neue AK ihn obsolet macht). Die Entfernung ist Teil der Spec — kein Mensch muss nachentscheiden.
- **So wenig wie möglich, aber jeder mit Biss** ([tdd-strategy.md → Testumfang](tdd-strategy.md#testumfang--so-viel-wie-nötig-so-wenig-wie-irgend-möglich)):
  Ein Test muss etwas **auswerten**, einen **Spiegel** zwischen Dateien sichern oder vor einem
  **stillen/teuren** Ausfall schützen. Kein Test der Form „die Datei enthält den String, den ich
  hineingeschrieben habe" — der kann per Konstruktion nichts finden. Lieber drei Tests mit Biss als
  zwölf, die nur die Statistik füllen. Vor dem Commit die **Mutations-Probe**: das bewachte Verhalten
  absichtlich brechen; wird der Test nicht rot, gehört er nicht in den PR.
- **Red, nicht kaputt:** Jeder Test prüft echtes **Soll-Verhalten** und wird grün, sobald der
  Produktivcode existiert — nicht wegen eines Tippfehlers/falschen Fixtures rot. Bei **neuen**
  Funktionen ist ein fehlender Export/Import die legitime erste Rotfärbung; bei **bestehendem** Code
  zeigt `pnpm test` (bzw. das betroffene Package) die neuen Tests als **failing**.
- **Keinen Produktivcode** schreiben — nur Tests (höchstens minimale, verhaltensneutrale
  Test-Helfer/Fixtures). Die Tests beschreiben die **erwartete** Schnittstelle; sie zu erfüllen ist
  Aufgabe der Umsetzung.

## Schritt 3 — Commit, Push, Draft-PR

- Die roten Tests als **eigenen, ersten Commit** committen, z. B. `test: rote Spec-Tests für #<nr>`.
- Branch pushen: `git push -u origin <branch>`.
- **Draft-PR** erstellen — der Draft signalisiert „Vertrag steht, Implementierung fehlt noch":
  `gh pr create --draft --title "<titel> (#<nr>)" --body "… Closes #<nr> …"`. Body enthält: kurze
  Liste der abgedeckten Akzeptanzkriterien und den Hinweis „rote Spec-Tests; Implementierung folgt
  durch die Umsetzung ([ticket-implementation.md](ticket-implementation.md))".
- Verknüpfung prüfen: `gh pr view <pr> --json closingIssuesReferences --jq '.closingIssuesReferences[].number'`
  muss `<nr>` enthalten.

## Schritt 4 — Übergabe an die Umsetzung

- Am Issue **`ai:ready` setzen** und **`ai:spec-ready` entfernen** — damit greift die Umsetzung
  ([ticket-implementation.md](ticket-implementation.md), Schritt 1) den Draft-PR auf und macht die
  roten Tests grün, **ohne sie zu ändern**.
  - Label bei Bedarf vorher anlegen
    (`gh label create "ai:ready" --color 0E8A16 --description "Analyse klar; zur Umsetzung freigegeben"`),
    dann `gh issue edit <nr> --add-label "ai:ready" --remove-label "ai:spec-ready"`.

## Hinweise

- Branch/Push/PR/Labels schreiben **öffentlich** auf GitHub — vorher bestätigen lassen.
- Dieser Workflow schreibt **nur Tests**, **keinen** Produktivcode (das ist die Umsetzung). Das ist
  die bewusste Gewaltenteilung von Stufe 3 ([tdd-strategy.md](tdd-strategy.md)).
- **Bearbeitung durch `/team*`:** Lokal/per Command kann das Multi-Agent-Team die Spec übernehmen
  (Tester-Rolle schreibt die roten Tests). In GitHub Actions läuft die Spec als eigener headless
  Lauf (`spec.yml`) — getrennt vom Umsetzungs-Lauf, womit die Gewaltenteilung auch in der
  Automatik gilt (andere Instanz schreibt Tests vs. Code).
- Greift die Triage ein Issue bewusst **nicht** auf 🟢 (🟡/🔴), gibt es kein `ai:spec-ready` — dann
  entscheidet der Mensch (kein automatischer Spec-Lauf).
