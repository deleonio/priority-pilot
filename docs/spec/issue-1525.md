# Spec: Issue #1525 — KI-Schalter an Paket-Freischaltung koppeln

Quelle: harness marker comment (KI-ANALYSE, stand=2026-09-16T15:48:42Z) + KI-UX-Block.

## Ausgangslage

`SettingsPage.tsx:586-608` rendert den Schalter „KI-Features aktiv"
(`KolInputCheckbox _variant="switch"`) unabhängig vom Paket des Nutzers — jeder Free-Nutzer kann
ihn einschalten, obwohl `ai_assist` laut Entitlement-Katalog (#1484) ein Bezahl-Feature ist.
`App.tsx:685,1054`, `TaskForm.tsx:273,1041,1400` und `SearchModal.tsx:44,67` lesen alle
`readAiPreferences().aiEnabled` direkt und blenden die KI-Bedienelemente ausschließlich anhand
dieser lokalen Präferenz ein — ohne Rücksicht auf die Server-Berechtigung.

## Effektives Gate (AK1–AK5)

**Ziel:** eine neue reine Funktion `computeAiFeaturesEnabled` in `frontend/src/lib/aiPreferences.ts`:

```ts
computeAiFeaturesEnabled({ preferenceEnabled, entitlementAllowed, hasCustomProvider }): boolean
```

- `preferenceEnabled: boolean` — `useAiPreferences().aiEnabled` (unverändert, Default `true`).
- `entitlementAllowed: boolean | undefined` — `useEntitlement('ai_assist')?.allowed`; `undefined`,
  solange die Entitlement-Map noch nicht geladen ist (`usePlan()` liefert initial `{}`).
- `hasCustomProvider: boolean` — mindestens ein Provider mit `kind === 'custom'` aus
  `GET /llm-providers` (Annahme aus dem Analyse-Block: er muss nicht aktiv sein).

**Wahrheitstabelle (bindend, TF3):**

| preferenceEnabled | entitlementAllowed   | hasCustomProvider | Ergebnis | AK  |
| ----------------- | -------------------- | ----------------- | -------- | --- |
| false             | true/false/undefined | true/false        | false    | AK3 |
| true              | true                 | true/false        | true     | AK2 |
| true              | false                | true              | true     | AK4 |
| true              | false                | false             | false    | AK1 |
| true              | undefined            | true/false        | false    | AK5 |

`undefined` (Entitlements noch nicht geladen) gilt IMMER als gesperrt, auch mit eigenem
Custom-Provider — sicherer Default, kein Aufblitzen in beide Richtungen (AK5, KI-UX-Block:
„kein Aufblitzen in beide Richtungen").

Die Konsumenten (`App.tsx`, `TaskForm.tsx`, `SearchModal.tsx`) ersetzen ihr direktes
`readAiPreferences().aiEnabled` durch das effektive Gate — Verdrahtung ist Sache der
Implementierungsphase (kein eigener AK hier, da rein strukturell).

## Schalter + Paket-Alert in den Einstellungen (AK1/AK2/AK6)

**Ziel:** `SettingsPage.tsx`, Karte „KI-Funktionen" (`.settings-llm-switch-row`):

- Ohne `ai_assist`-Berechtigung UND ohne Custom-Provider: `KolInputCheckbox _disabled`, darüber
  (DOM-Reihenfolge, nicht nur CSS-`order` — WCAG 1.3.2, KI-UX-Block) ein `KolAlert _type="info"`
  mit dem Paketnamen aus `requiredPlan` (`planLabel(...)`, `frontend/src/lib/planOffers.ts:43`)
  und einem `KolButton` als Kind, der `tabsCallbacks.onSelect(new Event('select'),
PLANS_TAB_INDEX)` aufruft (Muster `SubscriptionSection.tsx` → `SettingsPage.tsx:777`).
- Mit `allowed === true`: Schalter bedienbar wie bisher, kein Paket-Alert.
- Ein Klick auf den CTA ändert den Schalter-Zustand nicht (kein Seiteneffekt zwischen Alert und
  Checkbox, KI-UX-Block).
- 375px: der Alert liegt vollbreit über dem Schalter (getrennte Zeilen, Alert-Unterkante oberhalb
  der Schalter-Oberkante); die Karte bleibt innerhalb des Viewports (kein horizontaler Overflow).

## Free-Konto ohne Berechtigung: keine KI-Bedienelemente erreichbar (AK3)

**Ziel:** bei `pp-ai-enabled = 'true'` und fehlender Freischaltung ist KEIN KI-Bedienelement
erreichbar — weder der KI-Anlege-Dialog (`App.tsx:1054`, `QuickCaptureModal`) noch die
Lektorat-Buttons (`TaskForm.tsx:1041,1400`) noch die KI-Auswertung in `SearchModal.tsx:67`.
„Neuen Task anlegen" öffnet stattdessen direkt das normale Task-Formular (wie bei
`aiEnabled=false` in #1335).

## Testfälle

- **TF1 (AK1)** — Vitest `frontend/src/components/SettingsPage.test.tsx`, Describe
  „SettingsPage – #1525: KI-Schalter Paket-Sperre (AK1/AK2)": `PlanProvider`-Wert
  `ai_assist: {allowed:false, requiredPlan:'pro'}` → Schalter `_disabled`, Alert mit „Pro" im
  DOM vor dem Schalter, Klick auf den CTA ruft `onTabChange(6)`.
- **TF2 (AK2)** — dieselbe Describe: `allowed:true` → kein Paket-Alert, `_disabled` nicht gesetzt,
  `onChange` schreibt weiterhin `pp-ai-enabled`.
- **TF3 (AK1/AK3/AK4/AK5)** — Vitest `frontend/src/lib/aiPreferences.test.ts`, Describe
  „aiPreferences – computeAiFeaturesEnabled (#1525 AK1/AK3/AK4/AK5)": vollständige
  Wahrheitstabelle (12 Zeilen) der neuen Funktion `computeAiFeaturesEnabled`.
- **TF4 (AK3)** — e2e `frontend/e2e/ai-disable.spec.ts`, Describe „#1525 KI-Gate: Free-Konto ohne
  Berechtigung": Free-Konto (`POST /auth/test-login`) mit vorbelegtem `pp-ai-enabled='true'` →
  KI-Anlege-Dialog öffnet nicht, Lektorat-Buttons fehlen; bestehender Pro-Pfad in derselben Datei
  bleibt unverändert grün.
- **TF5 (AK1/AK6)** — e2e `frontend/e2e/issue-1525-ki-schalter-paket.spec.ts` (neu, Stil
  `issue-1484-plan-badges.spec.ts`): Free-Konto, `/settings/llm`, 375×812 → Schalter deaktiviert,
  Alert sichtbar mit Sprung-CTA zum Pakete-Reiter, Bounding-Box-Vergleich Alert vs. Schalter
  (Alert oberhalb, gleiche linke Kante) und Karte innerhalb von 375px.

## Offene Fragen

- keine (laut Analyse-Block).
