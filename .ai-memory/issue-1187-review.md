# Issue 1187 — Review (Phase 5), Stand 2026-09-03 — Runde 2: VERDICT reviewed (🟢)

Modus FIXUP VERIFICATION (Sammelkommentar 5518934005 vorhanden, updatedAt 2026-09-03T01:30:21Z).
Sammelkommentar per PATCH in-place aktualisiert (Review-Status: reviewed, F1/F2 nach
„Behobene Anmerkungen“ verschoben, Footer Review-Typ: Fixup-Nachweis). Titel-Gate: bereits
Runde 1 konform (`feat(frontend): surface OS reduced-motion state in app settings`).

## Erledigt
- Delta seit updatedAt geprüft: einziger Code-Commit 5aac8f33 (01:47:54Z), danach nur
  Memory-Commits (86b57339, d891fc68, 479aeefc — codeidentisch zu 5aac8f33).
- F1 verifiziert: `frontend/src/lib/reducedMotion.test.ts` — Stub um add/removeEventListener
  (nur `type === 'change'`) in die `listeners`-Menge erweitert; AK2a–e-Assertions unverändert
  = exakt die freigegebene Test-Korrektur.
- F2 verifiziert: `frontend/src/lib/reducedMotion.ts` — Guard gestrichen, Registrierung
  bedingungslos wie `theme.ts:101-103`.
- Fixup-Zusätze (nicht angemahnt, aber notwendig) geprüft und akzeptiert: e2e-Lokator
  `.settings-general kol-alert` (Anker verifiziert: SettingsPage.tsx:250, hasText-Filter
  „Bewegung reduzieren“ erhalten) + AK2-Tab-Klick-Gate vor `emulateMedia` (passive-Effect-Race,
  kommentiert am Test). Beides testseitig, kein Produktionscode-Bug.
- CI-Audit: Run 33705162974 (auf 86b57339, codeidentisch) — `verify` SUCCESS,
  e2e (1)/(2)/(4) SUCCESS, e2e (3) FAILURE in `issue-969.spec.ts:86` (fremdes Issue,
  boundingBox-Race nach toBeVisible; in beiden früheren Branch-Läufen 33703975288/33703544237
  grün) → als unrelated Flake eingeordnet, im Sammelkommentar dokumentiert.Aktueller Lauf auf
  479aeefc (02:19Z) IN_PROGRESS; Merge-Gate entscheidet ohnehin deterministisch.
- Neue Findings im Fixup-Diff: keine.

## Relevante Stellen
- `frontend/src/lib/reducedMotion.test.ts:37-45` — Stub-Verkabelung (F1-Fix).
- `frontend/src/lib/reducedMotion.ts:26-28` — unbedingte Registrierung (F2-Fix).
- `frontend/e2e/issue-1187-reduced-motion.spec.ts:75-79,106-113` — Lokator + Tab-Klick-Gate.
- Run 33705162974 — Beweis für verify/e2e-Grün auf codeidentischem Stand.

## Annahmen
- e2e(3) issue-969-Failure ist ein Flake (1/137, Diff berührt nur eigene Spec/Unit-Stub/
  Guard-Entfernung; Fixup-Notiz Runde 2 dokumentiert Rerun-Angestoßen). Falls er im Lauf auf
  479aeefc wieder rot ist, degradiert der Pipeline-Gate selbst auf ai:needs-changes — das
  🟢 hier umgeht nichts.
- „CI rot“-Regel (SKILL Schritt 5) nicht verletzt: auf aktuellem Head ist kein Check rot
  (IN_PROGRESS), der frühere Rot betrifft einen nachweislich unbeteiligten Shard.

## Verworfen
- Warten auf den Lauf auf 479aeefc — dauert ~25 min, übersteht die Soft-Deadline nicht;
  Gate deckt es ab.
- Neues MEMORY.md-Entry — kein neuer Fehler/Experience-Kriterium erfüllt.

## Offen
- Wegwerf-Artefakte NICHT committen: `issue-1187-sammelkommentar.md` (aktualisierter Stand),
  evtl. `issue-1187-review-payload.json` aus Runde 1. Diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- Keiner seitens Review — PR parkt im normalen Flow (Merge-Gate entscheidet bei CI-Grün).

## Fallstricke
- Falls ein Fixup-Nachweis Runde 3 nötig wird: Delta ab Sammelkommentar-updatedAt
  2026-09-03T02:22:34Z; Fund-Nummern F1/F2 sind stabil und bereits in „Behobene
  Anmerkungen“ — nicht erneut aufmachen.
