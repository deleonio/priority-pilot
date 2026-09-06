# Issue 1243 — Documenter (Phase 7), Stand 2026-09-06

**ERGEBNIS: `/tmp/doc.json` geschrieben, `jq`-Validierung grün.** PR #1243 (merged, Titel `feat(frontend): apply master-detail settings pattern with KolDetails`, Autor deleonio, Label `ai:reviewed`) klassifiziert als **improved** — UX-Verhaltensänderung, kein neues Feature-Objekt, kein Bugfix. Titel leer gelassen (compliant + Typ passt). `issues: []` — `closingIssuesReferences` ist leer und der Body enthält kein "Closes/ Fixes #N" (verifiziert per `gh pr view --json closingIssuesReferences` → `[]`; Referenzen auf #1085/#1098/#1227/#930 im Body sind Kontext, keine Schließungen).

## Erledigt
- `gh pr view 1243` + voller Diff gelesen (`/tmp/pr1243.diff`), Kerndatei-Diffs extrahiert (`SettingsPage.tsx`, `app.css`, `docs/spec/issue-1098.md`).
- Output `/tmp/doc.json` per Bash-Heredoc geschrieben (Write-Tool darf nicht nach /tmp — MEMORY 2026-08-26), danach `jq .` OK; Tippfehler ("koloppelnden") per python-Replace korrigiert und erneut validiert.
- 8 Dateien dokumentiert (SKILL erlaubt 3–8): Kern = SettingsPage.tsx + app.css, dann Pattern-Doc, Spec, 2 e2e-Specs, 2 Referenz-Docs. `docs/spec/issue-1080.md` (1 Zeile) und `frontend/e2e/{issue-969,settings-switch-layout}.spec.ts` bewusst weggelassen (Rand-Kollateral).

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx:384,517-536,592ff` — drei Settings-Paare auf Master-Detail umgestellt: `KolDetails _open={animationsEnabled}` / `KI-Funktionen-Details _open={aiEnabled}` (Schnellerfassung hinein verschoben, `_disabled={!aiEnabled}` bleibt) / Geo-Regler in „Standort-Details" (kollabiert jetzt statt sichtbar-disabled — bewusste Änderung ggü. #1098 AK3).
- `frontend/src/app.css:1847-1867,2221` — `.settings-llm-switch-row--sub`-Einzug (mobil 1.25rem, ≥768px 2.5rem); `kol-details` in die App-weite KoliBri-Host-Transparenz-Liste aufgenommen (#930).
- `docs/ux-pattern-master-detail-settings.md` — NEU (95 Zeilen), das dokumentierte Pattern.
- `frontend/e2e/issue-1098-geo-settings.spec.ts` + `ai-disable.spec.ts` — an Kollaps-/Details-Verhalten angepasst.

## Annahmen
- Klassifikation `improved` statt `new`: kein neuer Endpunkt/Component-Typ, sondern Generalisierung eines bestehenden Musters + UX-Verhaltensänderung (SKILL: Extension/UX → improved).
- Release-Note-Zielgruppe: Endnutzer — das Auf-/Zuklappen der Sub-Einstellungen ist das sichtbare Verhalten; die Verhaltensänderung bei Geo-Reglern erwähnt.

## Verworfen
- Titelvorschlag — bestehender Titel Conventional-Commits-konform, Typ `feat` passt zu „improved"-Note (SKILL-Regel: empty wenn compliant).
- `issues`-Einträge für #1085/#1098/#1227 — nur Kontext-Referenzen im Body, keine Close-Beziehungen.
- Dateien `docs/spec/issue-1080.md`, `frontend/e2e/issue-969.spec.ts`, `settings-switch-layout.spec.ts` in `files` — unter den 3-8-Slot-Druck, geringster Informationsgehalt.

## Offen
- -

## Nächster Schritt
- Keiner — Phase abgeschlossen; Output liegt an `/tmp/doc.json`.

## Fallstricke
- `gh pr diff <n> -- file1 file2` ist in dieser gh-Version nicht erlaubt („accepts at most 1 arg") — Diff in Datei leiten und lokal awk/python-splitten.
- Kein "Closes #"-Muster im Body ≠ keine verknüpften Issues prüfen: `closingIssuesReferences` explizit abfragen, sonst halluzinierte Issue-Referenzen im Doc-JSON.
