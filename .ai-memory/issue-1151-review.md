# Issue 1151 — Review zu PR #1152 (Runde 5, Fixup-Verifikation), Stand 2026-08-31T19:1xZ

**ERGEBNIS: VERDICT reviewed (🟢).** Sammelkommentar 5481298207 in Place aktualisiert (Review-Status, F1–F5 Historie, F6 als kosmetische Altlast akzeptiert). Kein neuer Inline-Review nötig (keine neuen Findings, F6 bleibt ohne Anker akzeptiert). Titel-Gate: „feat(frontend): own standort tab for geo settings (#1151)" erfüllt Conventional Commits — kein Rename.

## Erledigt
- MODE bestimmt: `<!-- ai-review -->`-Sammelkommentar vorhanden (5481298207, updatedAt 2026-08-31T18:58:30Z) → Fixup-Verifikation, kein Neu-Kreuzverhör.
- Delta seit Runde-4-Head `56634ca4` geprüft: `git diff --stat 56634ca4..0c517e81` = NUR `.ai-memory/issue-1151-review.md` (26+/23-) — Commits `71853b5b` + `0c517e81` sind reine Memory-Commits, kein Produktionscode.
- F6 nachgeprüft am Head: `frontend/src/app.css:1630` Kommentar sagt weiter „genau 3 im Tab „Allgemein"", `frontend/e2e/settings-switch-layout.spec.ts:17` weiter `Sicherungs- Tests` — NICHT behoben.
- Kontext eingeholt: Workflow-Stop-Guards (16:58Z 11 Commits, 17:56Z 12 Commits) + 19:04:03Z „Fixup-Runden-Deckel erreicht — an den Menschen übergeben" (Runde 4 von max 3). Der vierte Fixup-Lauf lief nicht mehr; `0c517e81` (memory: fixup) hat F6 nicht umgesetzt.
- CI-Rollup zum Head `0c517e81`: verify SUCCESS, e2e (1)–(4) SUCCESS, review IN_PROGRESS (dieser Lauf).
- Bewertung: F6 ist rein kommentarbasiert (kein Verhaltens-/Testrisiko) → als nicht blockierend akzeptiert statt needs-fixup Runde 5; Loop ist gedeckelt, ein weiterer 2–4-Mio-Token-Lauf für 2 Textedits wäre unverhältnismäßig.

## Relevante Stellen
- `.ai-memory/issue-1152-review-comment.md` — Body des Sammelkommentars (Wegwerf-Artefakt, NICHT committen).
- `frontend/src/app.css:1629-1631`, `frontend/e2e/settings-switch-layout.spec.ts:17` — F6-Reste, dokumentiert im Sammelkommentar als Altlast.
- `gh api .../issues/comments/5481298207` — der eine `<!-- ai-review -->`-Sammelkommentar (in Place gepatcht).

## Annahmen
- F6-Rest „nicht relevant" i. S. v. SKILL-Schritt 5 (🟢 erfordert „keine relevanten Findings"): beide Punkte sind Kommentar-Text ohne Verhaltens-/Testeinfluss; frühere Runden nannten F6 selbst „rein dokumentarisch".
- verify/e2e-SUCCESS im Rollup gilt für Head `0c517e81` (review IN_PROGRESS im selben Rollup ⇒ aktueller Head).
- Kommentar 5481513040 („Review-Marker vom Workflow gesetzt") trägt zwar auch `<!-- ai-review -->` im Body — Workflow-Artefakt, unangetastet gelassen (nicht mein Kommentar).

## Verworfen
- needs-fixup für F6 — Loop-Deckel erreicht/Übergabe an Menschen; Verhältnismäßigkeit.
- needs-human — F6 ist keine Architektur-/Produktentscheidung; Entscheidungs-Findings-Mechanismus wäre zweckentfremdet.
- Neues Kreuzverhör des Gesamtdiffs — MODE Fixup-Verifikation verbietet es.
- Labels setzen — laut Prompt tabu (Workflow macht das).

## Offen
- F6-Kosmetik (app.css-Kommentarzahl, Spec-Typo) — bewusst offen, im Sammelkommentar als Altlast für den nächsten berührenden Commit dokumentiert.
- `.ai-memory/issue-1152-review-comment.md` untracked, NICHT committen.

## Nächster Schritt
- Phase beendet: Verdict `reviewed` geschrieben (`/tmp/claude-verdict` + Output-Zeile). Gate entscheidet ready-to-merge (CI grün + Review grün).

## Fallstricke
- Falls ein Folge-Review doch läuft: Marker-Suche findet 2 Kommentare mit `<!-- ai-review -->` — Sammelkommentar ist 5481298207 (strukturiert, Zeile 2 nennt PR + Issue), 5481513040 ist Workflow-Marker.
- Reviews-POST mit `line` außerhalb der Diff-Hunks → 422 (Runde 4); keine Inline-Anker mehr nötig, solange keine neuen Findings kommen.
- Verify-Runs werden bei jedem Push gecancelt — CI-Evidenz immer dem Rollup des aktuellen Heads entnehmen.
