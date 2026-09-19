# Spec — Issue #1565: Paket-Selbstwechsel des Admins zieht in den Tab „Pakete" um

Quelle: Akzeptanzkriterien AK1–AK5 aus dem KI-ANALYSE-Block des Harness-Marker-Kommentars von #1565 (+ KI-UX-Block, advisory, hier eingearbeitet). Löst die Auswahl in der eigenen Zeile der Nutzerverwaltung aus #1556 ab (Spec `docs/spec/issue-1556.md` AK2/AK3 — Zeilen-Select entfällt, Server-Vertrag unverändert). Reine Frontend-Umlagerung auf den bestehenden Endpunkt `PATCH /admin/users/{id}/plan` (#1556 / PR #1563, Backend aus #1456).

## Ziel

Admins wechseln ihr eigenes Paket künftig im Tab „Pakete" (`/settings/pakete`, Panel `slot="tab-6"`) über eine eigene Karte über der Vergleichs-Matrix. Die Nutzerverwaltung ist danach rein lesend: Paket je Konto nur noch als Badge, keinerlei Auswahl. Mitglieder sehen die Karte nicht. Kein Zahlungsweg — der einzige Call bleibt `PATCH /admin/users/{id}/plan`.

## Voraussetzungen

- `api.updateUserPlan({ id, plan })` existiert (`frontend/src/api.ts:523`).
- `frontend/src/lib/planOffers.ts` exportiert `planLabel` — einzige Textquelle für Auswahl-Optionen und Badges (kein zweites Label-Array, #1556-Muster).
- Plan-Zustand und `/auth/me`-Refresh kommen aus dem `PlanProvider`-Kontext (`usePlan()` → `{ plan, refresh }`, `frontend/src/lib/usePlan.ts`); `App` stellt ihn über `usePlanState(user.id)` bereit.
- Neue Komponente `frontend/src/components/OwnPlanCard.tsx`, Prop `{ userId: number }`; Plan und `refresh` aus dem `usePlan()`-Kontext. `SettingsPage` rendert sie im Panel `slot="tab-6"` über der Karte „Pakete im Vergleich" — Gating um die KARTE (rollenerweiterbar für die geplante Rolle „Tester", Analyse-Hinweis), nicht um den Tab.

## Verhalten

### AK1 — Eigene Karte im Tab Pakete, Wechsel wirkt sofort und bleibt

Im Panel `slot="tab-6"` sehen Admins (nur Rolle `admin`) eine eigene Karte (Karten-Label „Eigenes Paket", Hinweissatz „Der Wechsel ist kostenfrei, sofort wirksam und ohne Zahlungsweg." — Abgrenzung zur Bezahl-Matrix im selben Tab). Die Karte enthält eine Auswahl mit genau den vier Paketen `free | pro | max | ultimate` (Optionstexte via `planLabel`), aktuelles Paket vorausgewählt. Zugängliches Label der Auswahl ist selbstständig formuliert („Eigenes Paket wechseln", KI-UX/A11y — kein Zeilenkontext mehr). Auswahl-Komponente: `KolSingleSelect` mit `_hasClearButton={false}` (KI-UX; ein „kein Paket"-Zwischenstand ist ungültig); ein natives `KolSelect` bleibt tolerierbar.

