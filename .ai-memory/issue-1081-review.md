# Review-Notiz — PR 1081 (Kreuzverhör, Runde 1)

## Erledigt
- MODE ermittelt: kein `<!-- ai-review -->`-Kommentar vorhanden → Kreuzverhör (Initial).
- Closing-Issue geprüft: 0 → „Review ohne Issue“, PR-Beschreibung massgebend.
- Titel-Gate: `ci: harness-branch issue storage (ADR 0007) + adr-sync workflow` — konform (Typ ci, engl., lowercase, <72). Kein Rename.
- Vollständigen Diff gelesen (22 Dateien, ~1282 Zeilen; Persisted-Output bzqz5o440.txt).
- Verifikationen: `.prettierignore:35` ignoriert `.ai-memory/` (ADR-0007-Behauptung Punkt 6 stimmt); cache-cleanup.yml:129-133 prüft Issue ODER PR-Status (PR-Silo-Fall abgedeckt).
- 2 Findings als Inline-Review-Kommentare (REQUEST_CHANGES) gepostet; Sammelkommentar angelegt; VERDICT needs-fixup.

## Relevante Stellen
- `.github/actions/setup-claude/action.yml:295-304` — Memory-Load-Loop mit Legacy-Fallback; Findung 1 (state.json-Exclude fehlt im Restore-Pathspec).
- `.github/actions/issue-state-save/action.yml` — Save-Filter `grep -E '/issue-[0-9]+-(triage|ux|...)\.md$'` schliesst state.json/Fragmente aus; Blob-Diff-Idempotenz; Warnlogik `own`-Notiz.
- `.github/workflows/cache-cleanup.yml:102,119-123` — Sweep über beide Prefixe; Findung 2 (Kommentar-Drift Zeilen 31-34 nennt nur ai/state/ADR 0006).
- `.github/workflows/claude-adr-sync.yml` — Skip-Guard/In-Flight-Guard, Post-Assertion (Scope/Stub-Guard/Verdict↔Commits), PR-Pflege + Re-Arm #536. Geprüft: unplausibel fehlerhaft ist nichts gefunden.
- `docs/adr/0007-*.md` — neue Entscheidung; 0006 auf Superseded gestzt (Volltext bleibt bis zum ersten Sync-Stub).

## Annahmen
- Git erlaubt `git switch` auf einen Branch, dessen tracked Dateien byte-identisch zu vorhandenen untracked Restore-Dateien sind (Autor behauptet das in setup-claude: „der Switch ist sauber“; unpack-trees vergleicht Blob-Hash). Nicht selbst getestet.
- `concurrency.queue: max` ist im Repo-Schema gültig (Action-Validator laut PR-Body grün).
- Smoke-Tests (Erst-Anlage/Idempotenz/Filter) nur laut PR-Body, lokal vom Autor.

## Verworfen
- „Spec-Switch bricht auf untracked Restore-Dateien“ — trifft nur bei INHABTLICH abweichendem Inhalt (documented Restore-Fallback-Kante in ADR 0007), identischer Inhalt ist sicher.
- „prettier CI rot durch Agent-Notizen im PR“ — .prettierignore deckt .ai-memory/ ab.
- „Sweep löscht PR-Keyed Branches nicht“ — gh pr view-Fallback vorhanden (cache-cleanup.yml:133).

## Offen
- Findung 1 (🟡 setup-claude:299): Legacy-Restore kann `.ai-memory/state.json` als untracked in den Workspace legen — .gitignore ignoriert sie nicht mehr; ADR-0007-Invariante („state.json darf nie nach main“) verletzbar. Fix-Vorschlag: `':(exclude).ai-memory/state.json'` im Pathspec ergänzen (oder nur state.json wieder gitignoren).
- Findung 2 (🟡 cache-cleanup.yml:31-34): Permissions-/Kommentarblock beschreibt noch ai/state-only + ADR 0006, obwohl der Sweep jetzt beide Prefixe prüft — reiner Kommentar-Drift.

## Nächster Schritt
- Fixup-Runde: prüfen, ob beide Findings behoben wurden (Fixup-Verifikation, KEIN neues Kreuzverhör), Sammelkommentar aktualisieren (Behobene-Anmerkungen-Tabelle), dann VERDICT.

## Fallstricke
- Sammelkommentar EXAKT EINEN halten (Marker `<!-- ai-review -->`), Finding-Nummern stabil (1, 2).
- Review ohne Issue: keine AK-Verifikation — PR-Beschreibung ist massgebend, in Zeile 2 des Sammelkommentars vermerken.
- Labels NICHT selbst setzen (Workflow macht das).
