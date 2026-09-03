# Issue 1206 — Review (Phase 5), Stand 2026-09-03

**ERGEBNIS: VERDICT reviewed (🟢), Kreuzverhör Runde 1.** Kein `<!-- ai-review -->`-Kommentar vorhanden → initialer Full-Review. Sammelkommentar erstellt (issuecomment 5530756127). Titel auf Conventional Commits umbenannt: „feat(frontend): aggregate changelog by category with autolinks" (alter Titel hatte kein type(scope)-Präfix). Keine Labels gesetzt.

## Erledigt
- Vollständigen Diff gelesen (12 Dateien, +796/−32): Kern `frontend/src/lib/changelog.ts` (NEU), `HelpPage.tsx`, `HelpPage.test.tsx`, `help-changelog.spec.ts` (NEU), `app.css`, `package.json`+Lockfile (`remark-gfm@^4.0.1`), Spec `docs/spec/issue-1206.md`, 4 Phasen-Notizen.
- AK-Prüfung gegen Harness-Kommentar (issuecomment 5530284307): AK1 ✓ (remarkGfm + `MARKDOWN_COMPONENTS` a-Map, beide Tabs), AK2 ✓ (CATEGORY_TITLES-Reihenfolge, Emoji-Strip via categoryKey, leere Kategorien via flatMap-Filter), AK3 ✓ (Bullets inkl. eingerückter Fortsetzungszeilen; `**Full Changelog**`-Zeile matcht Bullet-Regex `^[-*] ` nicht — char2 ist `*`, kein Space; führender HTML-Kommentar + Pre-Section-Content via `sections.slice(1)` verworfen), AK4 ✓ (375-px-E2E mit 100+-Zeichen-URL + rekursiver Bounding-Box inkl. Shadow-DOM), AK5 ✓ (#1190 AK1/AK5 unverändert, AK2/AK3-Anpassung in Spec-Phase dokumentiert = legitime Test-Pflege).
- Kreuzverhör ohne relevanten Fund: Security ok (react-markdown default urlTransform entschärft javascript:-URLs), keine Regressionen außerhalb des Diff (`.help-changelog-entry/-date` nur in HelpPage verwendet, mit entfernt), KoliBri-first gewahrt (keine neuen Controls, Raw-Headings per UX-Block-Empfehlung), CSS nur Tokens, keine neuen @media.

## Relevante Stellen
- `frontend/src/lib/changelog.ts:39-58` — `categoryKey` (Emoji-Strip `\p{L}\p{N}`), `collectBullets` (`^[-*] ` + Fortsetzungsanhängung), `aggregateChangelog` (split `/^### /m`, slice(1) verwirft Pre-Section-Inhalt).
- `frontend/src/lib/changelog.ts:76` — `entriesToMarkdown` hängt `(vX.Y.Z)`-Suffix an; Markdown im Bullet-Text (Links) bleibt renderbar.
- `frontend/src/components/HelpPage.tsx:31-37` — `MARKDOWN_COMPONENTS` Modulkonstante (target=_blank + noopener noreferrer, zentral beide Tabs).
- `frontend/e2e/help-changelog.spec.ts:271` — LONG_URL-Fixture (`'1234'.repeat(8)`) zwingt `overflow-wrap` in die Pflicht.

## Annahmen
- Tests grün laut Impl-Notiz (Unit 7/7, E2E AK4 + #1190-AK6) — nicht lokal nachvollzogen (Zeitbudget); CI-Gate der Pipeline degradiert bei Rot ohnehin zu ai:needs-changes.
- Unbekannte `###`-Kategorien werden bewusst verworfen (Code-Kommentar dokumentiert die Kopplung an `.github/release.yml`, gleiches Repo) — als spekulative Zukunftshärtung NICHT als Finding gewertet (kein Pseudo-Finding für 🟢).
- `remark-gfm: ^4.0.1` mit Caret statt exakter Pin wie alle übrigen frontend-Deps — kosmetisch, Lockfile pinnt; ebenfalls kein Finding.

## Verworfen
- Needs-fixup wegen Caret-Pin / Unknown-Kategorie-Fallback — beide trivial bzw. spekulativ, würden eine Fixup-Runde für Pseudo-Findings triggern (SKILL verbietet das bei 🟢).
- Inline-Review-Kommentare — keine Findings zu verankern.
- Lokaler Testlauf (Sandbox ohne node_modules, E2E ohne Chromium-Install) — Aufwand > Zeitbudget bis Soft-Deadline.

## Offen
- `.ai-memory/issue-1206-review-comment.md` ist Wegwerf-Artefakt (gesendeter Kommentar-Body) — NICHT committen; nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Pipeline: deterministisches Gate prüft CI/Reviewer-Checks; bei Grün → ai:ready-to-merge, sonst Fixup-Runde (dann MODE Fixup-Nachweis gegen Sammelkommentar 5530756127).

## Fallstricke
- Fixup-Runde: Sammelkommentar-ID 5530756127 per `startswith("<!-- ai-review -->")` finden und UPDATEN (PATCH), nicht neu erstellen; Finding-Nummern starting at — (keine vergeben).
- PR-Titel jetzt Conventional-Commits-konform — bei künftigen Edits nicht zurückbauen.
