# PR 1129 — Review (Runde 1 Kreuzverhör + Runde 2 Fixup-Nachweis), Stand 2026-08-30

**ERGEBNIS: VERDICT reviewed (🟢, Runde 2).** Runde 1: needs-fixup (🟡, 2 Inline-Findings, „Review ohne Issue" — kein Closing-Issue, PR-Beschreibung massgebend). Runde 2 (Fixup-Nachweis): beide Findings korrekt behoben, keine neuen; Sammelkommentar id 5466533137 per PATCH aktualisiert (gleiche ID), Titel `docs: sync user guide with implemented state (2026-08-30)` weiterhin CC-konform. Keine Labels gesetzt.

## Erledigt (Runde 2)
- MODE per Marker-Suche: `<!-- ai-review -->` vorhanden → FIXUP VERIFICATION; Diff-Scope ab Runde-1-Kommentar (03:44:11Z): nur Fixup-Commit `8038a603` (docs/user-guide.md 4+/3-), Memory-Commit `443aa1dc` ([skip ci]) und Main-Merge `63cbdee8` (Net-Diff auf docs/user-guide.md = exakt die 2 Hunks, verifiziert per `git diff 1bbe45ca..63cbdee8 -- docs/user-guide.md`).
- Finding 1 geprüft: neue Formulierung „liegt eine Aufgabe näher als diese Entfernung, kommt ein Push-Hinweis" deckt `server/src/logics/geo-background-job.ts:92` (`<=`).
- Finding 2 geprüft: „trägt einen Ortsbezug (Adresse oder Koordinaten)" deckt `frontend/src/components/GeoBadge.tsx:81-83`.
- CI grün: verify pass, e2e 1–4 pass (nur der review-Job selbst pending); Threads laut Fixup-Notiz resolved.
- Sammelkommentar aktualisiert (Review-Status reviewed 🟢, Behobene-Anmerkungen-Tabelle mit Finding 1/2 → `8038a603`, Footer `Review-Typ: Fixup-Nachweis`, Updated 2026-08-30).

## Relevante Stellen
- `docs/user-guide.md:120-124` (Ortsbezug-Bullet) und `:417-422` (Alarm-Entfernung-Satz) — die beiden korrigierten Stellen.
- `server/src/logics/geo-background-job.ts:92`, `frontend/src/components/GeoBadge.tsx:81-83` — Belegstellen.
- `server/src/logics/user-guide.test.ts` — Vertragstest (Überschriften), grün.

## Annahmen
- PATCH-Response zeigt `updatedAt: null` (auch `.updatedAt` einzeln leer) — gh/API-Quirk; Update erfolgreich an Body-Zeile 1 verifiziert.
- Runde-1-Recherche (11 PR-Body-Funde + 2 Gegenproben) bleibt gültig, nicht wiederholt.

## Verworfen
- Neue Findings zur Formulierung („Das"-Umbruch-Zeile, Wortwiederholung „Ortsbezug … Ortsbezug") — Prettier-check grün laut Fixup-Notiz, inhaltlich korrekt, entspricht dem eigenen Review-Vorschlag aus Runde 1 → keine Pseudo-Findings.
- MEMORY.md-Eintrag — kein neues Fehlermuster.

## Offen
- Wegwarf-Artefakte NICHT committen: `.ai-memory/issue-1129-collected.md`, `.ai-memory/issue-1129-old-comment.md` (leerer Fehlgriff, Node-ID statt DB-ID) — diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Workflow übernimmt (Gate/Labels automatisch); keine Review-Aktion mehr offen.

## Fallstricke
- `gh pr view --json comments` liefert Node-IDs (`IC_…`), REST `issues/comments/<id>` will die numerische DB-ID (5466533137) — Node-ID gibt 404.
- `git diff <runde1-commit>..head` über einen Main-Merge explodiert (ganz main drin) — auf `-- docs/user-guide.md` scopen oder Fixup-Commit direkt zeigen.
- Finding-Nummern 1/2 blieben stabil; bei einer hypothetischen Runde 3 weiterführen.
