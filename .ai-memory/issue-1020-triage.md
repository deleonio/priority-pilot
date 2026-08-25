# Triage #1020 — UX/UI Erledigte Aufgaben (Tabellen-Layout)

## Erledigt
- Issue gelesen (Titel „UX/UI - Erledigte Aufgaben", Body: Header kurz/lesbar, Spaltenbreiten ggf. em, seitliches Scrollen out-of-the-box). Kein KI-ANALYSE-Block → Erst-Triage.
- Code-Recherche abgeschlossen (2026-08-25): CompletedTasksTable.tsx komplett gelesen, app.css-Block 1524–1650 gesichtet, TaskTable.tsx:173 als KolTable-Muster identifiziert.
- Titel optimiert, Body lektoriert + Analyse-Block in Body (gh issue edit --body-file), Ping-Kommentar, VERDICT: analyzed (🟡).

## Relevante Stellen
- `frontend/src/components/CompletedTasksTable.tsx` — DIE Komponente des Tickets. Wichtig: native `<table>`, bewusst NICHT KolTable (Kommentar Z. 26–34: 375px ohne horizontales Scrollen, AK-6/#228). Header: „Titel", je Säule `pillar.name`, „Aktion" (Z. 71–78).
- `frontend/src/app.css:1524–1650` — `.completed-tasks*`-Blöcke; <48rem Karten-Modus (thead visuell versteckt, `td[data-label]::before` als Beschriftung, Z. 1586; Media-Query ab Z. 1593). Ab 48rem klassische Tabelle.
- `frontend/src/components/TaskTable.tsx:173` — Vorbild, falls Umstieg auf KoliBri gewünscht: `KolTableStateful` mit `_data/_headers/_fixedCols={[0,1]}`.
- `frontend/e2e/completed-tasks.spec.ts` (+ done-toggle, done-auto-remove) — dürfen nicht brechen.
- `frontend/src/components/Dashboard.test.tsx` — einziger Test-Ort für CompletedTasksTable (kein eigenes *.test.tsx gefunden, grep 2026-08-25).

## Annahmen
- Issue meint mit „KolTable" die Tabelle der erledigten Aufgaben allgemein (Nutzer-Sicht), nicht wörtlich die KoliBri-Komponente — Code nutzt native Tabelle.
- Keine Zerlegung: ein Anliegen (Layout einer Komponente), 1 PR machbar.

## Verworfen
- Zerlegung in Sub-Issues — nur eine Schicht (Frontend CSS/Header), zusammengehörig.
- Bild-Analyse des Screenshots — analyze_image-Aufruf lieferte leer; Ticket-Text war ausreichend spezifisch.
- Explore-Subagent — kam ohne brauchbares Ergebnis zurück; direktes Grep war schneller (CompletedTasksTable.tsx gleich eindeutig).

## Offen
- AUFRÄUMEN: `.ai-memory/tmp-1020-comment.md` löschen (rm wurde von Sandbox abgelehnt; liegt dort harmlos, gitignored).
- Zielkonflikt für UX-Phase: „seitlich scrollen out-of-the-box" vs. AK-6/#228 (Karten-Modus <48rem, explizit KEIN horizontales Scrollen bei 375px). Vorgeschlagene Auflösung im Analyse-Block: Scroll-Container erst ab ≥48rem, Karten-Modus bleibt.
- Wie kurz sollen Säule-Header werden (Kürzel? Abkürzung? title-Attribut?) —UX-Entscheidung.

## Nächster Schritt
- UX-Phase: Entwurf Header-Kürzung + Spaltenbreiten-System (em) + Scroll-Container ab 48rem; danach Spec (Vitest + e2e, Bounding-Box-Messung wegen overflow-x:hidden-Shell, s. MEMORY 2026-08-24).

## Fallstricke
- `.completed-tasks-table`-CSS ist Teil des #228-Karten-Modus — Media-Query-Struktur nicht brechen, sonst fallen Mobile-e2e.
- app.css wird von vielen Komponenten geteilt; Selektoren sind klassen-scoped, trotzdem nur .completed-tasks*-Blöcke anfassen.
- `gh issue comment --body "…"` mit deutschen Anführungszeichen („…") zerbrach in 7 Args („accepts 1 arg(s), received 7") — wie MEMORY 2026-08-24 bei `gh pr create`: Body per Write in Datei, dann `--body-file`.
- Sandbox lehnt `rm` und Compound-`{ …; }` mit Quotes ab → Schritte einzeln, Cleanup dem Folgelauf überlassen.
- Memory-Kandidat fürs DAUERGEDÄCHTNIS: der gh-comment/Unicode-Quote-Punkt ist bereits von MEMORY 2026-08-24 (gh pr create --body-file) gedeckt — kein neuer Eintrag nötig.
