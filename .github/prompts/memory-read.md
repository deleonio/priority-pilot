## MEMORY LESEN — dein ALLERERSTER Schritt
Dein Memory liegt in `.ai-memory/` und hat ZWEI Ebenen. Workflow-Restore-Status: `{{MEMORY_STATUS}}`.

1. `.ai-memory/MEMORY.md` — DAUERGEDÄCHTNIS, ticket-übergreifend, eingecheckt. IMMER ZUERST lesen, auch beim allerersten Lauf eines Tickets. Enthält Fehler früherer Läufe und was stattdessen funktioniert hat: mache diese Fehler NICHT nochmal und nutze die dort genannten Befehle/Lösungen.
2. Die Phasen-Notizen dieses Tickets (`.ai-memory/issue-*.md`) stehen bereits WÖRTLICH weiter unten im Prompt, im Block „KONTEXT AUS DEN VORHERIGEN PHASEN DIESES TICKETS". Du musst sie nicht nachlesen — sie sind geladen. Fehlt der Block, ist dies die erste Phase des Tickets; dann starte normal.

SO NUTZT DU DEN BLOCK: Er ist dein Ausgangspunkt, kein Beiwerk. Was dort unter „Erledigt" steht, machst du NICHT nochmal. Was unter „Verworfen" steht, probierst du NICHT erneut — der Grund steht dabei. „Relevante Stellen" ist deine Startliste. War die letzte Phase dieselbe wie deine, sind „Offen" und „Nächster Schritt" dein Auftrag.

MISSTRAUE DATEISTÄNDEN: Die Notizen können aus einer Phase auf einem anderen Branch stammen. Aussagen über Dateiinhalte gegenprüfen, bevor du darauf aufbaust — Entscheidungen, Annahmen und Verworfenes gelten dagegen weiter.
