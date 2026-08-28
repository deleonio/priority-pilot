# PR #1089 (ci(#1084): Phasen-Prompts entschlackung) — Review (Kreuzverhör Runde 1)

Status: **reviewed (🟢)** gesprochen (2026-08-28), kein Fixup nötig. Sammelkommentar mit Marker
`<!-- ai-review -->` neu erstellt (vorher keiner vorhanden → MODE Kreuzverhör).

## Erledigt
- MODE bestimmt: kein `<!-- ai-review ?>`-Kommentar auf PR 1089 → Kreuzverhör Erstreview.
- Kein Closing-Issue (`closingIssuesReferences.length == 0`; #1084 nur per `Refs` referenziert)
  → „Review ohne Issue - PR-Beschreibung ist massgebend" im Sammelkommentar dokumentiert.
- Vollständigen Diff gelesen (7 Dateien `.github/prompts/*.md`, +21/−45, nur Prompt-Text).
- PR-Body-Verträge gegen Code verifiziert — ALLE bestätigt:
  - Step-Referenzen: implement.md/fixup.md → ticket-implementation SKILL 3a/3b/3c
    (3c enthält den vollständigen GATE-Commandblock + deterministische-UI-Tools-Regel +
    375/1280-Check + e2e-Regel; Step 4 trägt die „Test-Resultate in den PR-Body"-Pflicht);
    spec.md → ticket-spec SKILL Step 4 (Draft-PR-Regeln, Titel wörtlich, Closes); triage.md →
    ticket-triage SKILL Step 4 (Routing-Tabelle mit „impl/review ALWAYS ja" + `Run=nein`→`-`);
    review.md → review-kreuzverhoer SKILL Step 1/2/5.
  - Platzhalter: alle `{{Namen}}` weiterhin vorhanden (nur Instanzzahlen in review.md/spec.md
    gesunken, da gelöschte Prosa welche enthielt); Workflow-sed läuft mit `/g` → kein Bruch.
    Verifiziert per `grep -o '{{[A-Z_]*}}' | sort -u` base (d85e50e3) vs. HEAD (Merge 414341e7).
  - fixup.md: `<!-- ai-fixup-decisions -->` bleibt Zeile 1 des Kommentar-Templates
    (fixup.md:27), `### <F>. <Titel>`-Heading + deutsche Headings unverändert.
  - Streichungen (spec.md Label-Flow, triage.md ai:model-Notiz) durch #1084 Option 1
    Schritt 2 ausdrücklich gedeckt (Audit-Body Zeilen 117–122 nachgelesen).
- CI geprüft: verify pass, e2e (1)–(4) pass, label pass, precheck pass; `review` pending = dieser Lauf.
- Titel-Gate: Titel war deutsch (`Phasen-Prompts entschlackung (Audit-Option 1)`) → umbenannt in
  `ci(#1084): slim phase prompts via skill references (audit option 1)`.
- Verdict `reviewed` → /tmp/claude-verdict.

## Relevante Stellen
- `.github/prompts/{adr-sync,fixup,implement,review,spec,triage,ux}.md` — der gesamte Diff.
- `.claude/skills/ticket-implementation/SKILL.md:33-64` — Step 3a/3b/3c + Step 4 (Referenzziele).
- `.claude/skills/ticket-spec/SKILL.md:52-58` — Step 4 Draft-PR-Regeln (Referenzziel spec.md).
- `.claude/skills/ticket-triage/SKILL.md:77-136` — Step 4 Routing-Tabelle (Referenzziel triage.md).
- `.claude/skills/review-kreuzverhoer/SKILL.md:31-39,42-53,100-156` — Step 1/2/5 (Referenzziele review.md).
- Issue #1084 Body ~Zeile 117 — Option 1 (informelle Spezifikation dieses PR).

## Annahmen
- Docs/Prompt-only-PR → kein Test-Gate nötig (Präzedenz PR #1088); CI verify (inkl. Prettier) grün.
- `Refs #1084` (nicht `Closes`) = kein Closing-Issue → PR-Body ist die massgebliche Spezifikation.
- Probe-Lauf (Audit Schritt 4) bleibt offen und ist im PR-Body ehrlich als „Offen" notiert —
  kein Review-Finding, da vom Audit als nachgelagerter Beobachtungsschritt angelegt.

## Verworfen
- Finding „Label-Flow-Info geht verloren": verworfen — #1084 Option 1 Schritt 2 streicht sie
  ausdrücklich als Workflow-Interna (und die Recovery ist Menschen-Wissen, nicht Agenten-Aufgabe).
- Eigene Prettier-Prüfung: `pnpm` in dieser Shell nicht auf PATH; CI-`verify`-Check (grün)
  deckt den Format-Check ab — kein doppelter Aufwand nötig.

## Offen
- `-`

## Nächster Schritt
- Keiner für diesen PR (merged via Pipeline). Audit #1084: Optionen 2/3 offen, Probe-Lauf beobachten.

## Fallstricke
- Lokale Sandbox: `pnpm` fehlt im Bash-PATH — Qualitätsgates über CI-Checks (`gh pr checks`)
  lesen statt lokal rekonstruieren.
- Platzhalter-Vergleich base-vs-head per `sort -u` der NAMEN machen, nicht per Instanzzählung:
  gelöschte Prosa senkt Instanzzahlen legitim; sed `/g` bricht erst, wenn ein NAME verschwindet.
