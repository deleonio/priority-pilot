# PR 1100 — Review (Kreuzverhör, Runde 1), Stand 2026-08-28

**MODE: CROSS-EXAMINATION** (kein `<!-- ai-review -->`-Marker vorhanden). **Kein Closing-Issue** → „Review ohne Issue", PR-Beschreibung ist massgebend. **ERGEBNIS: needs-fixup** (1 fixables Finding). Titel-Gate gegriffen: „CI: Template-Struktur-Post-Check nach der Analyse" war kein Conventional Commits → umbenannt zu `chore: add template-structure post-check after triage analysis` (Hint chore/k.A.).

## Erledigt
- Full diff gelesen (5 Dateien: ticket-triage SKILL.md, verify-template-structure.sh + .test.ts [neu], 01-claude-triage.yml, docs/pipeline-flow.md). Kein Linked Issue.
- Integration verifiziert: Struktur-Check steht NACH Self-Heal (prueft auch migrierten Body, Zeile ~352 in 01-claude-triage.yml), NACH `HAS_BLOCK`-Exit-Gate, VOR Verdict-Berechnung; `final="needs-human"`-Override als erster if-Zweig. BODY frisch geholt (Zeile 270 + Self-Heal-Refetch 333).
- Begründungspflicht-Kette geprüft: Marker-Kommentar `<!-- ai-triage-decision -->` steht als erste Zeile des Struktur-Kommentars → needs-human-explain.sh lookup mode triage filtert `startswith(...)` (needs-human-explain.sh:81) → findet ihn → KEINE Ersatz-Diagnose doppelt. ✓
- Script-Verhalten direkt per bash spot-verifiziert (Sandbox hat kein node_modules/tsx → TS-Tests liefen NICHT hier, Umgebungsproblem, kein PR-Defekt): intakter Body → ok=true; Fliesstext-Nennung „Wie soll es sein" ohne `#` → ok=false + namentlich missing; unlesbare Datei → ok=true (fail-safe). Testsubstanz der 7 TS-Tests: echter Subprozess-Spawn, kann failen — substanziell.
- Template-Praemisse verifiziert: alle vier Ueberschriften stehen als label in .github/ISSUE_TEMPLATE/ticket.yml (Zeilen 25/34/45/84/95) — Substring-ohne-„?"-Match deckt Forms-H3 und manuelles H2.
- `test:scripts`-Wiring geprüft: package.json:23 glob `.github/scripts/*.test.ts` nimmt die neue Datei auf; ci.yml:89 + ci-multi-provider.yml:85 laufen es.

## Relevante Stellen
- `.github/scripts/verify-template-structure.sh:54` — `printf '%s' "$BODY" | grep -qiE ...` unter `set -o pipefail`: **FINDING 1** (s. Fallstricke).
- `.github/scripts/verify-issue-quality.sh:69` — `section()`: Praemisse „deckungsgleich" stimmt approximativ (Substring + Heading-Anforderung; neues Skript minimal grosszuegiger: `^#+[[:space:]]*` ohne Pflicht-Leerzeichen — Superset, unkritisch).
- `.github/workflows/01-claude-triage.yml:351-398` — der ganze neue Block (Struktur-Check + Kommentar + Verdict-Override).

## Annahmen
- PR-Body-Angaben (format/lint/frontend 452 passed, Scripts-Suiten 7/7 gruen) nicht lokal verifizierbar (keine node_modules in der Sandbox) — Verhalten des Shell-Skripts direkt nachgestellt, deckt die Test-Aussagen.
- TDD-Reihenfolge nicht pruefbar: PR hat EINEN squashten Commit (2026-08-28T17:50:03Z). Kein Finding (Repo-Squash-Konvention), im Review-Body als Randnotiz genannt.

## Verworfen
- Weitere Findings: Workflow-Verkabelung (BODY-Freshness, Marker-first, fail-safe-Leerstring→warn+true, `|| true` auf gh-Kommentar mit Ersatz-Diagnose-Fallback) — alles sauber; SKILL.md-Regel konsistent mit Skript (Position „nie dazwischen" ist Praeventions-Regel, Skript prueft bewusst nur Existenz — kein Widerspruch); Doku (pipeline-flow.md) matcht Verhalten; KoliBri-first N/A; keine Regression/Test-Pflege-Bedarf (rein additiv).
- SIGPIPE-Fund als „kein Finding" einstufen — verworfen: reproduzierbarer falscher needs-human, Ein-Zeilen-Fix, Check läuft bei JEDER Triage.

## Offen
- Fixup zu FINDING 1 abwarten; danach Fixup-Verifikation (nur Deltas).

## Artefakte dieser Runde
- Review (event=COMMENT) mit 1 Inline-Kommentar: ID 5053689762, Anker `.github/scripts/verify-template-structure.sh:56`.
- Sammelkommentar `<!-- ai-review -->`: ID 5455933412 (2026-08-28T17:56:26Z) — bei Fixup-Verifikation per PATCH dieser ID updaten, nicht neu anlegen. Finding-Nummerierung stabil: Finding 1 = SIGPIPE.
- Titel umbenannt (Titel-Gate): `chore: add template-structure post-check after triage analysis`.

## Nächster Schritt
- Fixup-Runde: prüfen, ob `has_heading` die Pipe los wird (Herestring `<<<"$BODY"` oder grep direkt auf `$BODY_FILE`), idealerweise + Test für >64KB-Bodies.

## Fallstricke
- **FINDING 1 (reproduziert, end-to-end):** Body >64KB (Pipe-Buffer) + fruehe Ueberschrift (Template-Headings stehen IMMER oben!) → grep -q exitet nach Erstmatch, printf (builtin) kriegt SIGPIPE(141), pipefail → has_heading falsch false → ok=false mit erfundenen missing → spurious needs-human + faelschlicher „Struktur beschädigt"-Kommentar. Repro: 293KB-Body, alle 4 Headings oben → ok=false, alle 4 „missing". Heutige reale Bodies 1,5–19KB (groesste: Issue 1090) → Trigger-Schwelle 3,4× ueber Max, aber Check läuft auf jeden Lauf.
- TS-Tests in dieser Sandbox nicht lauffaehig (tsx fehlt) — bei kuenftigen Reviews hier: Shell-Logik direkt nachstellen statt Testlauf erzwingen.
- Review ohne Issue: keine AK-Verifikation moeglich; PR-Beschreibung (Problem/Lösung 3 Schichten/Tests/Gate) ist der Massstab.
