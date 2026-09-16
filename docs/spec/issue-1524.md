# Spec: Issue #1524 — Paket-Katalog: Spracheingabe nach Free, MCP-Lesen ab Max

Quelle: harness marker comment (KI-ANALYSE, stand=2026-09-16T09:30:48Z).

Voraussetzung (auf main): `mcp_readwrite` (#1460) ist der Bauplan — Katalogzeile
(`server/src/logics/plans.ts:56`), Label (`server/src/express/planGuard.ts:23`), Angebotstext
(`frontend/src/lib/planOffers.ts`), Plan-Deckel beim Auth (`server/src/express/apiTokenAuth.ts:96`)
und der 403-Vertrag `sendPlanError(..., code: plan_required, feature, requiredPlan, currentPlan)`.
`mcp_read` folgt exakt demselben Muster, nur eine Stufe früher (ab `max`) und auch für LESENDE
Bearer-Zugriffe wirksam — anders als `mcp_readwrite`, das nur den `scope` eines Tokens herabstuft,
`mcp_read` blockt den Zugriff selbst.

## AK1 — `voice_input` macht #1484 AK1 rückgängig: wieder für jedes Paket erlaubt

**Ziel:** `server/src/logics/plans.ts`, `FEATURE_CATALOG`: `voice_input` →
`allowedPlans: ['free', 'pro', 'max', 'ultimate']` (bisher `['pro', 'max', 'ultimate']`).

**Testfälle:** `server/src/logics/plans.test.ts`:

- `getEntitlements(plan).voice_input.allowed` ist für alle vier Pakete `true`.
- `shouldBlockFeature(plan, 'voice_input')` ist bei eingeschaltetem Rollout für jedes Paket `false`.
- Die bisherige Erwartung „voice_input erfordert mindestens Pro (#1484 AK1)" widersprach AK1 direkt
  (Free sollte `allowed: false` sein) und wurde ersetzt (Test-Pflege-Bedarf, s. PR-Body).

## AK2 — `VoiceField` verliert Badge und Sperre für `voice_input`

**Ziel:** `frontend/src/components/VoiceField.tsx` rendert `<PlanBadge feature="voice_input" />`
nicht mehr und wertet kein Entitlement zur Sperre der Aufnahme mehr aus — ein Klick auf den
Mic-Button startet die Aufnahme unabhängig vom Paket, `autoStart` ebenso.

**Testfälle:** `frontend/src/components/VoiceField.test.tsx`, Describe „keine Badge/Sperre mehr für
voice_input (#1524 AK2)": rendert mit einem künstlich auf `allowed: false` gesetzten Entitlement
(beweist, dass die Sperre nicht mehr an das Entitlement gekoppelt ist) — kein
`plan-badge-voice_input` im DOM, Klick startet trotzdem die Aufnahme, kein `pp:plan-required`-Event.
Ersetzt die alte Describe „VoiceField — Paket-Badge und Entitlement-Gate (#1484 AK3/AK6)", die exakt
das Gegenteil erwartete (Test-Pflege-Bedarf).

E2E-Ergänzung: `frontend/e2e/issue-1484-plan-badges.spec.ts` — der alte AK3/AK8-Test erwartete ein
sichtbares `plan-badge-voice_input` für einen Free-Nutzer; ersetzt durch einen Test, der dessen
Abwesenheit prüft (Test-Pflege-Bedarf).

## AK3 — neues Feature `mcp_read` (lesender MCP-Zugriff, ab Max)

**Ziel:** `server/src/logics/plans.ts`:

- `FeatureId`/`FEATURE_IDS` bekommen den siebten Identifier `mcp_read`.
- `FEATURE_CATALOG` bekommt `{ feature: 'mcp_read', allowedPlans: ['max', 'ultimate'] }`.
- `server/src/express/planGuard.ts`, `FEATURE_LABELS.mcp_read` — sprachlich unterscheidbar von
  `mcp_readwrite` (z. B. „Lesezugriff über MCP" vs. „Schreibzugriff über MCP").
- `frontend/src/lib/planOffers.ts`, `FEATURE_OFFERS.mcp_read` — eigener Titel/Nutzentext,
  unterscheidbar von `mcp_readwrite`.
- `openapi.yml:3018` — Feature-Enum bekommt `mcp_read` (AK8, kein eigener Testfall, s. u.).

**Testfälle:** `server/src/logics/plans.test.ts`:

- `FEATURE_IDS`/`getPlansCatalog().features` enthalten `mcp_read` (Array wächst von sechs auf
  sieben Einträge, `EXPECTED_FEATURES` entsprechend erweitert).
- `getEntitlements('free'|'pro').mcp_read.allowed` ist `false`, `requiredPlan` ist `'max'`;
  `getEntitlements('max'|'ultimate').mcp_read.allowed` ist `true`.

## AK4/AK5 — Server setzt `mcp_read` für Bearer-Lesezugriffe durch

**Ziel:** Ein lesender Zugriff über einen Bearer-Token (`GET` auf eine Fachroute wie `/tasks`, oder
ein lesendes MCP-Werkzeug über `POST /mcp/v1`, z. B. `task_links`/`group_list`), dessen
Token-Besitzer `mcp_read` fehlt (Paket `free`/`pro`), wird bei eingeschaltetem Rollout mit 403 und
`code: plan_required`, `feature: mcp_read`, `requiredPlan: max`, `currentPlan: <Paket>` abgewiesen —
unabhängig vom gespeicherten `scope` des Tokens (anders als `mcp_readwrite`, das nur den
wirksamen `scope` herabstuft). Der Token-Datensatz bleibt unverändert (`revokedAt` bleibt `null`,
`scope` unverändert). Mit Paket `max`/`ultimate` funktioniert derselbe Zugriff unverändert.

**Testfälle:**

- `server/src/express/api-token-auth.test.ts`, Describe „Plan-Deckel für lesenden MCP-Zugriff
  (#1524 AK4/AK5)": `GET /tasks` über Bearer für `free`/`pro` → 403 mit den vier Feldern, Token-Zeile
  unverändert; für `max`/`ultimate` → 200; bei ausgeschaltetem Rollout unverändert 200.
- `server/src/mcp/plan-error.test.ts`, Describe „Plan-Deckel für lesende Werkzeuge (#1524
  AK4/AK5)": `task_links`/`group_list` liefern für `free` einen JSON-RPC-Fehler mit „max" im Text,
  für `max` weiterhin ein Ergebnis. Ersetzt die beiden alten Tests „task_links (Leseoperation)
  bleibt für free-Nutzer erfolgreich" und „group_list (Leseoperation) bleibt für free-Nutzer
  erfolgreich (AK4)" aus #1457, die AK4 direkt widersprechen (Test-Pflege-Bedarf).

## AK6 — `POST /api-tokens` erfordert `mcp_read`

**Ziel:** `server/src/express/routes/apiTokens.ts`, `POST /api-tokens` bekommt einen
`requirePlanFeature('mcp_read')`-Guard: ohne `mcp_read` (Pakete `free`/`pro`) liefert das Anlegen
eines Tokens bei eingeschaltetem Rollout 403 mit `code: plan_required`, `feature: mcp_read`,
`requiredPlan: max`; mit `max`/`ultimate` weiterhin 201.

**Testfälle:** `server/src/express/api-tokens.test.ts`, Describe „Plan-Deckel fürs Anlegen (#1524
AK6)": `pro` → 403 mit den drei Feldern, kein Token in der Liste; `max` → 201; ausgeschalteter
Rollout → unverändert 201 (Muster: bestehende `#1460 AK1-3`-Beschreibung für `PATCH`).

## AK7 — Paket-Tabelle zeigt zwei getrennte MCP-Zeilen

**Ziel:** `PlansSection.tsx` ist bereits vollständig datengetrieben aus `catalog.features`
(`PlansSection.tsx:348-355`) — sobald AK3 den Katalog um `mcp_read` erweitert, entsteht die Zeile
ohne Produktivcode-Änderung an `PlansSection.tsx` selbst.

**Testfälle:** `frontend/src/components/PlansSection.test.tsx`, Describe „getrennte Zeilen für
lesenden und schreibenden MCP-Zugriff (#1524 AK7)": mit einem zweigliedrigen Mock-Katalog
(`mcp_read`, `mcp_readwrite`) zwei Tabellenzeilen mit unterschiedlichem Titel und korrekten
Paket-Häkchen (`mcp_read`: max+ultimate; `mcp_readwrite`: nur ultimate).

## AK8 — OpenAPI-Enum

Kein eigener Testfall — abgedeckt durch den bestehenden Typ-/Build-Gate (`tsc --noEmit`).

## AK9 — Paket-Tabelle bleibt bei 375px lesbar

**Ziel:** Die um eine Zeile erweiterte Paket-Tabelle (sieben statt sechs Feature-Zeilen) bleibt bei
375px-Viewport ohne horizontalen Overflow.

**Testfälle:** `frontend/e2e/issue-1484-plan-badges.spec.ts`, neuer Test „#1524 AK9": navigiert zu
`/settings/general`, zählt `tbody tr` in der Paket-Tabelle (muss 7 sein statt 6) und prüft die
Bounding-Box der letzten Zeile gegen den 375px-Viewport. Bewusst über die Zeilenanzahl statt eines
fest verdrahteten Zeilentitels geprüft — der genaue Wortlaut von `FEATURE_OFFERS.mcp_read` ist
Implementierungsdetail (AK3).
