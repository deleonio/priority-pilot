---
description: Markiere ein GitHub-Issue als KI-analysiert (Label ai:analyzed)
argument-hint: "<issue-nummer>"
allowed-tools: Bash(gh label list:*), Bash(gh label create:*), Bash(gh issue edit:*)
---

Führe **Schritt 3 — Label setzen** aus der Wissensbasis aus, für Issue #$1:
@.ai-knowledge/ticket-triage.md

Setzt (und legt bei Bedarf an) das Label `ai:analyzed`.
