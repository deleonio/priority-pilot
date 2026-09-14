# Spec: Issue #1484 — T3b Badges und Angebote auf die übrigen Grenzstellen ausrollen

Quelle: harness marker comment (KI-ANALYSE, stand=2026-09-14T16:29:49Z) + KI-UX-Block.

Voraussetzung (auf main, T3a #1458): `PlanBadge` (`frontend/src/components/PlanBadge.tsx`),
`PlanOfferDialog` (`App.tsx:1135`), `usePlan`/`useEntitlement` (`frontend/src/lib/usePlan.ts`),
`useClosingOnPlanRequired` (`frontend/src/lib/useClosingOnPlanRequired.ts`). T3b fügt **keine**
neuen Mechanismen hinzu, nur weitere Grenzstellen.

## AK1/AK2 — Katalog-Korrektur (Autoren-Entscheidung A1/B1)

**Ziel:** `server/src/logics/plans.ts`, `FEATURE_CATALOG`:

- `voice_input` → `allowedPlans: ['pro', 'max', 'ultimate']` (bisher alle vier Pakete).
- `mcp_readwrite` → `allowedPlans: ['ultimate']` (bisher `['max', 'ultimate']`).

**Testfälle:** `server/src/logics/plans.test.ts`, Describe „Entitlement-Auswertung je Paket":

- AK1: `getEntitlements('free').voice_input` → `allowed: false`, `requiredPlan: 'pro'`;
  `pro`/`max`/`ultimate` → `allowed: true`.
- AK2: `getEntitlements('max').mcp_readwrite` → `allowed: false`, `requiredPlan: 'ultimate'`;
  nur `ultimate` → `allowed: true`.
- Die bisherige Erwartung „Max mit mcp_readwrite" (Zeile aus T1 #1456) widerspricht AK2 und wurde
  entfernt (Test-Pflege-Bedarf, s. PR-Body).

## AK3/AK4 — Acht Grenzstellen tragen `<PlanBadge feature="…" />`

**Ziel:** Jede der acht Bedienstellen rendert dauerhaft `<PlanBadge feature="<id>" />` mit dem
zugeordneten Feature-Identifier; im DOM nachweisbar über `data-testid="plan-badge-<feature>"`.
Keine Zielkomponente wertet den Plan-Wert selbst aus — Badge-Ausgabe kippt ausschließlich mit der
gemockten Entitlement-Map (AK4).

| Komponente                                                 | Feature-Identifier   | Testdatei                        |
| ---------------------------------------------------------- | -------------------- | -------------------------------- |
| `GroupDetail.tsx` (Kopfbereich, `KolHeading "Mitglieder"`) | `groups`             | `GroupDetail.test.tsx`           |
| `GroupFormDialog.tsx` (Modal-Kopf)                         | `groups`             | `GroupFormDialog.test.tsx` (neu) |
| `AddressAutocomplete.tsx` (Feld-Zeile)                     | `location_reminders` | `AddressAutocomplete.test.tsx`   |
| `PlaceFavoritesSection.tsx` (Karte „Gespeicherte Orte")    | `location_reminders` | `PlaceFavoritesSection.test.tsx` |
| `NearbyCard.tsx` (Kartenkopf)                              | `location_reminders` | `NearbyCard.test.tsx`            |
| `VoiceField.tsx` (Mic-Button-Umfeld)                       | `voice_input`        | `VoiceField.test.tsx`            |
| `TaskForm.tsx` (Lektorat-Buttons + „Säulen vorschlagen")   | `ai_assist`          | `TaskForm.test.tsx`              |
| `ApiTokensSection.tsx` (`ScopeToggle`-Zeile)               | `mcp_readwrite`      | `ApiTokensSection.test.tsx`      |

**Testfälle AK4 (stellvertretend):** `NearbyCard.test.tsx` und `ApiTokensSection.test.tsx` rendern
dieselbe Komponente je zweimal mit unterschiedlicher `PlanProvider`-Entitlement-Map
(`allowed: true` → Haken-Badge; `allowed: false` → Paket-Badge), ohne dass die Komponente selbst
den `plan`-Wert abfragt.

## AK5 — (i)-Schalter feuert `pp:plan-required`, kein zweiter Dialog

**Ziel:** Der (i)-Schalter jeder Grenzstelle (`data-testid="plan-badge-info-<feature>"`) feuert
genau ein `pp:plan-required`-Event mit `{ feature, requiredPlan, currentPlan }`. Es entsteht keine
zweite Angebots-Komponente — bereits durch `PlanBadge` selbst sichergestellt (T3a); hier nur an
zwei Referenzstellen erneut geprüft (`ApiTokensSection.test.tsx`, `GroupDetail.test.tsx`).

## AK6 — `VoiceField` löst ohne `voice_input`-Entitlement keine Aufnahme aus

**Ziel:** Ohne Entitlement öffnet ein Klick auf den Mic-Button das Angebot
(`pp:plan-required`-Event) statt `startRecording` aufzurufen; `autoStart` startet ebenfalls nicht.
Mit Entitlement bleibt das Verhalten aus #264/#283 unverändert (genau 1× `startRecording`).

**Testfälle:** `VoiceField.test.tsx`, neue Describe-Blöcke mit `PlanProvider`-Wrapper und
`useVoiceInput`-Mock (bestehendes Test-Double in derselben Datei).

## AK7 — `GroupFormDialog` schließt sich vor dem Angebot (kein Modal-in-Modal)

**Ziel:** `GroupFormDialog.tsx` ruft `useClosingOnPlanRequired(onClose)` wie `DependencyModal.tsx:124`
und `QuickCaptureModal.tsx:179` — bisher fehlt der Aufruf (KI-UX-Block). Ein `pp:plan-required`-Event
während der Dialog offen ist, ruft `onClose` genau einmal auf.

**Testfälle:** `GroupFormDialog.test.tsx` (neu), Muster
`QuickCaptureModal.test.tsx` Describe „weicht dem Angebots-Dialog (#1458, Entscheidung 7.1)".

## AK8/AK9 — Mobile 375×812, kein zusätzlicher Preis-/Bannertext

**Ziel:** Bei 375×812 bricht das Badge in engen Zeilen um (`TaskForm.tsx` Titel-/Beschreibungszeile,
`ApiTokensSection.tsx` Scope-Zeile) ohne horizontalen Overflow der Container (Bounding-Box, nicht
`scrollWidth`, s. `.ai-memory/MEMORY.md` 2026-08-24). Außerhalb von `PlanBadge`/`PlanOfferDialog`
erscheint kein Preis-/Werbetext.

**Testfälle:** `frontend/e2e/issue-1484-plan-badges.spec.ts` (neu), Style `crud.spec.ts`.

## Offene Fragen

- keine (alle acht Zielstellen und beide Katalog-Korrekturen sind mit bestehenden T3a-Mechanismen
  testbar; keine neue Komponente nötig).
