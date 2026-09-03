# Issue 1183 — Spec (Phase 3), Stand 2026-09-02

**Ergebnis: rote Tests + Spec + Draft-PR.** Kein KI-UX-Block (ux=nein). Branch `ai/harness/1183`.

## Erledigt
- `docs/spec/issue-1183.md` neu (AK1–AK5, Test-Abdeckung, Abgrenzungen, Test-Pflege).
- Neu `frontend/src/lib/animations.test.ts` — Speicher-Vertrag: `readAnimationsEnabled`/`storeAnimationsEnabled`, Key `pp-animations-enabled`, Default aus (AK1/AK3).
- `frontend/src/lib/confetti.test.ts` erweitert: Datei-Level `beforeEach` setzt Key auf 'true' (Test-Pflege für #1169-Tests) + neuer Describe #1183 (Key absent → false/kein Overlay, Key true → Overlay, Key true + reduce → kein Overlay = AK2/AK4).
- `frontend/src/components/SettingsPage.test.tsx` erweitert (neuer Describe #1183): Schalter „Animationen" in tab-0, initial aus ohne Key, `_on.onChange` schreibt Key 'true'/'false' (Hook NICHT gemockt — localStorage-Vertrag ist Teil der Prüfung; `act` importiert bereits).
- Neu `frontend/e2e/issue-1183-animations.spec.ts`: AK3 frischer Kontext (aus, kein Key), AK1 Toggle + Reload-Persistenz, AK2 aus→kein Overlay / Key true→Overlay, AK5 375×667.
- `frontend/e2e/issue-1169-confetti.spec.ts`: `test.beforeEach` mit addInitScript setzt Key 'true' (Test-Pflege, im PR-Body dokumentiert).

## Relevante Stellen
- `frontend/src/lib/voiceAutostart.ts` — Muster für neues `animations.ts` (read/store + Hook).
- `frontend/src/lib/confetti.ts:74` — `launchConfetti()`, hier kommt das Gate vor dem reduced-motion-Frühcheck bzw. kombiniert rein.
- `frontend/src/components/SettingsPage.tsx:242` — tab-0-Panel; Schalter dort ergänzen (Impl).
- `frontend/e2e/voice-autostart.spec.ts` / `issue-1169-confetti.spec.ts` — Muster für Settings-E2E/Erledigt-Toggle.

## Annahmen
- Export-Namen `readAnimationsEnabled`/`storeAnimationsEnabled` (Tests importieren sie; analog voiceAutostart-Benennung) — für Impl bindend.
- Schalter-Label exakt „Animationen", als `kol-input-checkbox _variant="switch"` nach Voice-Autostart-Muster.
- AK2-E2E „Schalter an" via localStorage-Key (addInitScript) statt UI-Toggle — Äquivalenz durch AK1-Test (Schalter↔Key) gesichert.
- E2E rot-Ursache heute: `animationsToggle` matcht nichts (Schalter fehlt) bzw. Overlay-Assertions.

## Verworfen
- Mock von `../lib/animations` in SettingsPage.test.tsx — würde den Key-Schreib-Vertrag (AK1) ausblenden.
- Migration/Vorbelegung alter Geräte — Issue will Default aus ohne Migration.
- Serverseitige Speicherung — Issue textet gerätebezogen (Triage-Annahme, unverändert).

## Offen
- -

## Nächster Schritt
- Impl-Phase: `animations.ts` + Gate in `launchConfetti` + Schalter in SettingsPage tab-0; dann alle roten Tests grün; #1169-E2E bleibt durch beforeEach-Key grün.

## Fallstricke
- Pre-Commit-Knip failt am fehlenden `animations.ts`-Modul → Spec-Commit ggf. `--no-verify` (Memory 2026-09-02); Begründung im PR-Body.
- E2E gezielt laufen lassen: `npx playwright test e2e/<datei>.spec.ts` im `frontend`-Verzeichnis (Memory 2026-08-26).
- jsdom: localStorage gilt pro Testdatei — neuer SettingsPage-Describe räumt den Key in before/afterEach.
- `confetti.test.ts`-Reihenfolge: Datei-Level-beforeEach setzt Key, #1183-Describe überschreibt pro Test (removeItem/setItem).
- CompleteTaskDialog-Pfad bleibt ohne Konfetti; `data-testid="confetti-overlay"` einziger Koppel-Punkt.
