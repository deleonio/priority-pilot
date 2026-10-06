# Spec #2221 — Einstieg „Erste Schritte“ im Dashboard

## Ziel

Nach dem Onboarding-Flow zeigt das Dashboard einen schließbaren Einstieg mit 3 Schritten, die sich abhaken.

## Vertrag

- Komponente `WelcomeSteps` (`frontend/src/components/WelcomeSteps.tsx`), Props `tasks`, `onOpenPillars`, `onOpenSuggestion`; Export `startWelcomeSteps()` setzt den Marker (localStorage, Muster `CareHint`).
- Marker setzt `OnboardingFlow` beim Abschluss (Übernehmen, „Später“, Import), VOR der Navigation. Ohne Marker (Bestandskonto) rendert nichts (AK4).
- Wurzel `[data-testid="welcome-steps"]` (Region „Erste Schritte“), Schritte als `li[data-step="task|pillars|suggestion"]` mit `data-done="true|false"` und sichtbarem Text „erledigt“.
- Schritt `task` erledigt, sobald `tasks.length > 0` (AK2). `pillars`/`suggestion` erledigt, sobald der Schritt-Button geöffnet wurde (ruft `onOpenPillars` / `onOpenSuggestion`).
- Schließen-Button „Einstieg schließen“ (≥ 44 px) oder alle Schritte erledigt → Zustand endgültig erledigt, auch nach Reload kein Einstieg (AK3).
- Mobile (375 px): Karte vollständig im Viewport (AK5).
- Das Dashboard rendert `<WelcomeSteps />` über `<CareHint />`.
