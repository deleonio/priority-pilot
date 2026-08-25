# Review PR #1026 (Issue #1025, Prompt-Audit-Umsetzung)

## Erledigt

- **Runde 1 (Kreuzverhör):** voller Diff geprüft, 1 Finding F1 (`.github/prompts/implement.md:36`,
  `pnpm test:e2e` kein Root-Script), Sammelkommentar 5411586185 angelegt, VERDICT needs-fixup.
- **Runde 2 (Fixup-Nachweis, dieser Lauf):** Modus per Marker `<!-- ai-review -->` bestimmt
  (Kommentar 5411586185, updatedAt 2026-08-25T14:06:21Z vorhanden → FIXUP-NACHWEIS).
  Fixup-Commits seit updatedAt: `de07865a` (14:24:34), `b7317434` (14:26:20), `61972dca` (Merge main).
  - F1 **behoben** verifiziert: `git show de07865a` → implement.md:36 jetzt
    `pnpm --filter frontend test:e2e`; Script existiert (`frontend/package.json:14` = `playwright test`).
  - `b7317434`: nur `.ai-memory/MEMORY.md` +7 Zeilen (t.skip-Learning), ans Ende angehängt →
    union-Merge-Regel aus AGENTS.md § Memory gewahrt, kein Umschreiben bestehender Zeilen.
  - `61972dca`: reiner Merge von main (bringt .costs/1021.json, pr-image-strip.sh, strip-images.*,
    06-Workflow, package.json) — kein Evil-Merge, keine Konfliktauflösung in PR-Dateien.
  - Titel-Gate: `refactor(prompts): dedupe phase prompts against knowledge base` erfüllt
    Conventional Commits (63 Zeichen, englisch, Subject klein) → keine Umbenennung.
  - VERDICT: reviewed, Sammelkommentar 5411586185 auf Runde 2 fortgeschrieben.

## Relevante Stellen

- `.github/prompts/implement.md:36` — Ort von F1, jetzt workspace-scoped e2e-Kommando.
- `frontend/package.json:14` — `"test:e2e": "playwright test"`, das einzige Vorkommen des Scripts.
- `.github/workflows/ci.yml:150` — CI ruft `pnpm --filter frontend exec playwright test --shard`,
  Kommentar dort erklärt, warum nicht `test:e2e -- --shard` (pnpm reicht `--` literal durch).
- `docs/testing.md:9` — nennt weiterhin nacktes `pnpm test:e2e`; ausserhalb des Diffs, vom PR nicht
  eingeführt → kein Finding, nur Nebenbemerkung im Sammelkommentar.
- Sammelkommentar-ID `5411586185` (Issues-API `/issues/1026/comments`), per PATCH fortgeschrieben.

## Annahmen

- CI wird grün: zum Review-Zeitpunkt waren `precheck`/`label`/Trigger pass, `verify`/`e2e`/`review`
  noch pending. Inhaltsurteil 🟢 ist per SKILL notwendig, nicht hinreichend — `pr-gate-merge.yml`
  entscheidet über `ai:ready-to-merge`.
- `pnpm --filter frontend test:e2e` läuft im CI-Runner; lokal nicht ausführbar (pnpm nicht im PATH
  dieser Sandbox), Auflösung nur statisch über package.json belegt.

## Verworfen

- `docs/testing.md:9` als Finding — ausserhalb des Diffs, pre-existing, nicht vom PR verursacht.
- Erneutes Kreuzverhör des ganzen Diffs — Modus FIXUP-NACHWEIS verbietet das Aufrollen unveränderter
  Teile (Runde 1 hatte sie bereits verifiziert).
- Prozess-Nit „b7317434 ist ein eigener Memory-Commit, AGENTS.md will ihn im Phasen-Commit" als
  Finding — nicht ohne History-Rewrite behebbar, Inhalt korrekt und regelkonform angehängt.
- Neuer MEMORY.md-Eintrag aus diesem Lauf — nichts Nicht-Offensichtliches gelernt; Review-Phase darf
  ohnehin nicht committen.

## Offen

- Keine Findings offen. CI-Endergebnis (`verify`, `e2e 1-4`) zum Zeitpunkt des Verdicts pending.

## Nächster Schritt

- Nichts. Review abgeschlossen (VERDICT: reviewed). Bei rotem CI setzt `pr-gate-merge.yml`
  `ai:needs-changes` und startet eine neue Fixup-Runde — dann Runde 3 wieder als Fixup-Nachweis.

## Fallstricke

- Modus-Erkennung MUSS über die **Issues**-API laufen (`/issues/1026/comments`), nicht
  `/pulls/1026/comments` — der Sammelkommentar ist ein Issue-Comment, kein Review-Comment.
- `gh pr view --json commits` liefert `committedDate`; danach filtern statt `git log` auf dem
  Sandbox-HEAD (HEAD ist `pull/1026/merge`, enthält zusätzlich den main-Merge af024068).
- Sammelkommentar-Body per Datei + `gh api --method PATCH -F body=@datei` schreiben — Klammern und
  Backticks im Body würden bash sonst als Subshell parsen (MEMORY.md 2026-08-24).
- Finding-Nummern über Runden stabil halten: F1 bleibt F1, wandert nur in „Behobene Anmerkungen".
