# Issue 1015 — Review (Kreuzverhör, Runde 1) — ABGESCHLOSSEN

## Erledigt
- Modus: KREUZVERHÖR (Erst-Review; kein `<!-- ai-review -->`-Kommentar vorhanden war).
- PR 1015: Docs-only-Sync `docs/user-guide.md` (+42/−40, Commit b739da15 = lokales HEAD). Kein verknüpftes Ticket — PR-Body-Report = Auftrag.
- Sammelkommentar NEU angelegt: https://github.com/deleonio/priority-pilot/pull/1015#issuecomment-5405660611 (Marker `<!-- ai-review -->`, Status reviewed). Folge-Runde: diese ID per PATCH fortschreiben.
- Titel-Gate: alter Titel non-konform (deutsches, großes Subject) → umbenannt zu `docs(guide): sync user guide to current app state 2026-08-25`.
- Verdict: reviewed (🟢, keine Findings).

## Relevante Stellen
- `docs/user-guide.md` — einzige geänderte Datei; 14 Korrekturen, alle belegt.
- `frontend/src/App.tsx:380-424` — Toolbar 5 Buttons (Beleg 1 ✓).
- `server/src/express/routes/auth.ts:45-52` + `server/src/express/index.ts:151-155` — Seed nur Register (Beleg 3 ✓).
- `server/src/logics/find.ts:39-41,61-62` — Prio-Sortierung, MAX 5/2 (Belege 4+5 ✓).
- `frontend/src/lib/task.ts:138-143` — Badge-Farben (Beleg 6 ✓).
- `server/src/logics/score.ts:11` — `VERSPAETET_FAKTOR = 0.5` → „halbe Punktzahl“ (Beleg 11 ✓).
- `server/src/logics/dueTaskReminders.ts:47-73` — Bündelung je Nutzer (Beleg 12 ✓).

## Annahmen
- CI war zum Review-Zeitpunkt nicht rot (precheck pass, e2e/verify pending — normal).
- Format-Gate: lokal kein Prettier (keine node_modules); per `proseWrap: preserve` und grünem precheck als konform angenommen.

## Verworfen
- Prettier-Local-Check: `pnpm`/`node_modules/.bin/prettier` in Sandbox nicht vorhanden → übersprungen.
- Finding gegen „Start ohne Säulen“ (Register-API-User bekommen Seeds): verworfen — Register hat keine UI, Handbuchaussage stimmt für alle Leserpfade.

## Offen
- Nichts. PR wartet auf Workflow-Verarbeitung (review-Phase pending im CI).

## Nächster Schritt
- Falls Folge-Runde (FIXUP-NACHWEIS) startet: Kommentar 5405660611 per `gh api --method PATCH repos/{owner}/{repo}/issues/comments/5405660611 -f body=…` fortschreiben, Diff seit dessen updatedAt prüfen.

## Fallstricke
- Write-Tool auf /tmp in dieser Sandbox permission-denied → Kommentar-Body per single-quoted Heredoc (`cat > datei <<'EOF'`) + `gh pr comment --body-file` + `rm`; klappt reibungslos.
- Dauergedächtnis-Kandidat (nicht committet, Review-Phase): derselbe Heredoc-Workaround ist die zuverlässige Variante für GitHub-Bodies mit Klammern/Anführungszeichen.
