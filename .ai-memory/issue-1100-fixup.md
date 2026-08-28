## Erledigt
- PR 1100 Fixup (Runde 1): genau 1 Finding (Finding 1, SIGPIPE-Fehlalarm) behoben, keine Entscheidungs-Findings.
- Rot-Nachweis: Repro per 288KB-Body (4 Headings oben + Fuelltext) gegen den ALTEN Stand → `ok=false`, alle 4 „missing" (end-to-end bestätigt, `.github/scripts/verify-template-structure.sh:56`).
- Regressionstest ergänzt: `.github/scripts/verify-template-structure.test.ts` — neuer describe-Block „grosse Bodies (SIGPIPE-Regression)" vor dem fail-safe-Block; Body = formBody + `'Fuelltext. '.repeat(30_000)` (330KB), erwartet `ok=true` + `missing=''`. Vor dem Fix rot (`'false' !== 'true'`), danach grün.
- Fix: `.github/scripts/verify-template-structure.sh` `has_heading()` — `printf '%s' "$BODY" | grep -qiE …` → `grep -qiE … <<<"$BODY"` (Herestring, keine Pipe → kein SIGPIPE unter pipefail); Kommentar um die SIGPIPE-Begründung erweitert. Bewusst NICHT die Variante „grep direkt auf $BODY_FILE" gewählt: unlesbare Datei gäbe grep-Exit 2 → `has_heading` false → MISSING befüllt → `ok=false`, verletzte den dokumentierten fail-safe (Skriptkopf Zeile 17-18 + bestehender Test „besteht bei unlesbarer Datei" erwartet ok=true).
- Gate: `pnpm test:scripts` 216/216 grün (inkl. neuer Test, Suite 8 Tests in der Datei); `bash -n` ok; prettier --check auf der .test.ts grün (auf .sh kein Parser vorhanden — pre-existing, repo formatiert Shell nicht). Node_modules sind diesmal TEILWEISE da (tsx vorhanden) — anders als in der Review-Notiz angenommen.
- Thread ID 3882834293 (Finding 1) resolviert + Reply mit Fix-SHA.
- Commit+Push auf `ci/template-struktur-post-check` (PR-Branch), Phasen-Notiz im Commit.

## Relevante Stellen
- `.github/scripts/verify-template-structure.sh:55-61` — `has_heading()` (jetzt Herestring); einzige Verhaltensänderung des PR-Fixups.
- `.github/scripts/verify-template-structure.test.ts` — neuer Regressionstest-Block; `run()`-Helper (body.md wird pro Call überschrieben) unverändert nutzbar.
- `.github/workflows/01-claude-triage.yml:351-398` — Verbraucher des Checks (needs-human-Override); NICHT angefasst, Verkabelung war im Review sauber.
- Sammelkommentar `<!-- ai-review -->` ID 5455933412 — bei weiterer Runde per PATCH updaten, nicht neu anlegen.

## Annahmen
- Kein Linked Issue („Review ohne Issue") → PR-Beschreibung + Review-Thread sind Massstab; Finding 1 ist unambiguous, daher fixbar ohne Entscheidung.
- `pnpm test:scripts` deckt die CI-Schicht ab (ci.yml/ci-multi-provider.yml rufen denselben Script auf); `pnpm -r test` (Frontend/Server) ist vom Finding nicht berührt — reine Shell-Änderung, kein Produktivcode.

## Verworfen
- Fix-Variante `grep … "$BODY_FILE"` ohne `BODY=$(cat …)` (Review-Vorschlag b) — bricht den fail-safe für unlesbare Dateien (s. Erledigt).
- SIGPIPE-Global-Fix in anderen Skripten (z. B. verify-issue-quality.sh `section()`) — nicht Teil des Findings; „Only fix reported findings". Dort existiert das Muster potentiell ebenfalls (Folge-Ticket-würdig, nicht hier).
- Umstellung des Checks auf `$BODY_FILE`-basiertes Lesen/Grep-Array — gleicher Scope-Grund.

## Offen
- `/tmp/big-body.md` (Repro-Artefakt, ausserhalb des Repos) — kein Repo-Aufräumbedarf.

## Nächster Schritt
- CI des Push beobachten; bei Grün Fixup-Verifikation (Review-Runde 2, nur Deltas) und Sammelkommentar-PATCH (ID 5455933412).

## Fallstricke
- `grep -q … <<<"$VAR"`: bei leerer `$BODY` matcht grep nie → false → MISSING befüllt; das ist gewollt (leerer Body = Struktur fehlt), nur fail-safe für UNLESBARE Datei läuft über den `cat`-Guard davor — beide Wege nicht vertauschen.
- tsx-Tests in dieser Sandbox LAUFEN (node_modules/.bin/tsx existiert, node --import tsx --test über glob) — die Annahme aus der Review-Notiz („TS-Tests hier nicht lauffähig") gilt nur für vollständige Workspace-Suiten, nicht für `.github/scripts/*.test.ts` (reine node:test+tsx, keine Workspace-Deps).
- Prettier hat keinen Parser für `.sh` — `prettier --check` auf Shell-Skripten endet mit „No parser could be inferred" (Exit 2), das ist kein Formatfehler; nur die TS-Datei prüfen.
