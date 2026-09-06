# PR 1244 — Kreuzverhör + Fixup-Nachweis (Review-Phase), Stand 2026-09-06 (2. Lauf)

**ERGEBNIS: VERDICT reviewed, 🟢.** Lauf 1 (Kreuzverhör): reviewed mit 2 Nits, Sammelkommentar IC_kwDONloM188AAAABSyTgnw angelegt. Lauf 2 (dieser): Marker vorhanden → MODE FIXUP VERIFICATION; Fixup-Commit `f4958f06` (2026-09-06T00:28Z, nach Sammelkommentar 00:05Z) + Merge `a23a2129` = Delta. Beide Nits im Delta behoben und verifiziert, keine neuen Findings, CI grün → Sammelkommentar aktualisiert (Nits 1+2 in „Behobene Anmerkungen", Review-Typ: Fixup-Nachweis). Titel-Gate: `feat(frontend): separate balance switch from recompute button (#1220)` = gültig (70 Zeichen, CC-konform), kein Rename.

## Erledigt
- Marker-Suche: genau 1 `<!-- ai-review -->`-Kommentar (IC_kwDONloM188AAAABSyTgnw) → Fixup-Nachweis-Modus.
- KEIN `<!-- ai-fixup-decisions -->`-Kommentar auf dem PR (fixup-Check = „skipping") → keine Claim-Zeilen; Delta stattdessen direkt gegen die offenen Findings geprüft (18bc659c..a23a2129, 5 Dateien, +83/−10).
- Nit-1-Fix verifiziert: `originalPriority` in `BalancePriority` (`balancePriority.ts:26`), mitverglichen in `balancePrioritiesEqual` (:98), Tie-Break in `sortTasksByBalance` liest Snapshot mit Fallback auf eigene Prio bei fehlendem Eintrag (:122-124); 3 neue Unit-Tests (eingefrorener Gleichstand, Fallback, Veraltet bei Prio-Änderung); Spec `docs/spec/issue-1220.md` synchronisiert.
- Nit-2-Fix verifiziert: Button-Label `rebalancing ? 'Berechne neu …' : 'Neu berechnen'` (App.tsx ~:790), E2E-Locator-Regex auf beide Zustände erweitert (`issue-1220-balance-mode.spec.ts:98`).
- CI auf Head: verify + e2e (1)–(4) + precheck + label = pass (gh pr checks).
- Sammelkommentar per GraphQL `updateIssueComment` aktualisiert (Body-Vorlage: `.ai-memory/issue-1244-comment.md`).

## Relevante Stellen
- `frontend/src/lib/balancePriority.ts:23-31,67-73,95-100,106-125` — eingefrorener Tie-Break (Kern des Fixups).
- `frontend/src/lib/balancePriority.test.ts:149-176,265-277` — die 3 neuen Unit-Fälle.
- `frontend/src/App.tsx:785-795` — Ladezustand-Label des Neu-berechnen-Buttons.
- `docs/spec/issue-1220.md:35-49,84-93` — Vertrag + Ladezustand nachgezogen.

## Annahmen
- `gh pr checks` zeigt die Checks des aktuellen Head (a23a2129) — e2e/verify-pass deckt den Fixup-Commit ab (Timeline: Push 00:28 → verify/e2e → Review-Run).
- Interface-Erweiterung `BalancePriority` um Pflichtfeld `originalPriority` ist abwärtsunikal: einzige Konstruktionsstelle ist `buildBalancePriorities`; tsc (verify) grün bestätigt.

## Verworfen
- Neue Kreuzverhör des ganzen PRs — Fixup-Nachweis-Modus (SKILL Schritt 5): nur Delta + offene Findings.
- MEMORY.md-Eintrag — kein neuer Fehler/Kriterium erfüllt.

## Offen
- `.ai-memory/issue-1244-comment.md` = Wegwerf-Artefakt (Kommentar-Vorlage), NICHT committen.

## Nächster Schritt
- Workflow übernimmt (Labels automatisch, Review-Term steht in /tmp/claude-verdict und Sammelkommentar).

## Fallstricke
- Erneuter Review-Lauf: Marker weiterhin vorhanden → wieder FIXUP VERIFICATION; Finding-Nummern 1/2 sind jetzt in „Behobene Anmerkungen" verankert, NICHT neu nummerieren.
- Kommentar-Edit läuft nur per GraphQL mit der Node-ID (REST bräuchte numerische Comment-ID, `gh pr view` liefert die Node-ID).
