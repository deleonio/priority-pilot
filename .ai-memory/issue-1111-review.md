# Issue 1111 — Review PR #1113, Stand 2026-08-29T07:38:00Z (Runde 2 = Fixup-Nachweis)

**ERGEBNIS: VERDICT reviewed (🟢), Sammelkommentar-ID 5460977535 aktualisiert (Review-Typ: Fixup-Nachweis). F1 behoben, keine offenen/Entscheidungs-Findings, CI grün.**

## Erledigt
- MODE per Marker: `<!-- ai-review -->`-Kommentar gefunden (ID 5460977535, updatedAt 2026-08-29T07:08:10Z, Runde 1 = needs-fixup mit F1) → Fixup-Verifikation, nur Delta geprüft.
- Delta: Commit `aef73adb` (07:18:08Z) = EINZIGER Code-Commit seit updatedAt; `7d4b8958`/`a61b697c` nur `.ai-memory`. Diff +8/−8 in `frontend/src/components/AddressAutocomplete.test.tsx`: alle 8 `getByRole('textbox')` → `getByRole('searchbox')` (Zeilen 94, 111, 137, 174, 185, 213, 230, 257) — exakt die freigegebene F1-Lösung.
- Verifiziert: 0 verbleibende `Role('textbox')`-Queries im Repo (einziger grep-Treffer = Kommentar `frontend/e2e/pillar-advisor.spec.ts:90`); e2e `issue-1111-coords-box.spec.ts` nutzt `getByLabel`/`group`/`option` — nicht betroffen; Produktivcode (AddressAutocomplete.tsx, TaskForm.tsx) unangetastet.
- CI: Run 33240772440 (Head a61b697c) `verify` ✅ + Shards 2–4 ✅, Shard 1 ✗ auf `delete-dialog-focus.spec.ts:365` (AK9 Serien-Löschdialog, toBeFocused-Timeout). Als Flake eingestuft: Run 33240531727 auf **Byte-identischem Code** (aef73adb, nur `.ai-memory`-Delta dazwischen, per compare-API verifiziert) war 07:18 UTC komplett grün → `gh run rerun --failed` ausgelöst, Rerun ✅ (alle Jobs grün).
- Titel-Gate: `feat(frontend): show resolved coordinates in the task form (#1111)` = 66 Zeichen, Conventional Commits erfüllt → kein Rename.
- Sammelkommentar gepatcht (F1 in „Behobene Anmerkungen“, Footer Fixup-Nachweis).

## Relevante Stellen
- `frontend/src/components/AddressAutocomplete.test.tsx:94` — Helper `typeQuery`; alle anderen 7 Queries nutzen denselben Feld-Zugriff.
- `frontend/e2e/delete-dialog-focus.spec.ts:365,404` — AK9-Fokus-Timing-Test, Quelle des einmaligen Flake-False-Alarm (nicht Teil dieses PR).

## Annahmen
- Flake-Bewertung stützt sich auf Byte-Identität des Codes (compare aef73adb...a61b697c → nur `.ai-memory/issue-1111-fixup.md`) + grünen Rerun; kein lokaler Testlauf möglich (node_modules absent in der Runner-Sandbox).
- Unit-Grünheit über `verify`-Job abgeleitet (derselbe Job, der in Runde 1 die 9 Fehler zeigte, jetzt ✅).

## Verworfen
- needs-fixup wegen des e2e-Flakes — Fixup kann Flakes nicht beheben; Rerun ist der billige, beweiskräftige Weg.
- Neuer Finding zur Fixup-Notiz („15 Vorkommnisse“ vs. real 8) — reine Zahlenabweichung in einer `.ai-memory`-Prozessnotiz, kein Codefehler; nur als Hinweis im Sammelkommentar vermerkt.
- Voll-Diff-Re-Review — gem. SKILL Step 5 (Diff-Scoping) nicht vorgenommen; Runde-1-Ergebnis als verbindlich übernommen.

## Offen
- -

## Nächster Schritt
- Merge-Entscheidung beim Menschen/Gate; keine weitere Review-Runde nötig.

## Fallstricke
- Fixup-Phasennotizen können falsche Zahlen enthalten (hier „15 Vorkommnisse“, real 8) — immer selbst zählen, nicht aus der Notiz zitieren.
- e2e-Shard-1-Flake (`delete-dialog-focus.spec.ts` AK9) existsiert unabhängig vom PR-Inhalt: vorher „ganz grün“-Run auf identischem Code zum Abgleich heranziehen, statt den Fehler dem Diff zuzuschreiben.
- `gh run list --jq '.databaseId'` in Kombination mit `startswith()` auf headSha wirft „function not defined“ — Felder direkt per Objekt-Indexierung lesen.
