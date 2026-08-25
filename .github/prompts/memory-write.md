## MEMORY SCHREIBEN — PFLICHT, nicht optional

Du schreibst für ZWEI Leser: den Folgelauf DERSELBEN Phase (falls du abbrichst) und die NÄCHSTE Phase dieses Tickets. Der zweite ist der wichtigere — was du hier nicht hinterlässt, erarbeitet die nächste Phase auf Kosten des Tickets nochmal.

Lege/aktualisiere die Datei `.ai-memory/issue-{{ISSUE_NR}}-{{PHASE}}.md` exakt in diesem Format:
  ## Erledigt          — was läuft / ran (mit Datei:Zeile)
  ## Relevante Stellen — die Dateien/Funktionen, um die es geht, je EIN Halbsatz warum
  ## Annahmen          — worauf du dich verlässt, ohne es bewiesen zu haben
  ## Verworfen         — was du geprüft und NICHT genommen hast, mit Grund
  ## Offen             — was blockiert, inkl. Fehlermeldung/Ursache
  ## Nächster Schritt  — der EINE nächste Handgriff für den Folgelauf
  ## Fallstricke       — Entscheidungen und Dinge, die leicht falsch laufen

`Relevante Stellen`, `Annahmen` und `Verworfen` sind der teure Teil und der eigentliche Zweck. Ein „geprüft, geht nicht, weil …" spart der nächsten Phase den kompletten Umweg. Leere Abschnitte mit `-` füllen, nicht weglassen.

SCHREIB FÜR JEMANDEN OHNE DEINEN KONTEXT: Die nächste Phase läuft womöglich auf einem anderen Modell und sieht dein Transkript nie. „wie besprochen", „der Ansatz von vorhin" oder „siehe oben" sind dort wertlos. Nenne Dateien, Zeilen und Namen.

DATEISTÄNDE ALTERN: Was du über Dateiinhalte schreibst, kann in der nächsten Phase überholt sein (anderer Branch, zwischenzeitliche Commits). Schreib Aussagen prüfbar — Datei:Zeile plus was dort stand — nicht als Tatsache über den aktuellen Stand.

TIMING (kritisch): ersten Stand SOFORT nach deiner Eingangs-Analyse schreiben. Vor JEDEM Soft-Deadline-Check aktualisieren. NIEMALS erst am Ende — ein Soft-Abort kommt vorher, und ohne Checkpoint ist der gesamte Fortschritt verloren. Ein Folgelauf MUSS ohne dein Zutun nahtlos weitermachen können.

## DAUERGEDÄCHTNIS FORTSCHREIBEN — `.ai-memory/MEMORY.md`
Das ist die eingecheckte, ticket-übergreifende Lern-Datei (nicht zu verwechseln mit der Phasen-Notiz oben). Sie wächst über alle Läufe hinweg weiter.

WANN (Aufnahmekriterium, streng — im Zweifel KEIN Eintrag): nur wenn ein ZUKÜNFTIGER Lauf an einem ANDEREN Ticket ohne diese Notiz denselben Fehler machen oder denselben Umweg gehen würde. Also: nicht-offensichtliche Fallstricke, Werkzeug-/CI-Eigenheiten, ein Befehl der nach mehreren Fehlversuchen funktionierte. NICHT hierher gehören: was in diesem Ticket passiert ist (→ Phasen-Notiz), was schon in AGENTS.md/.ai-knowledge/ steht, Selbstverständlichkeiten, Erfolgsmeldungen. Die meisten Läufe schreiben hier GAR NICHTS — das ist der Normalfall, kein Versäumnis.

WAS: genau eine Zeile, Format
  `- YYYY-MM-DD · <Bereich> — <was schiefging> → <Lösung>.`
Den Befehl, der funktioniert hat, in Backticks mit hineinnehmen, falls einer im Spiel war.

WIE: ANS ENDE des Abschnitts `## Learnings & Erfahrungen` anhängen. Bestehende Zeilen NIEMALS umschreiben, umsortieren oder löschen — die Datei mergt per `union` aus `.gitattributes`, das trägt nur bei reinem Anhängen. EINZIGE Ausnahme: ein Eintrag ist nachweislich FALSCH, also ein Lauf hat das Gegenteil belegt. Dann korrigiere ihn und schreib den Beleg dazu — ein falsches Learning richtet mehr Schaden an als gar keines, weil ihm jeder Folgelauf glaubt.

WER: nur Phasen, deren Auftrag ohnehin Committen einschliesst (Spec, Umsetzung, Fixup). Der Eintrag reist im NORMALEN Phasen-Commit mit — kein eigener Commit, kein Push auf main. Committest du in dieser Phase nicht (Triage, UX, Review, Documenter), dann schreibe den Kandidaten stattdessen unter `## Fallstricke` in deine Phasen-Notiz; eine spätere Phase zieht ihn hoch.

KURATIERUNG: max. ~40 Einträge. Ist die Datei voll oder ein Learning zur festen Regel geworden → nach `.ai-knowledge/conventions.md` überführen und die Zeile hier entfernen (bewusster Aufräum-Schritt).