Wechsel: `api.updateUserPlan({ id: <userId>, plan })` → danach `refresh()` aus dem Plan-Kontext ((`/auth/me` neu laden — UI und Session-Snapshot sofort aktuell). Fehler landen als `KolAlert _type="error"` IN der Karte (Meldung benennt Problem + Weiterweg); die Karte bleibt bedienbar. Nach Neuladen der App liefert `/auth/me` das neue Paket (Persistenz, unverändertes Server-Verhalten).

### AK2 — Nutzerverwaltung rein lesend

`AdminUsersSection` enthält keinerlei Paket-Auswahl mehr (kein Select/Combobox, auch nicht in der eigenen Zeile). Das Paket jedes Kontos bleibt als lesendes Text-Badge (`KolBadge _label={planLabel(user.plan)}`) in der Zeile sichtbar. Mit der Auswahl entfallen `handlePlanChange`, `planPending` und das Prop `currentUserId` aus der Komponente (`SettingsPage`/`App` geben es nicht mehr weiter).

### AK3 — Server unverändert, kein Zahlungsweg

Route `PATCH /admin/users/{id}/plan` und `User.plan` bleiben unangetastet; der Selbst-Wechsel durchläuft keinen PayPal-/Bestell-Code. Der bestehende Server-Vertragstest `server/src/express/admin.api.test.ts` bleibt ohne Änderung grün (dediziert: kein neuer Server-Test).

### AK4 — Mitglieder sehen keine Auswahl-Karte

Ohne Rolle `admin` wird die Karte gar nicht gerendert (nicht versteckt — kein leerer Panel-Bereich, keine `aria-hidden`-Container, KI-UX). Der Tab „Pakete" selbst inkl. Vergleichs-Matrix bleibt für Mitglieder unverändert.

### AK5 — Mobile 375px

Bei 375px Viewport-Breite liegt die Auswahl-Karte vollständig im Viewport (Bounding-Box `x >= 0` und `x + width <= 375 + 0.5`, nicht scrollWidth — die App-Shell clippt `overflow-x: hidden`) und erzeugt selbst keinen horizontalen Scroll-Container (`measureHorizontalScroll` auf der Karte → kein Fund). Die Matrix scrollt wie bisher bewusst in sich selbst (#1529, ADR 0014) — ihr interner Scroller ist kein Verstoß.

## Abgrenzungen

- Server (`server/src/express/routes/admin.ts`, `server/src/models/user.ts`) und die Tab-Struktur (tab-6 Basis-Tab, rollenabhängige Tabs hinten) bleiben unverändert.
- Fremd-Vergabe von Paketen über die UI bleibt out of scope (Route universell, #1456 AK6).
- Das Zeilen-Badge in der Nutzerverwaltung bleibt (AK2), nur die Auswahl entfällt.

## Testkonzept

| AK  | Test                                                                                                                                                                                            | Datei                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| AK1 | Vitest: Karte rendert Auswahl mit 4 `planLabel`-Optionen, aktuelles vorausgewählt; Wechsel ruft `updateUserPlan({id, plan})` mit eigener Id, danach `refresh`; Fehler → `KolAlert` in der Karte | `frontend/src/components/OwnPlanCard.test.tsx` (neu)                        |
| AK1 | Vitest: Auswahl-Karte lebt im Panel `slot="tab-6"` (nicht im Nutzerverwaltungs-Tab)                                                                                                             | `frontend/src/components/SettingsPage.test.tsx`                             |
| AK2 | Vitest: keine Zeile der Nutzerverwaltung hat eine Combobox (auch die eigene nicht), Badges bleiben                                                                                              | `frontend/src/components/AdminUsersSection.test.tsx` (Umbau #1556-AK2-Test) |
| AK3 | — dedup: bestehender Server-Test bleibt unverändert grün, kein neuer Test (ADR-Vertrag aus #1556/#1456)                                                                                         | `server/src/express/admin.api.test.ts`                                      |
| AK4 | Vitest: ohne Admin-Rolle kein Auswahl-Element in tab-6; E2E: Mitglied sieht die Karte im Tab Pakete nicht (Deep-Link)                                                                           | ebenda + `frontend/e2e/issue-1565-package-switch-tab.spec.ts` (neu)         |
| AK5 | E2E 375px: Karten-Bounding-Box im Viewport, kein horizontaler Scroll-Container innerhalb der Karte                                                                                              | ebenda                                                                      |
| AK1 | E2E: Wechsel auf „Pro" im Tab Pakete — PATCH auf eigene Id, Matrix-Kopfzeile „(dein Paket)" wandert ohne Reload, nach Neuladen noch gesetzt                                                     | ebenda                                                                      |

E2E-Interaktion folgt der `KolSingleSelect`-Empfehlung des KI-UX-Blocks (Combobox öffnen, Option per Label wählen). Nutzt die Implementierung stattdessen das tolerierte native `KolSelect`, ist die Interaktionszeile der E2E auf `selectOption({ label })` umzustellen (Test-Pflege in der Impl-Phase); alle Assertions bleiben davon unberührt.

Test-Pflege (bewusste Änderungen an #1556-Tests, durch AK2/AK1 verdrängt):

- `AdminUsersSection.test.tsx`: #1556-AK2-Test (Combobox in eigener Zeile) wird zum Negativ-Test umgebaut; die beiden #1556-AK3-Unit-Tests (Wechsel über das Zeilen-Select) entfallen — der Wechselvertrag liegt jetzt in `OwnPlanCard.test.tsx`.
- `frontend/e2e/issue-1556-admin-plan-switch.spec.ts`: Select-Assertions in der Zeile entfallen (AK1/AK2-Test wird Badge+Negativ-Select), der Wechsel-Test (ehem. AK3/AK5) ist in die neue #1565-Spec umgezogen, der 375px-Test behält nur die Zeilen-Boxes.
