# Issue 1080 — Review-Phase-Notizen (Kreuzverhör Runde 1, 2026-08-28)

## Erledigt
- MODE = Kreuzverhör (kein `<!-- ai-review -->`-Kommentar vorhanden); Review ohne Issue? Nein —
  `closingIssuesReferences` length = 1 (#1080), AK1–AK6 aus dem KI-ANALYSE-Block als Massstab.
- Full-Diff geprüft (6a723ff6 rot → 1ca138cf grün), Review **5047911581** mit 2 Inline-Findings
  gepostet (event=COMMENT): F1 `frontend/src/App.tsx:411`, F2 `frontend/e2e/ai-disable.spec.ts:114`.
- Sammelkommentar (id **5448425575**, Marker `<!-- ai-review -->`) erstellt: verdict needs-fixup,
  Sektionen Behobene Anmerkungen (leer) / Entscheidungs-Findings (keine) / Offene Findings (F1, F2).
- Title-Gate: PR umbenannt → `feat(frontend): make ai features disableable (#1080)` (war
  „Settings KI deaktivierbar (#1080)“, kein Conventional Commit).
- **Fixup-Nachweis (Runde 2, 2026-08-28)**: MODE=Fixup-Verifikation (Marker vorhanden, updatedAt
  04:25:25Z). Nur Commit `3dedd201` (04:38:11) geprüft: App.tsx liest `readAiPreferences()` im
  Renderkörper statt `useAiPreferences()`-State (F1 ✅), 2 neue e2e (AK2 Live-Apply nach „Zurück“,
  AK4 Berater-Übernahme-Prefill mit `toHaveValue('Spaziergang am Fluss')`) (F2 ✅). Beide Tests
  nicht tautologisch (F1-Test scheitert am alten gepufferten Zustand). CI auf 3dedd201: verify ✅,
  e2e (1)–(4) ✅ (Run 33142386683, headSha verifiziert). Sammelkommentar 5448425575 per PATCH
  aktualisiert: F1/F2 in Behobene Anmerkungen, verdict **reviewed**, Footer „Review-Typ:
  Fixup-Nachweis“. Body-Datei: `.ai-memory/issue-1080-review-comment.md`.

## Relevante Stellen
- `frontend/src/App.tsx:415` — `readAiPreferences()` im Renderkörper (Fixup); Begründung 408-414
  im Kommentar dokumentiert (kein Remount beim „Zurück“, daher kein gepufferter State).
- `frontend/e2e/ai-disable.spec.ts:127` (AK4-Prefill) und `:181` (AK2 Live-Apply) — neue Fixup-Tests.
- `frontend/src/lib/aiPreferences.ts:33` — `readAiPreferences` best-effort (try/catch je Key),
  Renderkörper-Read damit unkritisch.
- `frontend/src/components/SettingsPage.tsx:81` / `TaskForm.tsx:229` — eigene Hook-Instanz bzw.
  Mount-Read, von F1 unberührt.

## Annahmen
- e2e-Shards decken `ai-disable.spec.ts` ab (4 Shards grün auf 3dedd201) — neue Tests nicht lokal
  nachgelaufen, nur CI-Ergebnis + Diff-Lektüre.

## Verworfen
- Architektur-Finding „KI-Ausblendung nur clientseitig“ — von AKs gedeckt (Runde 1).
- „localStorage-Read je Render = Impurity-Finding“ — bewusst gewählt, im Code kommentiert, kein
  Re-Render-Fehlerpfad (Settings-Toggle triggert selbst Re-Render).
- Neuer Full-Diff-Walk in Runde 2 — Diff-Scoping gemäß SKILL.md step 5.

## Offen
- -

## Nächster Schritt
- Merge durch Mensch/Gate (verdict reviewed abgelegt); keine weitere Review-Runde nötig.

## Fallstricke
- `gh api .../reviews -f body=… -F comments=…` splittert bei Inline-JSON → **JSON-Payload-Datei +
  `--input`** verwenden (hat hier funktioniert).
- `gh pr edit` hat kein `--jq` Flag.
- `gh pr checks` listet `review pending` (ist dieser Lauf selbst) — grün-Bewertung nur auf
  verify/e2e beziehen, Run-headSha gegen den Fixup-Commit gegenprüfen.
- Findings-Nummern F1/F2 stabil halten (in Runde 2 als erledigt übernommen, nicht neu nummeriert).
