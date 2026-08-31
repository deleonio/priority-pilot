# Issue 1137 — Review (PR #1138), Stand 2026-08-31

## Erledigt
- MODE = Fixup-Nachweis (Marker `<!-- ai-review -->` vorhanden, Kommentar-ID 5473182245, updatedAt 2026-08-31T03:06:15Z). Delta = commits 38560fe6 + 7b18cfbe4, geprüft per `git diff 5ce16a8d..38560fe6` (8 Dateien, +53/−20) — kein Voll-Diff-Walk.
- F2/F3 verifiziert geschlossen (fixup.md Schritt 3/4: PROPOSAL-Formulierung, Klärungspfad mit Endzustand „NO commit/NO verdict, Thread offen").
- F1 teilweise geschlossen: AK3 ✓ (SKILL.md Step 4 Klassifikationsblock), AK4 ✓ (ux.md → SKILL `## Output` :16 existiert), AK5 ✓ (ticket-triage SKILL Step 2 = ADR-0009-Body-Regel, Referenz stimmt), AK7 ✓, AK8-Code ✓. **AK6 offen: nur 4/8 Dateien konvertiert** — spec.md:25, implement.md:34, prompt-audit.md:45 Langform; review.md:41 eigene Struktur. Verifiziert am PR-Head 7b18cfbe4 via `git show origin/...:{file} | grep -c "VERDICT (one line):"` → 0.
- F4 neu: PR-Body (Runde-0-Stand) ohne AK3-Abgleich + AK8-Beleg, „Option 1 implementiert" statt Optionen 1–3, fixup.md-Zitat veraltet.
- Review gepostet: `gh api …/pulls/1138/reviews` event=COMMENT, Review-ID 5062889439, Inline-Kommentar an `.github/prompts/ux.md:23` (Zielform-Standort; spec.md/review.md sind nicht im Diff → dort nicht ankerbar).
- Sammelkommentar 5473182245 per PATCH aktualisiert (needs-fixup, Review-Typ: Fixup-Nachweis, F2/F3/F1-Teil1 → Behobene, F1-Rest + F4 → Offene). Kein Label gesetzt. Titel-Gate: „chore(fixup): close fixup loop gap for ambiguous findings (#1137)" = 64 Zeichen, konventionskonform → kein Rename.
- Wegwerf-Artefakte: `.ai-memory/issue-1137-review-{collected,body,inline,payload,patch}.md` + `issue-1137-aks.md`, `issue-1137-prbody.md` — NICHT committen.

## Relevante Stellen
- `.github/prompts/spec.md:25` / `implement.md:34` / `prompt-audit.md:45` / `review.md:41` — AK6-Rest; Konvertierung auf „VERDICT (one line):" wie ux.md:23.
- `.github/prompts/fixup.md:10-12` — F2/F3-Verankerung, unverändert lassen.
- PR-Beschreibung — F4: Runde-1-Zusammenfassung je AK + AK3-Abgleich + AK8-Beleg ergänzen, Zitat korrigieren.
- Verify-Run 33353336438 (38560fe6) grün; Checks auf 7b18cfbe4 pending (e2e/verify).

## Annahmen
- AK-Wortlaute aus dem Harness-Kommentar von #1137 (`gh issue view 1137 --json comments`, ai-harness-Filter) sind maßgeblich; AK6 nennt explizit 8 Dateien.
- Threads zu F1–F3 als resolved behandelt (Fixup-Notiz nennt PRRT_kwDONloM186dmW6T/-W6Z/-W6d); REST-Resolve-Status nicht einzeln nachgeprüft.

## Verworfen
- needs-human — keine Entscheidung nötig: AK6-Rest ist mechanische Konvertierung, F4 reine Body-Doku.
- Re-Review des ganzen PR — SKILL step 5 Diff-Scoping; Runde-1-Positionen nicht neu verhandelt.
- Inline-Anker auf spec.md:25 — Datei nicht im PR-Diff, GitHub lehnt Kommentar ab → Anker auf ux.md:23.

## Offen
- CI auf 7b18cfbe4 pending zum Zeitpunkt des Verdicts; Merge-Gate entscheidet workflow-seitig.

## Nächster Schritt
- Fixup-Runde 2 (Label `ai:needs-changes`): AK6-Rest in den 4 Dateien + PR-Body-Nachtrag (F4); danach Re-Review nur gegen dieses Delta.

## Fallstricke
- Runde-1-F1 war bei AK6 zu knapp gescoped (3 statt 8 Dateien) — der Fixup hat treu geliefert; Rest-Openierung ist kein Fixup-Versäumnis, im Kommentar so markiert.
- Nicht-im-Diff-Dateien können keine Inline-Kommentare tragen → AK6-Anker auf die Zielform-Zeile (ux.md:23) legen.
- `git diff main..head` am lokalen Merge-HEAD (c0503f7f) entspricht dem PR-Delta; PR-Head-Stände sicherer per `git show origin/<branch>:<file>` prüfen.
