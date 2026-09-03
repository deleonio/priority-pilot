# Issue 1187 — Review (Phase 5, Kreuzverhör Runde 1), Stand 2026-09-03

**ERGEBNIS: VERDICT needs-fixup (🟡).** Kein `<!-- ai-review -->`-Marker vorhanden →
Kreuzverhör-Modus, ganzer PR. Review 5096865626 (event COMMENT) mit 2 Inline-Kommentaren:
3920207978 (F1, reducedMotion.test.ts:30), 3920207985 (F2, reducedMotion.ts:28).
Sammelkommentar neu erstellt (genau 1 verifiziert). PR-Titel auf Conventional Commits
umbenannt: `feat(frontend): surface OS reduced-motion state in app settings`.

## Erledigt
- Modus bestimmt (Marker-Suche leer), Diff komplett gelesen (700 Zeilen, 9 Dateien,
  +625/−0), Harness-Kommentar 5518110623 (KI-ANALYSE stand=2026-09-03T01:02:30Z) als
  AK-Quelle geladen: AK1–AK6, Ampel 🟢, Closing-Issue #1187 (kein „Review ohne Issue").
- Kreuzverhör: AK-Abdeckung geprüft — AK1/AK4 Unit grün (SettingsPage.test.tsx #1187-Block),
  AK2 E2E grün (emulateMedia ein/aus ohne Reload), AK3 dedup (confetti.test.ts:120 +
  issue-1169 AK6, kein Widerspruch → kein Test-Pflege-Bedarf), AK5/AK6 E2E grün.
  KoliBri-first ✓ (KolAlert), kein `_disabled` ✓, kein neues @media ✓, 375-px per
  Bounding-Box ✓. Produktionscode (Hook, Banner) korrekt und schema-konform.
- Blocker bestätigt: AK2c/d/e rot (Fake-MQL ohne addEventListener-Verkabelung) →
  `pnpm test` Frontend 3 failures, CI-Check `verify` FAILURE (statusCheckRollup geprüft).
  F1 als fixable klassifiziert (Test-Korrektur mit Begründung freigegeben — Assertionen
  bleiben unverändert, überstimmt keine menschliche Entscheidung/ADR → kein decision-Finding).
- Review + Sammelkommentar + Titel-Gate durchgeführt.

## Relevante Stellen
- `frontend/src/lib/reducedMotion.test.ts:28-40` — Fake-MQL: `listeners`-Set ist
  closure-privat, keine Registrierungs-API → F1-Fix genau hier (addEventListener →
  listeners.add bei 'change', removeEventListener → listeners.delete; Interface erweitern).
- `frontend/src/lib/reducedMotion.ts:26-32` — Guard + `return undefined` = F2 (Hausmuster
  theme.ts:101-103 registriert bedingungslos; Guard nur Stub-Workaround).
- `frontend/src/lib/theme.ts:92-103` — Referenzmuster für F2-Vereinfachung.
- `frontend/src/components/SettingsPage.tsx:287-295` — Banner-Block (einwandfrei, kein Finding).
- `frontend/e2e/issue-1187-reduced-motion.spec.ts` — AK1/AK2/AK5/AK6, grün (39,6 s), kein Finding.

## Annahmen
- F1-Fix macht AK2c/d/e gegen den UNVERÄNDERTEN Hook grün (Guard nimmt modernen Zweig);
  E2E beweist Produktionsverhalten unabhängig vom Stub — deshalb Test-Korrektur statt
  needs-human (SKILL: decision nur bei dokumentierter menschlicher Wahl/ADR — liegt nicht vor).
- CI-`verify`-FAILURE = die 3 Unit-Failures (Impl-Notiz + Gate-Protokoll im PR-Body);
  e2e-Shards waren bei Prüfung noch IN_PROGRESS — auch bei Grün bleibt verify der Blocker.

## Verworfen
- 🟢/reviewed — unmöglich: rote Suite + roter `verify`-Check (SKILL Schritt 5: kein 🟢 bei CI rot).
- Test-Pflege-Bedarf als needs-human an den Menschen zurückgeben — PR-Body liefert bereits
  den Korrektur-Vorschlag mit Begründung; Fixture-Vervollständigung überstimmt nichts.
- Weitere Findings (Import-Reihenfolge, `[slot="tab-0"]`-Selektor vs. KolTabs-Rename aus
  MEMORY 2026-08-23) — geprüft und entkräftet: Datei hat keine erzwungene Import-Order,
  Unit+E2E grün beweisen, dass der Selektor hier matcht (Rename betrifft anderes KolTabs-Muster).

## Offen
- Wegwerf-Artefakte in `.ai-memory/`, NICHT committen: `issue-1187-review-payload.json`,
  `issue-1187-sammelkommentar.md`. Nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- Fixup-Runde (Label `ai:needs-changes` setzt der Workflow): F1 (Stub-Verkabelung) + F2
  (Guard aufräumen) umsetzen; danach Fixup-Nachweis-Review (Modus FIXUP VERIFICATION).

## Fallstricke
- Fixup darf NUR die Fixtures/Assertions wie im Inline-Kommentar beschrieben ergänzen —
  Assertion-Texte von AK2a–e nicht anfassen, sonst Separation-of-Duties-Verletzung.
- Fixup-Review (Runde 2): Delta nur seit Sammelkommentar-UpdatedAt; F1/F2 abhaken in
  „Behobene Anmerkungen", Fund-Nummern/Option-IDs stabil lassen; weiterhin Review-Status
  needs-fixup oder → reviewed, wenn `verify` grün.
- KolAlert-Banner-Filter in Tests muss auf Text „Bewegung reduzieren" laufen (Push-Banner
  ist ebenfalls info in tab-0) — Fixup sollte das nicht versehentlich lockern.
