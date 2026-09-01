# PR 1154 — Review (Runde 2: Fixup-Nachweis), Stand 2026-09-01T03:19Z

MODE: Fixup-Nachweis — `<!-- ai-review -->`-Kommentar (id 5488287532, updatedAt 2026-09-01T03:05:19Z)
vorhanden, Runde 1 = Kreuzverhör needs-fixup (F1–F3). Kein Closing-Issue → „Review ohne Issue".

## Erledigt
- Delta seit updatedAt ermittelt: `2c73b87c` (Fixup F1–F3) + `9653bb76` (nur `.ai-memory/issue-1154-fixup.md`, 2 Zeilen).
- F1 ✓ `docs/spec/issue-831.md`: Leerzeile vor `## Ziel` + Trailing-Spaces entfernt (diff-Verifikation).
- F2 ✓ `docs/spec/issue-1105.md:32`: Tabellen-Padding auf längste Zelle `/settings/standort` re-aligniert, `„Standort“` typografisch.
- F3 ✓ `server/src/express/http-error.test.ts:9`: `(siehe docs/spec/issue-1130.md)` gestrichen.
- Sammelkommentar 5488287532 per PATCH aktualisiert: Status reviewed, F1–F3 in „Behobene Anmerkungen", Offene Findings = keine, Footer „Review-Typ: Fixup-Nachweis", Updated 2026-09-01. Marker-Eindeutigkeit verifiziert (1×).
- TITLE GATE: „docs(spec): sync specs to implemented state 2026-09-01" — konformes Conventional-Commits-Format (English, lowercase, ≤72) → keine Änderung.

## Relevante Stellen
- `git show 2c73b87c` — gesamter Fixup-Delta (4 Dateien, +43/−13).
- `.ai-memory/issue-1154-review-body.md` — gesendeter Sammelkommentar-Stand (Wegsprechartefakt).

## Annahmen
- Format-Gate grün: lokale Sandbox hat kein node_modules (`pnpm`/`npx prettier` fehlen) → Verifikation per Diff-Analyse (Prettier-Konventionen erfüllt) + Fixup-Notiz (`prettier --check .` = 0, gelaufen in der Impl-Sandbox). verify-CI pending, nicht rot.
- Kein neues Finding im Delta: `.ai-memory/`-Änderungen sind kein Review-Gegenstand.

## Verworfen
- Lokaler `prettier --check`-Nachweis — Pakete nicht installiert (s. Annahmen).

## Offen
- -

## Ergebnis
- **VERDICT: reviewed (🟢)** — F1–F3 verifiziert behoben, keine neuen Probleme.

## Nächster Schritt
- Workflow: Label-Überleitung zu ready-to-merge sobald verify/e2e grün (Gate degradiert bei Rot automatisch).

## Fallstricke
- Review-Sandbox ohne node_modules — Gates hier nicht reproduzierbar; auf Fixup-Notiz + CI verlassen und das im Sammelkommentar dokumentieren.
