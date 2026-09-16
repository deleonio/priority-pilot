# Spec: Issue #1526 — Access-Token: Reiter bleibt, Bedienelemente ohne Paket gesperrt

Quelle: harness marker comment (KI-ANALYSE + KI-UX, stand=2026-09-16T15:53:09Z).

Voraussetzung (auf main): `useEntitlement`/`usePlan` (`frontend/src/lib/usePlan.ts`),
`planLabel` (`frontend/src/lib/planOffers.ts`), Sperr-plus-Alert-Muster
(`SettingsPage.tsx:419-437`, ADR 0014 Entscheidung 5), Feature-Trennung `mcp_read`/
`mcp_readwrite` (`server/src/logics/plans.ts:59-60`, unverändert).

## AK1 — Tab-Beschriftung „Access-Token", Route/Index unverändert

**Ziel:** `SettingsPage.tsx:117` benennt den letzten Tab von `'Zugriff'` auf
`'Access-Token'` um. Das Routen-Segment `zugriff` (`App.tsx:86-90`) bleibt unverändert
— nur das sichtbare Label ändert sich. Tab-Index der übrigen Reiter bleibt gleich.

**Testfälle:**

- Unit `SettingsPage.test.tsx:673-685` (bestehender Test, Test-Pflege): die Tab-Label-Liste
  erwartet ab sofort `'Access-Token'` statt `'Zugriff'` als letzten Eintrag.
- e2e (neu) `frontend/e2e/issue-1526-access-token-gating.spec.ts`: Navigation auf
  `/settings/zugriff` zeigt den Tab mit Rolle `tab` und Namen „Access-Token" sowie das
  Panel `[data-testid="api-tokens-panel"]`.

## AK2/AK3 — Erzeugen-Formular gesperrt ohne `mcp_read`

**Ziel:** Ohne `mcp_read`-Entitlement (`allowed: false`) sind `KolInputText` (Name),
`KolSelect` (Laufzeit) und `KolButton` „Token erzeugen" `_disabled`, und oberhalb des
Formulars steht ein `KolAlert _type="info"`, der `planLabel(requiredPlan)` nennt
(hier: „Max"). Mit `allowed: true` sind alle drei Elemente bedienbar, der Alert entfällt.

**Testfälle:** `ApiTokensSection.test.tsx`, neue Describe „#1526 AK2/AK3" — rendert mit
`PlanProvider`-Entitlement `mcp_read = { allowed: false, requiredPlan: 'max' }` bzw.
`allowed: true`; prüft `_disabled` an den drei Elementen und Vorhandensein/Fehlen des
Alert-Texts „Max".

## AK4/AK5 — Rechte-Regler gesperrt ohne `mcp_readwrite`

**Ziel:** Ohne `mcp_readwrite`-Entitlement ist der `ScopeToggle`-Schalter jedes Tokens
`_disabled` (zusätzlich zum bestehenden Sperrgrund `scopeBusyId === token.id`) und
unterhalb der Scope-Zeile steht ein `KolAlert _type="info"`, der „Ultimate" nennt. Mit
Entitlement bleibt der Schalter bedienbar und löst weiterhin `PATCH /api-tokens/:id`
aus; der Alert entfällt.

**Testfälle:** `ApiTokensSection.test.tsx`, neue Describe „#1526 AK4/AK5" — ein Token in
der Liste, `mcp_readwrite = { allowed: false, requiredPlan: 'ultimate' }`: Schalter
`_disabled`, Alert-Text „Ultimate" vorhanden, ein Klick auf den Schalter löst `api.
updateApiToken` NICHT aus. Mit `allowed: true`: Schalter bedienbar, Klick löst den PATCH aus.

## AK6 — `PlanBadge` entfällt aus der Scope-Zeile

**Ziel:** `ApiTokensSection.tsx:87` rendert kein `<PlanBadge feature="mcp_readwrite" />`
mehr. `[data-testid="plan-badge-mcp_readwrite"]` existiert in keinem Entitlement-Zustand
mehr im Panel.

**Test-Pflege-Bedarf:** Die bestehende Describe „ApiTokensSection — Paket-Badge an der
ScopeToggle-Zeile (#1484 AK3/AK4/AK5)" (`ApiTokensSection.test.tsx:258-306`) widerspricht
AK6 direkt (erwartet das Badge) — wird durch die neuen AK4/AK5/AK6-Tests ersetzt statt
angepasst, da die (i)-Schalter-Event-Erwartung (AK5 von #1484) mit dem Badge zusammen
entfällt. Ebenso der e2e-Test „AK3/AK8: Zugriff-Einstellungen zeigen das
mcp_readwrite-Badge …" in `frontend/e2e/issue-1484-plan-badges.spec.ts:133-144` — ersetzt
durch einen Test, der die Abwesenheit des Badges und die Anwesenheit des Alerts prüft.

## AK7 — Kein Sperren vor der ersten Serverantwort

**Ziel:** Solange `useEntitlement('mcp_read'|'mcp_readwrite') === undefined` ist (kein
`PlanProvider`-Wert gesetzt), wird kein Alert gezeigt und es gilt ausschließlich der
bisherige Sperrzustand (`busy` bzw. `scopeBusyId`) — kein zusätzliches `_disabled` durch
die neue Gating-Logik.

**Testfälle:** `ApiTokensSection.test.tsx`, neue Describe „#1526 AK7" — Render ohne
`PlanProvider`-Wrapper (Default-Kontext, `entitlements: {}`): Formularfelder und
Rechte-Regler sind nicht `_disabled`, kein Alert im DOM.

## AK8 — 375px: Alert und gesperrtes Element gemeinsam sichtbar

**Ziel:** Bei 375px Viewport liegt zu jedem deaktivierten Element der zugehörige Alert
ohne horizontales Scrollen im selben Sichtbereich (Bounding-Box-Prüfung, nicht
`scrollWidth` — MEMORY 2026-08-24).

**Testfälle:** e2e (neu) `frontend/e2e/issue-1526-access-token-gating.spec.ts` — Session
auf Paket `free` (kein `mcp_read`/`mcp_readwrite`), 375×812: Alert über dem Formular und
Alert unter der Scope-Zeile liegen jeweils vollständig im Viewport
(`box.x + box.width <= 375`), `document.scrollingElement.scrollWidth <=
document.documentElement.clientWidth`.

## Offene Fragen

- keine (Alert-Text-Prüfung erfolgt über den Paketnamen aus `planLabel`, nicht über einen
  fest verdrahteten Satz — Wortlaut ist Implementierungsdetail der Impl-Phase).
