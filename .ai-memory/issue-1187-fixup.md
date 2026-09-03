# Issue 1187 — Fixup (PR #1195), Runde 2, Stand 2026-09-03

## Erledigt
- **Runde 1 (SHA 5aac8f33, abgeschlossen):** F1 Fake-MQL-Stub-Verkabelung
  (`frontend/src/lib/reducedMotion.test.ts:28-56`), F2 Guard gestrichen
  (`frontend/src/lib/reducedMotion.ts:20-33`), e2e-Lokator `.settings-general kol-alert` +
  AK2-Tab-Klick-Gate (`frontend/e2e/issue-1187-reduced-motion.spec.ts:75-79,101-121`).
  Gate grün, 4/4 e2e lokal, beide Review-Threads via GraphQL resolved, gepusht.
- **Runde 2 (dieser Lauf, SHA 86b57339):** Review-Kommentar zeigt keine neuen Findings
  („Keine Entscheidungs-Findings", offene F1/F2 bereits von Runde 1 behoben + Threads resolved).
  CI-Audit: `verify` grün, e2e (1)/(2)/(4) grün, **e2e (3) rot** —
  `issue-969.spec.ts:86` AK4: `toBeVisible()` ok, danach `boundingBox()` = null
  (Playwright-Race beim KolTabs-Panelwechsel; Issue #969 thematisch unbeteiligt).
- Flaky-Nachweis: e2e (3) lief in beiden früheren Verify-Läufen des Branches grün
  (33703975288 auf SHA caed9e57 = vor Fixup, 33703544237); Diff caed9e57→86b57339
  berührt nur Unit-Stub, verhaltensneutrale Guard-Entfernung, eigenen e2e-Spec.
- `gh run rerun 33705162974 --failed` angestoßen (nur e2e (3)).

## Relevante Stellen
- `frontend/e2e/issue-969.spec.ts:86-135` — AK4 misst `[slot="tabpanel-slot-1"/"-2"]`-Insets;
  Zeile 113-115 = Race-Stelle (`waitFor attached` garantiert keine Sichtbarkeit beim boundingBox-Call).
- Verify-Run 33705162974 — Shard-Aufteilung: issue-969.spec.ts in Shard 3/4.

## Annahmen
- Rerun wird grün (Fehlerbild 1/137, nur Timing); wenn wieder rot: echtes Problem prüfen,
  dann lokalen Lauf `npx playwright test e2e/issue-969.spec.ts` im `frontend`-Dir.

## Verworfen
- Fix am issue-969-Test (z. B. `toBeVisible` nach boundingBox-Schleife) — außerhalb des
  Fixup-Scopes (PR 1195 / Issue 1187); wenn der Flake wiederkehrt, separates Ticket-Thema.

## Offen
- Rerun-Ergebnis von 33705162974 (e2e (3)) abwarten.

## Nächster Schritt
- Rerun prüfen: grün → Lauf beenden (kein Commit nötig, alles erledigt); rot → Log lesen,
  lokalen Lauf reproben, echten Fehler fixen oder Flake dokumentieren.

## Fallstricke
- Keine Labels setzen (Workflow macht das selbst).
- Bei „alles erledigt, kein Commit": VERDICT already-done + ai-fixup-decisions-Kommentar
  nur falls Findings-Tabelle befüllbar ist — hier: F1/F2 wurden in Runde 1 per Commit
  5aac8f33 behoben, Threads bereits resolved.

## Nachtrag (Runde 2, nach Deadline-Ablauf)
- Rerun von 33705162974 ebenfalls ROT: wieder `issue-969.spec.ts:86` AK4, 136/137 passed
  (02:17:35Z) → KEIN Einzel-Flake, reproduzierbar auf SHA 86b57339, obwohl e2e (3) auf
  SHA caed9e57 (33703975288) und 19a932e4 (33703544237) grün war.
- Widerspruch offen: Diff caed9e57→86b57339 = nur 5aac8f33 (+Memory-Commits). Guard-Entfernung
  in reducedMotion.ts ist in echten Browsern verhaltensneutral; Unit-Stub berührt e2e nicht.
  Nächster Lauf MUSS das lokal reproduzieren: `cd frontend && npx playwright test e2e/issue-969.spec.ts`
  auf 86b57339. Lokal grün + CI 2× rot → CI-Umgebungs-Race (KolTabs-Panelwechsel boundingBox null);
  dann: Test-Stabilisierung (boundingBox-Retry/expect.poll) als Test-Pflege im Fixup-PR rechtfertigen
  oder als eigenen Befund im ai-fixup-decisions dokumentieren.
- Kein Commit der Code-Änderungen nötig gewesen; dieser Lauf hat nur Diagnose + Rerun gemacht.
