# PR 1100 — Review (Fixup-Verifikation, Runde 2), Stand 2026-08-28T18:10Z

**MODE: FIXUP VERIFICATION** (Marker `<!-- ai-review -->` vorhanden, ID 5455933412, Runde 1 @ 17:56:26Z). Kein Closing-Issue → „Review ohne Issue", PR-Beschreibung massgebend. **ERGEBNIS: reviewed (🟢)** — Finding 1 (SIGPIPE) behoben, keine neuen Findings im Delta. Titel-Gate: `chore: add template-structure post-check after triage analysis` weiterhin konform, kein Rename nötig.

## Erledigt
- Delta scoping: genau 1 Commit seit Runde 1 (17905dcb, 18:04:39Z) — Full-Re-Diff nicht nötig. PR OPEN, nicht gemerged.
- Fix end-to-end am Skript verifiziert (Sandbox-hart): 330-KB-Body + Überschriften oben → `ok=true` (Runde 1: reproduzierbar `ok=false`); defekter Body (Fliesstext ohne `#`) → weiterhin `ok=false` mit allen 4 missing; unlesbare Datei → fail-safe `ok=true`.
- Herestring-Varianten-Wahl (`<<<"$BODY"` statt grep auf `$BODY_FILE`) als bewusster Erhalt des Fail-safes geprüft und im Sammelkommentar gewürdigt.
- Regressionstest auf Substanz geprüft: echter spawnSync, 330-KB-Body, kann failen — substanziell.
- CI geprüft: verify/e2e/precheck pass, nur `review` pending (= dieser Lauf). Grün-Voraussetzung erfüllt.
- Sammelkommentar per PATCH aktualisiert (ID 5455933412 → 2026-08-28T18:10:18Z, Marker first line erhalten, Review-Typ: Fixup-Nachweis). Finding-Nummerierung stabil: Finding 1 = SIGPIPE (jetzt in Behobene-Anmerkungen-Tabelle).
- Verdict `reviewed` nach /tmp/claude-verdict geschrieben.

## Relevante Stellen
- `.github/scripts/verify-template-structure.sh:55-61` — `has_heading()` mit Herestring; einzige Verhaltensänderung des Fixups.
- `.github/scripts/verify-template-structure.test.ts:130-146` — neuer Describe-Block „grosse Bodies (SIGPIPE-Regression)".
- `.ai-memory/issue-1100-fixup.md` — Fixup-Phasen-Notiz (im PR-Branch committet, ADR-0007-Konvention, kein Finding).

## Annahmen
- TS-Suite lokal nicht lauffähig (diese Sandbox: `Cannot find package 'tsx'` — gleiche Umgebungslimitierung wie Runde 1; die gegenteilige Angabe in issue-1100-fixup.md galt für deren Sandbox). Deckung: direkte bash-Verifikation desselben Codepfads + CI-verify (läuft test:scripts) grün.
- Fixup-Angabe „test:scripts 216/216 grün" nicht lokal repliziert — CI-verify-pass ersetzt den Nachweis.

## Verworfen
- Neue Kreuzverhör des Gesamtdiffs — Fixup-Verifikations-Modus, nur Delta (SKILL.md step 5 Diff scoping).
- Follow-up zu `verify-issue-quality.sh:69` (dort ebenfalls `printf | grep`-Muster potentiell SIGPIPE-anfällig): NICHT Teil des Findings, vom Fixup bewusst ausgeklammert („only fix reported findings") — habe es nicht zum Finding erhoben, da außerhalb des PR-Deltas und Schwelle bei realen Bodies (max ~19 KB) nicht erreicht; ggf. menschliches Folge-Ticket.

## Offen
- `.ai-memory/issue-1100-review-body.md` ist Wegwarf-Artefakt (Sammelkommentar-Body für den PATCH) — NICHT committen; diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Keiner für Review-Phase: verdict `reviewed` gesetzt; Pipeline übernimmt Gate/auto-merge (CI + Reviewer grün → ai:ready-to-merge).

## Fallstricke
- tsx-Verfügbarkeit ist sandbox-abhängig (Runde 1: fehlte, Fixup-Notiz: da, diese Runde: fehlte) — niemals auf die Notiz verlassen, im Zweifel bash-Nachstellung des Skript-Verhaltens.
- Review ohne Issue: keine AK-Verifikation möglich; „Review ohne Issue"-Hinweis steht in Zeile 2 des Sammelkommentars und in der 🟢-Bestätigung (Vorgabe eingehalten).
