# UX/UI-Audit — August 2026

Erst-Audit der laufenden App gegen die Design-Sprache [„Cockpit"](../.ai-knowledge/ux-design.md) und
die [Mobile-UI-Regeln](mobile-ui-rules.md).

**Methode:** Inspect-Instanz (`pnpm ui:inspect`, In-Memory-DB mit Demo-Seed) im Chromium,
Screenshots und Messungen je Hauptansicht bei **375×812** und **1280×900**, hell und dunkel; dazu
statische Prüfung von `frontend/src` gegen die Komponenten- und Token-Regeln.

**Was in Ordnung ist** — die mechanischen Mobile-First-Zusicherungen halten durchgehend:

- Kein horizontales Scrollen auf keiner geprüften Ansicht (`scrollWidth == innerWidth == 375`,
  Dashboard/Aufgaben/Serien/Wald).
- Alle 11 Bedienelemente auf 375px erfüllen 44×44px (kleinster Wert: 44×44).
- Alle Kopf-Aktionen tragen einen Accessible Name („Neuen Task anlegen", „Säulen-Berater", …).

Die Befunde liegen woanders: **Aussehen, Informationsdichte und Hierarchie** — und ein
Dunkelmodus, der nie zu Ende gebaut wurde.

Priorität: **P1** = kaputt oder unbenutzbar · **P2** = widerspricht der Design-Sprache spürbar ·
**P3** = Feinschliff.

---

## P1 — kaputt

### P1-1 Dunkelmodus: schwarze Schrift auf dunkler Fläche — **behoben**

Gemessen: **1.34:1** (gefordert 4.5:1) für „Nächste Aufgabe" und „Was ist jetzt dran?".
Ursache: `.dashboard-next-task` / `.dashboard-suggestions` / `.pillar-item` setzten den Hintergrund
auf ein `--pp-*`-Token, die Textfarbe aber nicht — im KoliBri-Umfeld (KolTabs/KolCard) erbt der Text
dort Schwarz. Der Fehler war rein visuell, kein Test schlug an.

Behoben in `frontend/src/app.css` (Fläche und Textfarbe reisen zusammen), gemessen jetzt **12.94:1**,
festgenagelt durch `frontend/e2e/dark-mode-contrast.spec.ts` (Mutations-Probe: ohne den Fix rot mit
`rgb(0, 0, 0) auf rgb(30, 36, 44)`).

### P1-2 Dunkelmodus ist ein Flickenteppich

Die App-Fläche wird dunkel, die KoliBri-Komponenten bleiben hell: Karten (Gesamt/Offen/Erledigt),
der Tab-Bereich und die Säulen-Meter rendern weiter auf Weiß, während Kopfzeile und Panels dunkel
sind. `@public-ui/theme-default` reagiert nicht auf unser `data-theme`.
Das Ergebnis wirkt nicht wie ein Dunkelmodus, sondern wie ein Darstellungsfehler.

Nötig ist eine Entscheidung: entweder ein eigenes KoliBri-Theme-Objekt, das die `--pp-*`-Tokens
konsumiert (Registrierung in `frontend/src/main.tsx`), oder Host-Level-CSS für die eingesetzten
`kol-*`-Elemente. Bis dahin bleibt der Dunkelmodus unfertig.
Betroffen: `frontend/src/main.tsx`, `frontend/src/app.css`.

### P1-3 `--filter priority-pilot` zeigte ins Leere — **behoben**

Die Umbenennung des Server-Pakets (`priority-pilot` → `server`, Commit `6677acd`) ließ **20**
Aufrufe in Doku, Skripten und CI ohne Treffer laufen. `pnpm` meldet dabei nur „No projects matched"
und endet mit **Exit-Code 0** — die Fehler waren also unsichtbar. Betroffen waren unter anderem
`pnpm ui:inspect` (der ganze Browser-MCP-Weg), das E2E-Backend in `frontend/playwright.config.ts`
und das **Coverage-Gate** in `ci.yml`/`cron.ci.multi-provider.yml`.

Während dieses Audits lief, hat #841 (Issue #839) die **ausführbaren** Stellen auf `--filter server`
umgestellt. Offen geblieben war die **Dokumentation** — sieben Dateien
(`AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `server/README.md`, `frontend/README.md`,
`.ai-knowledge/project.md`) nannten weiter den toten Filter, und
genau dort schlagen Menschen und Agenten die Befehle nach. Das ist hier nachgezogen; `server/README.md`
trug zusätzlich den falschen Paketnamen in der Überschrift.

---

## P2 — widerspricht der Design-Sprache

### P2-1 Das Dashboard hat keine Hauptaussage

„Nächste Aufgabe" ist die Antwort, für die es die App gibt — sie sieht aus wie jedes andere graue
Kästchen: gleiche Schriftgröße, keine Signalfarbe, **keine Aktion**. Daneben wiederholt „Was ist
jetzt dran?" dieselbe Aufgabe ein zweites Mal.
Soll (ux-design.md §1): eine Hauptaussage je Ansicht, in `--pp-signal`, mit der offensichtlichen
Folgehandlung („Jetzt starten"/„Erledigt") — und die Wiederholung fällt weg.
Betroffen: `frontend/src/components/Dashboard.tsx`, `app.css` (`.dashboard-next-task`, `.dashboard-suggestions`).

### P2-2 Die Aufgabenliste zeigt keine Priorisierung

Der Tab „Aufgaben" listet nur Titel + „…"-Menü — kein Wert, keine Priorität, kein Status, keine
Säule, kein Fälligkeitsdatum, bei über 1000px Zeilenbreite. Eine App, die priorisiert, zeigt in
ihrer Hauptliste nichts von der Priorisierung. Zwei gleichnamige Einträge („Task 3") sind zudem
nicht unterscheidbar.
Betroffen: `frontend/src/components/TaskTree.tsx`, `TaskTable.tsx`.

### P2-3 Falsche Hierarchie der Aktionen

Auf dem Aufgaben-Tab ist „Filtern" die einzige primäre (dunkle) Schaltfläche und damit das stärkste
Element der Seite; die Hauptaktion „Neuen Task anlegen" steckt als Icon in der Kopfzeile. Auch die
roten „579 Tage überfällig"-Marken dominieren das Dashboard optisch stärker als die nächste Aufgabe.
Regel: genau **eine** primäre Aktion je Ansicht, und sie gehört zur Hauptaussage.

### P2-4 Säulen ohne Farbe, Meter ohne Aussage

Alle fünf Säulen heißen „Suboptimal", zeigen 0 % und tragen keine Farbe — obwohl Aufgaben und Werte
vorhanden sind. Die kategoriale Rampe `--pp-pillar-1…8` (validiert, in beiden Farbschemata) wird
nirgends genutzt. Zusätzlich ist „Suboptimal" als Dauerurteil über alle Lebensbereiche eine
fragwürdige Ansage.
Betroffen: `frontend/src/components/Dashboard.tsx`, `PillarList.tsx`.

### P2-5 Der „Wald" ist eine Textwüste

Die Priorisierungs-Ansicht — das Herzstück — ist eine eingerückte Liste in Fließtext, ohne visuelle
Kodierung des Wertbeitrags, ohne Baumlinien, ohne Interaktion. Rang und Wert sind nur durch Lesen
erschließbar.
Betroffen: `frontend/src/components/ForestPanel.tsx`, `TaskTree.tsx`.

### P2-6 Rohes HTML statt KoliBri

Gegen die Komponententabelle (ux-design.md §4) stehen in `frontend/src/components`: **9** rohe
`<button>`, **5** rohe `<input>`, **2** rohe `<table>`, dazu rohe `<h1>`/`<h3>` statt `KolHeading`.
Jede Stelle braucht entweder die KoliBri-Komponente oder einen Kommentar mit Grund.

### P2-7 Tab-Leiste bricht auf 375px unschön um

„Wald" rutscht allein in eine zweite Zeile und wirkt abgehängt (Screenshot mobil). Kein Overflow,
aber sichtbar ungeplant — auf Handy-Breite braucht die Navigation eine eigene Form.
Betroffen: `frontend/src/App.tsx`, `app.css` (`.app-tabs`).

---

## P3 — Feinschliff

- **P3-1 Doppelte Überschrift:** aktiver Tab „Dashboard" + `<h1>Dashboard` direkt darunter.
- **P3-2 Unbeschrifteter Knopf** neben der Dashboard-Überschrift („KI-Modell auswählen", nur Icon,
  ohne sichtbaren Bezug zum Kontext).
- **P3-3 Leeres Layoutfeld:** auf Desktop klafft zwischen „Wichtigste Tasks" und „Gesamtguthaben"
  eine große Leerfläche (Grid mit ungleich hohen Spalten).
- **P3-4 Deadline-Zeilen** brechen auf 375px unruhig um (Titel zweizeilig, Marke und Datum gedrängt).
- **P3-5 Toggle „Erledigte Aufgaben anzeigen"** zeigt ein ✗-Symbol im Knauf und liest sich wie ein
  Fehlerzustand.
- **P3-6 `app.css` (1426 Zeilen)** setzt Abstände, Schriftgrößen und Radien frei statt über die neuen
  Skalen-Tokens — schrittweise migrieren, wenn eine Regel ohnehin angefasst wird.

---

## Wie es weitergeht

P1-1 und P1-3 sind in diesem Stand behoben. Alles Übrige gehört als Issue in die bestehende
Label-Pipeline: Die UX-Beratung (Phase 2) prüft jedes UI-Ticket gegen
[docs/mobile-ui-rules.md](mobile-ui-rules.md) und die Design-Sprache, die Spec-Phase gießt die
Anforderungen in rote 375px-Tests. Empfohlene Reihenfolge: **P1-2** (Dunkelmodus zu Ende bauen) →
**P2-1/P2-3** (Hauptaussage und Aktionshierarchie) → **P2-2/P2-5** (Priorisierung sichtbar machen) →
**P2-4** (Säulenfarben) → Rest.
