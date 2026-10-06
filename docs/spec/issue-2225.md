# Onboarding: Import-Schritt erklärt fehlende KI

**Stand:** 2026-10-06

Ohne KI (Paket ohne `ai_assist` oder KI per Einstellung aus) besteht der Erststart-Flow nur aus dem Import („Schritt 1 von 1“). Ein Free-Konto soll dort verstehen, warum es nur den Import sieht und wie es weitergeht.

## Verhalten (`OnboardingFlow`, Import-Schritt)

- **Ohne `ai_assist`** (`allowed === false`): zusätzlich zum `onboarding.importHint` erscheint ein erklärender Satz (i18n-Schlüssel `common:onboarding.importAiHint`, Element mit `data-testid="onboarding-import-ai-hint"`) und der Paket-Hinweis `PlanHint feature="ai_assist"` (`plan-badge-ai_assist`, ADR 0018: Info-Button + Popover, kein Dialog).
- **Mit `ai_assist` und eingeschalteter KI:** weder Satz noch Paket-Hinweis; KI-Pfad unverändert.
- **Paket erlaubt, KI per Einstellung aus (`pp-ai-enabled=false`):** kein Paket-Hinweis (`PlanHint` rendert nur bei `allowed === false`).
- **i18n:** der Schlüssel existiert in allen 10 Locales, nicht leer.
- **Mobile (375 px):** Satz und Import-Button liegen vollständig im Viewport.
