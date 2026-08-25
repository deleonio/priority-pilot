FOKUS: NUR Issue {{ISSUE_NR}}. NUR rote Tests je Akzeptanzkriterium (mit Dedup), kein Produktivcode. KEINE Abstecher. Token sparen: kurz, präzise, direkt.

⚠️ KI-UX-Block: Falls das Issue UX-Aspekte hat (KI-UX:END-Block im Issue-Body vorhanden), UX-Anforderungen aus diesem Block bei der Spec-Ableitung beachten.

Methode, Test-Konzept und Regeln (verbindlich, hier nicht wiederholt): .claude/skills/ticket-spec/SKILL.md — lies sie vor dem ersten Test.

{{RESUME_HINT}}

ABLAUF (STRIKT):
  1. SOFORT starten.
  2. Fortsetzungs-Hinweis (oben) prüfen:
     - Falls gesetzt (Draft-Wiederverwendung): BESTEHENDEN Branch auschecken
       (git fetch origin && git switch $DRAFT_BRANCH). NICHT neuen Branch anlegen.
       Bestehende Commits/Tests ansehen (git log, gh pr view), Stand verstehen.
       Weiterarbeiten auf bestehendem Stand — NICHT alles neu schreiben.
     - Falls NICHT gesetzt (Neu-Lauf): Neuen Branch anlegen:
       git switch -c feat/issue-{{ISSUE_NR}}-<kurzname>.
     Akzeptanzkriterien primär aus BODY-BLOCK des Issues entnehmen:
     gh issue view {{ISSUE_NR}} --json body -q .body (Abschnitt zwischen <!-- KI-ANALYSE:START --> und <!-- KI-ANALYSE:END -->).
  3. SPEC-FIRST — Spezifikation VOR Test-Ableitung aktualisieren (Regel: SKILL.md Schritt 2):
     docs/spec/*.md prüfen, existierenden erweitern oder neuen anlegen, im gleichen Commit wie die Tests.
  4. ROTE Tests schreiben — aus dem Spec abgeleitet (Regelwerk inkl. Dedup, Mutations-Probe,
     Spec-PR-Scope: SKILL.md Schritt 3 — lies den Abschnitt, bevor du den ersten Test schreibst).
  5. Rote Tests als ERSTEN Commit (test: rote Spec-Tests für {{ISSUE_NR}}), Branch pushen.
     DRAFT-PR erstellen (gh pr create --draft) mit Closes #{{ISSUE_NR}} im Body. KEIN ai:needs-review setzen.

⚠️ LABELS: KEINE Labels setzen! Workflow übernimmt das automatisch.

VERDICT: GANZ AM ENDE GENAU EINE Zeile, NUR der Token — kein Text dahinter (der Workflow parst die Zeile maschinell):
  - VERDICT: ready
  - VERDICT: spec-partial
  (ready = rote Tests geschrieben + Draft-PR erstellt → gibt Issue zur Umsetzung frei;
   spec-partial = Partial – Tests unvollständig, braucht Folgelauf)

EHRLICHKEITS-REGEL: VERDICT: ready NUR ausgeben, wenn Draft-PR tatsächlich existiert UND mindestens eine Test-Datei committed+gepusht ist (vorher mit gh pr view/git log verifizieren).

ZEITLIMIT: Soft-Deadline = {{SOFT_DEADLINE}}. Vor jedem Schritt: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. Bei OVER: aktuellen Stand committen+pushen als Draft-PR, Turn beenden.