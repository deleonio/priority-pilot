---
description: Analysiere ein offenes, nicht zugewiesenes GitHub-Issue gegen die Codebase
argument-hint: "[issue-nummer]"
allowed-tools: Bash(gh issue list:*), Bash(gh issue view:*), Read, Grep, Glob
---

Führe **Schritt 1 — Ticket analysieren** aus der Wissensbasis aus: @.ai-knowledge/ticket-triage.md

Ziel-Issue: $ARGUMENTS (leer = automatisch das älteste offene, nicht zugewiesene Issue).

Noch keinen Kommentar posten und kein Label setzen — dafür `/propose-solution` und `/mark-analyzed`.
