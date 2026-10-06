# Spec #2222 — Onboarding: „Später“ über einen Reload hinweg merken

Erweitert `docs/spec/issue-2070.md` (Wiedereinstieg über den EmptyState).

## Ziel

Wer im Willkommens-Dialog „Später“ wählt (oder ihn per Esc/X schließt bzw. den Import-Verweis nutzt), wird nach Reload oder
Neustart nicht erneut vom Dialog unterbrochen. Der Wiedereinstieg bleibt über „Flow fortsetzen“ auf dem EmptyState möglich.

## Vertrag

- Modul `frontend/src/lib/onboardingPreferences.ts` (Muster `balancePreferences.ts` / `usePlan.ts`-Spiegel, Best-Effort):
  - `onboardingDismissKey(userId)` → `pp-onboarding-dismissed-<userId>` (je Nutzer ein Schlüssel).
  - `isOnboardingDismissed(userId)` → `true` nur bei gespeichertem Wert `'true'`; sonst, auch bei werfendem Storage, `false`.
  - `storeOnboardingDismissed(userId, dismissed)` → `true` schreibt den Schlüssel, `false` löscht ihn; Storage-Fehler werden still ignoriert.
- `App.tsx` initialisiert `onboardingDismissed` aus diesem Spiegel und schreibt jede Änderung mit (Später/`onClose`/Import → `true`,
  „Flow fortsetzen“ → `false`).

## Ablauf (Nutzerperspektive)

| Schritt                                | Erwartung                                                            |
| -------------------------------------- | -------------------------------------------------------------------- |
| Neues Konto, 0 Aufgaben, kein „Später“ | Dialog öffnet sich wie bisher (AK2, durch #2069/#2070-Specs gedeckt) |
| „Später“ klicken, neu laden            | Dialog bleibt zu, EmptyState sichtbar (AK1)                          |
| Nach Reload „Flow fortsetzen“          | Flow offen, Schritt 1 (AK3)                                          |
| Anderer Nutzer im selben Browser       | Merker von Nutzer A wirkt nicht (AK4)                                |
| `localStorage` wirft                   | Lesen = nicht verworfen, Schreiben ohne Exception (AK5)              |
