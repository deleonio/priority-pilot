## MEMORY LESEN — dein ALLERERSTER Schritt
Dein Memory liegt in `.claude/memory/` und hat ZWEI Ebenen. Workflow-Restore-Status: `#MEMORY_STATUS`.

1. `.claude/memory/MEMORY.md` — DAUERGEDÄCHTNIS, ticket-übergreifend, eingecheckt. IMMER ZUERST lesen, auch beim allerersten Lauf eines Tickets. Enthält Fehler früherer Läufe und was stattdessen funktioniert hat: mache diese Fehler NICHT nochmal und nutze die dort genannten Befehle/Lösungen.
2. `.claude/memory/issue-*.md` — Phasen-Notizen NUR zu diesem Ticket (flüchtig). Enthalten sie Notizen VORHERIGER Phasen/Läufe, SETZE DORT FORT, wo der letzte Lauf aufhörte (siehe dessen Abschnitt „Nächster Schritt") — wiederhole NICHTS, das schon unter „Erledigt" steht. Sind keine da (erste Phase oder Status „leer"), starte normal.
