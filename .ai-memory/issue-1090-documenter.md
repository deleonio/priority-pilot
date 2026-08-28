## Erledigt
- `/tmp/doc.json` geschrieben, `jq .` grün (Classification `internal`, Titel leer = compliant, 5 files, 1 issue).
- PR-Daten gelesen: `gh pr view 1094 --json title,body,files,labels,author`, diff per `gh pr diff 1094`.
- Titel-Compliance geprüft: `ci(prompts): remove skill duplicates from phase prompts (#1090)` — 64 Zeichen, CC-Format, EN, lowercase → leer gelassen.
- Files: 5 Prompt-Dateien (ausschließlich .github/prompts/*.md), Byte-Differenzen aus PR-Body-AK5-Tabelle.
- .ai-memory/issue-1090-{implement,review,triage}.md sind ADR-0007-Phasen-Notizen, nicht funktionell relevant → nicht in files-Liste.

## Relevante Stellen
- `.github/prompts/spec.md` — Rang-2-Kürzungen (Schritte 2/3/5 → SKILL-Referenzen).
- `.github/prompts/ux.md` — Rang-3-Kürzungen (Schritt 4, ux-not-ready, Blockstruktur).
- `.github/prompts/implement.md` — Rang-4-Kürzungen (Schritt 2, Idempotenz, Schritt 5).
- `.github/prompts/review.md` — Rang-5-Kürzungen (Entscheidungs-Klammer, Review-ohne-Issue, Step 2/2.5).
- `.github/prompts/documenter.md` — Rang-6-Kürzung (Rules-Kurzform → SKILL-Verweis).

## Annahmen
- „title compliant = true" vom Aufrufer bedeutet: bestehender Titel ist konform → Feld `title` bleibt leer.
- Byte-Differenzen in file-notes sind aus der PR-Body-Tabelle AK5 übernommen (nicht selbst aus dem Diff berechnet).

## Verworfen
- `.ai-memory/`-Dateien in die files-Liste aufnehmen — ADR-0007-Artefakte, nicht Teil der fachlichen Änderung.

## Offen
- -

## Nächster Schritt
- - (Documenter ist die letzte Phase; Issue kann geschlossen werden.)

## Fallstricke
- -
