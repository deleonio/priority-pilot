# Triage Issue #1021 — Bilder aus Issues/PRs entfernen (Documenter)

## Erledigt
- Issue #1021 gelesen: Erst-Triage, keine Kommentare, Label ai:needs-analyse.
- Architektur aufgenommen: 06-claude-pr-documenter.yml — Claude schreibt NUR /tmp/doc.json
  (.github/prompts/documenter.md:1,43), ALLE Schreibzugriffe macht deterministisch
  .github/scripts/pr-doc-render.sh (Workflow-Kommentar Zeilen 8-12, Render-Step Zeile 316-328).
- Entscheidung: Bildentfernung gehört in den RENDER-Schritt (deterministisch), NICHT in den
  Claude-Prompt (dessen Constraint verbietet PR-Edits explizit).
- Titel optimiert + Body lektoriert + KI-ANALYSE-Block in Body angehängt (gh issue edit).

## Relevante Stellen
- .github/scripts/pr-doc-render.sh — der Skript, der erweitert wird; Kommentar-PATCH-Muster
  Zeile 295-302 (`gh api repos/$REPO/issues/$PR/comments?per_page=100`, PATCH issues/comments/$id).
- .github/workflows/06-claude-pr-documenter.yml — Render-Step Zeile 316; Muster für
  Closing-Issue-Auflösung Zeile 283 (`gh pr view --json closingIssuesReferences`).
- .github/scripts/*.test.ts — node:test-Muster für Skript-Tests (z. B. label-transition.test.ts).
- .github/prompts/documenter.md — bewusst NICHR geändert (bleibt schreibfrei).

## Annahmen
- "Bilder entfernen" = ersetzen durch Platzhalter (z. B. `[Bild entfernt – Datenschutz]`), nicht
  Löschen ganzer Kommentare — Nachvollziehbarkeit + GitHub-API erlaubt Edit einfacher als Delete.
- "Issues und PRs" = der dokumentierte PR (Body + Kommentare) + seine verknüpften Issues
  (Body + Kommentare) zum Documenter-Laufzeitpunkt. KEIN einmaliger Backfill aller historischen
  Issues (wäre separates Ticket, im Analyse-Block als Ausbaustufe vermerkt).
- Bilder = Markdown `![alt](url)` inkl. github.com/user-attachments/assets/* und data:-URIs;
  HTML-<img>-Tags optional mit abdecken.

## Verworfen
- Umsetzung im Claude-Prompt (documenter.md): verworfen — Prompt-Constraint verbietet jegliche
  PR-Schreibzugriffe; deterministische Regel-Logik gehört laut Workflow-Kommentar in Skripte.
-needs-human: nicht nötig — Interpretationsraum über Code-Architektur aufgelöst (siehe Annahmen).

## Offen
- -

## Nächster Schritt
- VERDICT spec-ready setzen; Umsetzung/Spec-Phase liest den KI-ANALYSE-Block im Issue-Body.

## Fallstricke
- KI-ANALYSE-Blöcke in Issue-Bodies dürfen durch die Bild-Entfernung NICHT beschädigt werden
  (nur Bild-Referenzen ersetzen, Rest byte-identisch) — sonst bricht die Re-Triage der Issues.
- pr-doc-render.sh hat Fallback-Pfad bei fehlendem doc.json — Bildentfernung muss unabhängig
  davon laufen (Datenschutz-Ziel), aber Render-Gesamtverhalten nicht brechen.
- Idempotenz: ai:documented-Precheck verhindert Re-Runs — Ersetzung muss auch bei
  workflow_dispatch-Catch-up sicher sein.
- Memory-Kandidat (nicht selbst committen, Triage committet nicht): falls zukünftig Tickets
  "LLM soll X am PR ändern" stellen — erst prüfen, ob die Phase einen deterministischen
  Render-Schritt hat; dann dort einbauen statt Prompt ändern.
