# Issue-Template ticket.yml hat doppelte Feld-IDs

**Stand:** 2026-09-09

## Ziel

`.github/ISSUE_TEMPLATE/ticket.yml` enthält jede Feld-`id` genau einmal, in der Reihenfolge
`problem`, `scope`, `expected`, `area`, `complexity`, `criteria`, `context`.

## Voraussetzungen

- Datei ist gültiges GitHub-Issue-Formular-YAML.
- Kein Anwendungscode betroffen (`.github/ISSUE_TEMPLATE/**` liegt außerhalb von
  `server/src/**`, `frontend/src/**`, `frontend/e2e/**`).

## Schritte und erwartetes Ergebnis

### AK1/AK2/AK3 — Jede Feld-ID genau einmal, richtige Reihenfolge

`grep -n 'id:' .github/ISSUE_TEMPLATE/ticket.yml` liefert genau sieben Treffer:
`problem`, `scope`, `expected`, `area`, `complexity`, `criteria`, `context` — in dieser
Reihenfolge, keine ID doppelt.

### AK4 — Gültiges YAML, 8 Body-Einträge

`python3 -c "import yaml; d=yaml.safe_load(open('.github/ISSUE_TEMPLATE/ticket.yml')); assert len(d['body'])==8"`
läuft ohne Fehler (1 Markdown-Intro + 7 Felder).

### AK5 — Nur Löschungen, keine inhaltliche Änderung

`git diff -- .github/ISSUE_TEMPLATE/ticket.yml` zeigt ausschließlich `-`-Zeilen (17 Zeilen:
der zweite `scope`-Block Z. 81-90 inkl. Leerzeile davor, der zweite `context`-Block
Z. 112-118), keine `+`-Zeile.

### AK6 — `required`-Flags unverändert

`problem`, `scope`, `expected`, `criteria` bleiben `required: true`; `area`, `complexity`,
`context` bleiben `required: false`.

## Testverfahren

Reine Config-Datei außerhalb von Anwendungscode → laut Testkonzept (SKILL.md
„Non-application code … → write no test", ADR 0001: ein String/YAML-Match ist ein
Change-Detector ohne Biss) **kein automatisierter Test**. Nachweis der ACs erfolgt über die
oben genannten `grep`/`python3`/`git diff`-Befehle, deren Ausgabe im PR-Body dokumentiert
wird. Die im Ticket genannten Formular-Kriterien (Formular öffnet fehlerfrei, Testticket
besteht `verify-issue-quality.sh`) sind erst nach Merge auf dem Default-Branch prüfbar
(GitHub rendert Issue-Formulare nur von dort) — Sichtprüfung durch den PO nach dem Merge,
nicht Teil der PR-Abnahme.
