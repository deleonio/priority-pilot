## MEMORY SCHREIBEN — PFLICHT, nicht optional (ein Folgelauf setzt NUR darüber fort)
Lege/aktualisiere die Datei `.ai-memory/issue-{{ISSUE_NR}}-{{PHASE}}.md` exakt in diesem Format:
  ## Erledigt         — was läuft / ran (mit Datei:Zeile)
  ## Offen            — was blockiert, inkl. Fehlermeldung/Ursache
  ## Nächster Schritt  — der EINE nächste Handgriff für den Folgelauf
  ## Fallstricke      — Entscheidungen, Annahmen, Dinge die leicht falsch laufen

TIMING (kritisch): ersten Stand SOFORT nach deiner Eingangs-Analyse schreiben. Vor JEDEM Soft-Deadline-Check aktualisieren. NIEMALS erst am Ende — ein Soft-Abort kommt vorher, und ohne Checkpoint ist der gesamte Fortschritt verloren. Ein Folgelauf MUSS ohne dein Zutun nahtlos weitermachen können.

## DAUERGEDÄCHTNIS FORTSCHREIBEN — `.ai-memory/MEMORY.md`
Das ist die eingecheckte, ticket-übergreifende Lern-Datei (nicht zu verwechseln mit der Phasen-Notiz oben). Sie wächst über alle Läufe hinweg weiter.

WANN (Aufnahmekriterium, streng — im Zweifel KEIN Eintrag): nur wenn ein ZUKÜNFTIGER Lauf an einem ANDEREN Ticket ohne diese Notiz denselben Fehler machen oder denselben Umweg gehen würde. Also: nicht-offensichtliche Fallstricke, Werkzeug-/CI-Eigenheiten, ein Befehl der nach mehreren Fehlversuchen funktionierte. NICHT hierher gehören: was in diesem Ticket passiert ist (→ Phasen-Notiz), was schon in AGENTS.md/.ai-knowledge/ steht, Selbstverständlichkeiten, Erfolgsmeldungen. Die meisten Läufe schreiben hier GAR NICHTS — das ist der Normalfall, kein Versäumnis.

WAS: genau eine Zeile, Format
  `- YYYY-MM-DD · <Bereich> — <was schiefging> → <Lösung>.`
Den Befehl, der funktioniert hat, in Backticks mit hineinnehmen, falls einer im Spiel war.

WIE: ANS ENDE des Abschnitts `## Learnings & Erfahrungen` anhängen. Bestehende Zeilen NIEMALS umschreiben, umsortieren oder löschen — die Datei mergt per `union` aus `.gitattributes`, das trägt nur bei reinem Anhängen.

WER: nur Phasen, deren Auftrag ohnehin Committen einschliesst (Spec, Umsetzung, Fixup). Der Eintrag reist im NORMALEN Phasen-Commit mit — kein eigener Commit, kein Push auf main. Committest du in dieser Phase nicht (Triage, UX, Review), dann schreibe den Kandidaten stattdessen unter `## Fallstricke` in deine Phasen-Notiz; eine spätere Phase zieht ihn hoch.

KURATIERUNG: max. ~40 Einträge. Ist die Datei voll oder ein Learning zur festen Regel geworden → nach `.ai-knowledge/conventions.md` überführen und die Zeile hier entfernen (das ist die EINE erlaubte Ausnahme vom Nicht-Umschreiben, und nur als bewusster Aufräum-Schritt).
