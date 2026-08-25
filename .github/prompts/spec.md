FOKUS: NUR Issue {{ISSUE_NR}}. NUR rote Tests je Akzeptanzkriterium (mit Dedup), kein Produktivcode. KEINE Abstecher. Token sparen: kurz, präzise, direkt.

⚠️ KI-UX-Block: Falls das Issue UX-Aspekte hat (KI-UX:END-Block im Issue-Body vorhanden), UX-Anforderungen aus diesem Block bei der Spec-Ableitung beachten.

{{RESUME_HINT}}

ABLAUF (STRIKT):
  1. SOFORT starten.
  2. Fortsetzungs-Hinweis (Zeile 5) prüfen:
     - Falls gesetzt (Draft-Wiederverwendung): BESTEHENDEN Branch auschecken
       (git fetch origin && git switch $DRAFT_BRANCH). NICHT neuen Branch anlegen.
       Bestehende Commits/Tests ansehen (git log, gh pr view), Stand verstehen.
       Weiterarbeiten auf bestehendem Stand — NICHT alles neu schreiben.
     - Falls NICHT gesetzt (Neu-Lauf): Neuen Branch anlegen:
       git switch -c feat/issue-{{ISSUE_NR}}-<kurzname>.
     Akzeptanzkriterien primär aus BODY-BLOCK des Issues entnehmen:
     gh issue view {{ISSUE_NR}} --json body -q .body (Abschnitt zwischen <!-- KI-ANALYSE:START --> und <!-- KI-ANALYSE:END -->).
  3. SPEC-UPDATE (zuerst! SPEC-FIRST – spezifikation.*vor.*test – Spezifikation aktualisieren VOR Test-Ableitung):
     - Prüfen, ob ein relevanter Spec bereits existiert: ls docs/spec/*.md
     - FALLS JA (z.B. user-journeys.md für Feature-Änderungen): Existierenden Spec erweitern/korrigieren/kürzen – dokumentiere das Verhalten, das getestet werden soll.
     - FALLS NEIN: Neuen Spec docs/spec/issue-{{ISSUE_NR}}.md anlegen – strukturiert nach Ziel/Vorbedingung/Schritte/Erwartetes Ergebnis (siehe user-journeys.md als Format-Referenz).
     - Spec-Update im gleichen Commit wie die Tests (nicht separater Commit – Spec gehört zur Spec-Phase).
  4. ROTE Tests schreiben – abgeleitet aus dem Spec (nicht direkt aus den Akzeptanzkriterien). Jedes AK muss durch den Spec gedeckt sein. JEDER Test muss auf den Spec oder ein Akzeptanzkriterium Bezug nehmen; vor dem Schreiben prüfen: Ist dieses Verhalten im Spec gedeckt?
     TEST-KONZEPT (verbindlich, NICHT hier wiederholt): .ai-knowledge/ticket-spec.md Schritt 2 — Testebenen-Zuordnung nach Ticket-Typ, Nicht-Anwendungscode-Carve-out (ADR 0001), VORAB-Dedup inkl. Entfernen obsoleter Tests, Aufnahmekriterium „mit Biss" und Mutations-Probe vor dem Commit. Lies den Abschnitt, bevor du den ersten Test schreibst.
     Bei UI-Tickets: geplante KoliBri-Komponenten (Custom-Element + Properties) via KoliBri-MCP verifizieren, damit Tests die richtigen Elemente adressieren.
     SPEC-PHASE-ARTEFAKTE: Der Spec-PR (3/6) darf NUR docs/spec/*.md und rote Tests enthalten — KEINE Implementierung (weder Produktivcode noch CSS noch Config). Implementation ist Phase 4. Jede App-Code-Änderung (frontend/src/**, server/src/**, auch CSS!) gehört in den IMPLEMENTIERUNGS-PR, nicht in den Spec-PR. Falls während der Spec-Phase App-Code/Änderungen nötig sind (z.B. CSS für Story-Backing), im WORKSPACE-Kommentar notieren — Phase 4 nimmt diese Anforderung auf.
     Bei Confirm-/Lösch-/Zerstör-Dialogen: Tests an docs/ux-pattern-sequential-confirmation.md orientieren – sequenzielle Ja/Nein-Schritte, verbindliches Fokus-Management beim Übergang.
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
