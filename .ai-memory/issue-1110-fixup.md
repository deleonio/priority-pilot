# Issue 1110 — Fixup (PR #1114), Stand 2026-08-29

## Erledigt
- Beide Review-Findings (Inline-Kommentare, ai-review = needs-fixup 🔴, KEINE Entscheidungs-Findings mit Options-IDs) als eindeutig eingestuft und gefixt.
- **F1** (e2e-Isolation, CI `e2e (2)` rot — Run 33243489674): `frontend/e2e/issue-1110-nearby-radius.spec.ts` setzt jetzt seine Preconditions selbst — `await setDisplayDistance(page, 5)` vor `page.goto('/')` in ALLEN VIER Tests (AK1 Zeile ~80, AK2 ~90, AK3 ~104, AK4 ~125); zusätzlich `afterEach` setzt auf 5 zurück (nach `deleteAllTasks`), damit die Spec keine Spur hinterlässt. Header-Kommentar um Begründung ergänzt (gemeinsamer E2E-User, #1098 AK7 erhöht auf 6 ohne Reset).
- **F2** (Serien-Save): `frontend/src/components/TaskForm.tsx:673-676` — `if (!isSeriesMode)`-Bedingung gestrichen, `notifyTasksChanged();` bedingungslos; Kommentar um Serien-Begründung ergänzt (Instanzen erben Template-Koordinaten, `server/src/express/routes/series.ts:448`).
- Optionale e2e-Ergänzung „Serien-Instanzen erscheinen ohne Reload in der Nearby-Liste" (F2, ausdrücklich optional) NICHT umgesetzt — Scope-Knappheit, Verhalten durch denselben Listener-Pfad gedeckt wie Normal-Save.

## Relevante Stellen
- `frontend/src/components/TaskForm.tsx:673-676` — Save-Erfolgszweig, `notifyTasksChanged()` vor `onSaved()` (jetzt unbedingungsgesteuert).
- `frontend/e2e/issue-1110-nearby-radius.spec.ts:56-61` — Helper `setDisplayDistance` (PUT /geo-config mit display/alarm/interval); wird jetzt von allen 4 Tests + afterEach genutzt.
- `frontend/e2e/issue-1098-geo-settings.spec.ts:130-152` — Quelle der Kontamination (AK7, ArrowRight auf 6 km, kein Reset) — NICHT geändert (nicht Teil der Findings).

## Annahmen
- Beide Findings sind keine Entscheidungs-Findings: ai-review-Kommentar listet sie ohne Options-IDs (F.1/F.2/F.3) → Fix-Pflicht, kein needs-human.
- Reset auf 5 im afterEach verfälscht #1098 AK7 nicht (läuft in anderer Datei/Shard-Reihenfolge; AK7 setzt den Wert selbst und prüft innerhalb seines eigenen Tests).
- AK3/AK4 profitieren zusätzlich: ohne explizites 5 km könnte ein geerbter Wert von 1 km (1098-Alarm-Schranken) den 2,4-km-Task aus der Liste filtern.

## Verworfen
- Neue e2e für Serien-Save-Signal — im Finding „optional", ADR-0005-Fixup bleibt knapp.
- Änderung an `issue-1098-geo-settings.spec.ts` (Reset dort einbauen) — außerhalb der Findings; unsere eigene afterEach-Reset-Strategie löst das Problem für diese Spec, das fremde Spec-Verhalten ist nicht Gegenstand dieses PR.

## Offen
- -

## Nächster Schritt
- ERLEDIGT, Runde abgeschlossen: Fix-Commit `13f147ad` auf `ai/harness/1110` gepusht (inkl. dieser Note). CI am neuen Head KOMPLETT GRÜN (Run 33243961790: e2e 1–4 pass — auch das zuvor rote `e2e (2)` —, verify pass). Beide Review-Threads beantwortet + resolved; ai-fixup-decisions-Kommentar: https://github.com/deleonio/priority-pilot/pull/1114#issuecomment-5461383315. Kein VERDICT nötig (keine Entscheidungs-Findings). Kein Re-Review angestoßen — nächster Lauf (Re-Review, CI-Phase 7) prüft den neuen Diff.

## Fallstricke
- e2e-Filter-Falle: `pnpm --filter frontend test:e2e -- <pattern>` filtert nicht → `npx playwright test e2e/issue-1110-nearby-radius.spec.ts` im frontend-Verzeichnis.
- `toHaveAttribute('_label', …)`-Muster beibehalten — KoliBri-Mock reflektiert `_label` als Attribut.
- Phasen-Note ist tracked (ADR 0007) und gehört in den Fixup-Commit.
