# Review-Notizen PR #1030 (Issue #1028, KolAlert-Host Padding+Radius)

## Erledigt
- MODUS bestimmt: Kreuzverhör (Erst-Review) — kein `<!-- ai-review -->`-Kommentar vorhanden (gh api issues/1030/comments leer gefiltert).
- PR-Metadaten + vollständiger Diff gelesen (4 Dateien: MEMORY.md, docs/spec/issue-1028.md, e2e-Spec, app.css).
- Issue #1028 Body inkl. KI-ANALYSE-Block gelesen; AK1–5 mit PR-Belegen abgeglichen: alle gedeckt.
- Design-Entscheidung verifiziert: deleonio-Kommentar 2026-08-25T15:16:18Z existiert („Radius am Host, Fläche über KoliBri-Custom-Properties, #930 bleibt").
- Gewaltenteilung geprüft: `git diff e203bf5..HEAD -- <spec-file>` = leer → Spec-Tests seit Rot-Commit unverändert ✓.
- CI: e2e (4 Shards) + verify + precheck grün, nur review pending.
- KoliBri-First: kolibri-mcp spec/alert zeigt KEINE Custom-Properties für Padding/Radius (nur `_variant card|msg`); Variante würde ~40 Stellen ändern (widerspricht SOLL) → Host-CSS mit dokumentierter Entscheidung konform.
- Dedup AK4 verifiziert: frontend/e2e/issue-930-transparent-backgrounds.spec.ts existiert, prüft kol-alert-Transparenz Light+Dark (Zeilen 18/42/93/151).
- Impeccable-Detektor nicht lauffähig: `.claude/skills/impeccable/` existiert in diesem Checkout nicht (nur knowledge-graph, review-kreuzverhoer) — nicht als Finding gewertet (Umgebung, nicht PR).

## Relevante Stellen
- frontend/src/app.css:1805–1813 — neuer `kol-alert`-Block (padding 0.25rem, radius 0.375rem), Finding F2 (Kommentar-Wortlaut Zeile 1808).
- frontend/e2e/issue-1028-alert-host-padding-radius.spec.ts:143–151 — Finding F1: scrollWidth-Assertion strukturell zahnlos (Memory 2026-08-24, overflow-x hidden clippt Shell).
- frontend/src/app.css:1782 — #930-Block (Hintergrund transparent), unmittelbar vor neuem Block, kein Konflikt.
- frontend/src/app.css:1482 — `.settings-switch-row kol-alert` (flex 0 1 40%), Spezial-Kontext, kein Padding-Override → globale Regel greift dort.
- frontend/src/components/SettingsPage.tsx:168 — micDenied-Alert (Test-Fixtur-Grundlage).

## Annahmen
- CI-Checks (e2e/verify) liefen auf dem PR-Head a466fe4 — gh pr checks zeigt sie dem Head zugeordnet.
- bbox-vs-Container-Check sichert transitiv auch den Viewport (`.settings-general` ist block-level im Tab-Panel, Breite von Ahnen Kaskade ≤ Viewport) — daher F1 nur redundante, keine fehlende Abdeckung.

## Verworfen
- „Host-Radius visuell wirkungslos → PR löst Issue nicht" als Finding: SOLL + Mensch-Entscheidung sagen ausdrücklich „am Host", Spec dokumentiert Limitation in „Abgrenzung" — keine Re-Litigation der Menschen-Entscheidung.
- KoliBri `_variant="card"` als KoliBri-First-Alternative: widerspricht Issue-SOLL („ohne Anpassung der ~40 Stellen") und dokumentierter Entscheidung.
- waitForStableView('Priority Pilot') bei 320px als Risiko (Memory: auf `/` versteckt): CI mit diesem Test bei 320px grün — empirisch widerlegt.

## Offen
- -

## Nächster Schritt
- Runde abgeschlossen (2026-08-25): Review 5021294638 (2 Inline-Findings F1/F2) gepostet, Sammelkommentar 5413389544 angelegt, PR-Titel → `feat(frontend): padding and radius for kol-alert host (#1028)`, Verdict needs-fixup. Nächste Runde = Fixup-Nachweis (Kommentar 5413389544 fortschreiben, F1/F2 gegen Fixup-Diff verifizieren).

## Erledigt (Runde 1)
- Titel-Gate: PR-Titel auf Conventional Commits umbenannt.
- Review gepostet (event=COMMENT, id 5021294638): F1 spec-file:151 scrollWidth zahnlos, F2 app.css:1808 Kommentar-Wortlaut.
- Sammelkommentar angelegt (id 5413389544, Marker `<!-- ai-review -->`).

## Fallstricke
- Folge-Runde (Fixup-Nachweis): Sammelkommentar-ID suchen statt neu anlegen; Finding-Nummern F1/F2 stabil lassen.
- Der scoped `.settings-switch-row kol-alert`-Block (app.css:1482) hat HÖHERE Spezualität als der neue globale Block — falls künftig Padding dort nötig ist, dort überschreiben.
