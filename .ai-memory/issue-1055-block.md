

---

<!-- KI-ANALYSE:START stand=2026-08-27T05:19:18Z -->
### Umsetzungskontext
- **Scope-Entscheid (aus Autor-Kommentar):** Es wird EINE granulare wertvolle Optimierung umgesetzt — Hebel 1 der ticket-eigenen Rangfolge: **review.md auf Referenzen trimmen** (~1,2 kB von 5,2 kB, größter Einzelhebel des Audits). Die Hebel 2–7 des Audits bleiben offen und sind NICHT Teil dieses Tickets.
- Betroffene Dateien: `.github/prompts/review.md` (einzige Änderung); Referenz-Ziel: `.claude/skills/review-kreuzverhoer/SKILL.md`
- Betroffene Komponenten: CI-Prompt der Review-Phase (Workflow 05), operationalisiert die review-kreuzverhoer-Methode.
- Vorhandenes Muster: `review.md` L39 referenziert die Sammelkommentar-Struktur bereits korrekt („SKILL.md section ‚Struktur des Sammelkommentars' — reuse it from there, not repeated here") — exakt dieses Muster ist die Vorlage. Verifizierte Referenz-Ziele: SKILL.md Step 2 (L42 ff., inkl. Regression/Test-Pflege-Bedarf L52 und KoliBri-first-Bullet L53), Step 5 (L102 ff., inkl. Diff-Scoping updatedAt/committedDate/git diff L134–139).
- Randbedingungen (dürfen nicht brechen): MODE-Erkennung mit Marker-Strings (L6–8), Closing-Issue-Logik (L12–14), TITLE GATE (L32), LABEL-BAN (L43), beide Verdict-Kanäle mit exakten Tokens `reviewed`/`needs-fixup`/`needs-human` + `/tmp/claude-verdict` (L49–59), Sammelkommentar-Vertrag „EXACTLY ONE `<!-- ai-review -->`" (L38–41), Soft-Deadline-Check (L45). Das SKILL.md ist laut Prompt L1 Pflichtlektüre → Referenz statt Wiederholung verliert keine Information.
- Erwartetes Ergebnis: review.md um vier redundante Passagen kürzer, jede ersetzt durch einen Einzeiler-Verweis auf SKILL.md Step 2/Step 5; Verhalten der Review-Phase unverändert.
- **Kein Anwendungscode** (nur `.github/prompts/**`) → spec-Phase übersprungen, keine Testfälle (Begründung für Routing `spec: nein`).

### Akzeptanzkriterien
- AK1: Vier redundante Passagen sind je durch einen Kurzverweis ersetzt: (a) Kreuzverhör-Fragen + Regression-Absatz (L15–16) → „Cross-examination questions incl. regression/Test-Pflege-Bedarf: SKILL.md step 2."; (b) KoliBri-first-Block 2.5 (L17–20) → „KoliBri-first: SKILL.md step 2."; (c) Fixup-Modus Schritte 2–5 (L25–29) → Delta-Review-Verweis auf SKILL.md step 5 (nur Fixup-Diff + neue Probleme, offene Findings abhaken); (d) VERDICT-Einleitung (L49–52) → „VERDICT — ORDER: first the collected comment (inkl. Entscheidungs-Findings), then the verdict channels (otherwise the PR gets stuck)."
- AK2: Alle CI-funktionalen Inhalte aus den Randbedingungen überleben unverändert (per grep prüfbar): `<!-- ai-review -->`-Vertrag, MODE-Erkennung, TITLE GATE, LABEL-BAN, Verdict-Tokens `reviewed`/`needs-fixup`/`needs-human`, `/tmp/claude-verdict`, Soft-Deadline-Zeile.
- AK3: Jeder neu gesetzte Verweis benennt ein real existierendes Ziel in `review-kreuzverhoer/SKILL.md` (step 2 bzw. step 5).
- AK4: Keine andere Datei als `.github/prompts/review.md` wird geändert.

### Testfälle
Keine — kein Anwendungscode (`server/src/**`, `frontend/src/**`, `frontend/e2e/**` nicht betroffen). Verifikation stattdessen strukturell im Review: grep auf die AK2-Marker/Tokens, Diff-Sichtung für AK1/AK3.

### Ampel
- Ampel: 🟢
- Begründung: Eine Datei, ein PR, eindeutige Vorgabe (Audit nennt Passagen mit Zeilen und Ersatztexte); Referenz-Ziele im SKILL.md verifiziert vorhanden; Antwort auf die Autor-Frage („welche granulare Optimierung?") durch die ticket-eigene Rangfolge eindeutig entschieden.

### ❓ Offene Fragen
- keine — die übrigen Audit-Hebel (2–7, inkl. toter Impeccable-Pfad und triage.md-Widerspruch) sind bewusst ausgeklammert und können bei Bedarf eigene Folge-Issues bekommen.
<!-- KI-ANALYSE:END -->

<!-- ai-phase-routing:START -->
| Phase | Run | Modell | Effort |
| --- | --- | --- | --- |
| ux | nein | - | - |
| spec | nein | - | - |
| impl | ja | sonnet | low |
| review | ja | sonnet | low |
<!-- ai-phase-routing:END -->
