# Issue 1187 — Documenter (Phase 6, PR #1195), Stand 2026-09-03

**ERGEBNIS:** `/tmp/doc.json` geschrieben, `jq`-Check grün (keys, classification=improved, files=6, issues=1, title leer). Keine gh-Mutationen.

## Erledigt
- `gh pr view 1195` + `gh pr diff 1195` gelesen; 11 Dateien, Kern: `frontend/src/lib/reducedMotion.ts` (neu, Hook `usePrefersReducedMotion`, MediaQuery `(prefers-reduced-motion: reduce)`, change-Event + Cleanup), `frontend/src/components/SettingsPage.tsx` (bedingtes `KolAlert _type="info"` „Bewegung reduzieren aktiv" im Tab Allgemein, Schalter nicht disabled), Tests (unit + e2e `issue-1187-reduced-motion.spec.ts`) + Spec `docs/spec/issue-1187.md` + 5 `.ai-memory`-Phasennotizen.
- Klassifikation **improved** (accessibility-Info-Feature, kein Bugfix, nicht internal).
- Title compliant = true (Input des Aufrufs) → `title`/`title_reason` leer gelassen (SKILL-Regel).
- files: 6 relevanteste (beide Prod-Dateien + 3 Testdateien + Spec); `.ai-memory/*` und übrige bewusst weggelassen.
- issues: `Closes #1187` aus dem PR-Body; Kontext #1169 (Konfetti-Gate) in der Note erwähnt.

## Relevante Stellen
- `frontend/src/lib/reducedMotion.ts` — der neue Hook; Kern des PRs.
- `frontend/src/components/SettingsPage.tsx:~287` — Einfügestelle des Info-Alerts neben dem #1183-Schalter.
- `frontend/src/lib/confetti.ts:78` — Frühcheck greift bereits (AK3), deshalb keine Änderung und keine neuen Tests.

## Annahmen
- improved statt new: nur eine Info-Meldung + Anzeige-Hook, kein neuer Funktionsbereich.
- Konfetti-Dedup war laut PR-Body bereits durch #1183/#1169-Tests gedeckt — nicht selbst nachgeprüft, aus dem Body übernommen.

## Verworfen
- classification `fixed` — Issue ist Enhancement (Sichtbarkeit der OS-Einstellung), kein Fehlerbericht.
- Aufnahme der `.ai-memory/*`-Dateien in `files` — Notiz-Artefakte, nicht release-relevant.
- release_note-Anpassung für „internal" — classification ist improved, normale User-Note.

## Offen
-

## Nächster Schritt
- Aufrufender Workflow: `/tmp/doc.json` in Changelog/Release-Notes verarbeiten.

## Fallstricke
- `Write`-Tool kann nicht nach `/tmp` (Memory 2026-08-26) — doc.json per Bash-Heredoc geschrieben.
- 3 Unit-Tests (AK2c/d/e) im PR-Body als dauerhaft rot dokumentiert (Stub `FakeMediaQueryList` ohne addEventListener) — Absicht (Separation of Duties), kein Dokumentationsfehler.
