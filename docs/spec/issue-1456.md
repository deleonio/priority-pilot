# Spec — Issue #1456: T1 Plan-Datenmodell und Rechte-Zentrale

Quelle: Gesamtkonzept Monetarisierung (`docs/gesamtkonzept-monetarisierung.md`, Teilaufgabe T1) + Akzeptanzkriterien AK1–AK11 aus dem KI-ANALYSE-Block der Harness-Marker-Kommentar von #1456.

## Ziel

Jeder Nutzer trägt serverseitig ein Paket (`free | pro | max | ultimate`). `server/src/logics/plans.ts` ist die einzige Wahrheitsquelle für Feature-Katalog, Preise und Entitlement-Auswertung. `/auth/me` und die PAT-Session tragen Plan + Entitlement-Map mit. `GET /plans` ist öffentlich. Admins setzen den Plan manuell. Der Fehlervertrag trägt optionale Paketfelder. Durchgesetzt wird nichts, solange `MONETIZATION_ENFORCED` aus ist (Default).

## Datenmodell (AK1)

- `server/src/models/user.ts`: neues Feld `plan: 'free' | 'pro' | 'max' | 'ultimate'`, `allowNull: false`, `defaultValue: 'free'`.
- `server/src/logics/migrate.ts`: neue Funktion `migrateUsersPlanColumn(db: Sequelize): Promise<void>` — Muster `migrateUsersRoleColumn`: PRAGMA-Abfrage auf `users`, No-op wenn Tabelle fehlt oder `plan` schon existiert, sonst `ALTER TABLE users ADD COLUMN plan VARCHAR(255) NOT NULL DEFAULT 'free'`. Bestandszeilen erhalten `'free'`. Idempotent.
- `server/src/index.ts`: Aufruf von `migrateUsersPlanColumn(sequelize)` vor `sequelize.sync()`, in der Kette hinter `migrateApiTokenScope` (analog zu den bestehenden Migrationsaufrufen).

## Rechte-Zentrale `server/src/logics/plans.ts` (neu, AK2/AK9/AK10)

```ts
export type Plan = 'free' | 'pro' | 'max' | 'ultimate';
export const PLAN_VALUES: readonly Plan[] = ['free', 'pro', 'max', 'ultimate'];

export type FeatureId = 'groups' | 'voice_input' | 'ai_assist' | 'graph_write' | 'location_reminders' | 'mcp_readwrite';
export const FEATURE_IDS: readonly FeatureId[] = [
	'groups',
	'voice_input',
	'ai_assist',
	'graph_write',
	'location_reminders',
	'mcp_readwrite',
];

/** Monatliches KI-Kontingent je Paket — nur für `ai_assist` relevant. */
export const AI_ASSIST_MONTHLY_QUOTA: Record<Plan, number> = { free: 0, pro: 60, max: 110, ultimate: 200 };

export interface PlanPrice {
	monthly: number;
	yearly: number;
}

export interface FeatureCatalogEntry {
	feature: FeatureId;
	allowedPlans: readonly Plan[];
}

export interface PlansCatalog {
	features: readonly FeatureCatalogEntry[];
	prices: Record<Plan, PlanPrice>;
}

/** Katalog + Preise — einzige Quelle, von `GET /plans` unverändert durchgereicht. */
export function getPlansCatalog(): PlansCatalog;

export interface FeatureEntitlement {
	/** Wahrheitsgemäße Auswertung des Pakets — UNABHÄNGIG von `MONETIZATION_ENFORCED`. */
	allowed: boolean;
	requiredPlan: Plan;
	/** Nur bei `ai_assist` gesetzt. */
	quotaRemaining?: number;
}
export type EntitlementMap = Record<FeatureId, FeatureEntitlement>;

/** Entitlement-Map je Feature für `plan` — identisch in beiden Stellungen von `MONETIZATION_ENFORCED`. */
export function getEntitlements(plan: Plan): EntitlementMap;

/** Liest den Rollout-Schalter aus `process.env.MONETIZATION_ENFORCED` (Default: aus). Nicht gecacht — pro Aufruf gelesen. */
export function isMonetizationEnforced(): boolean;

/** Zentrale Durchsetzungs-Abfrage (AK9): bei "aus" IMMER `false` (nicht durchsetzen); bei "an" `true`, wenn das Paket das Feature NICHT erlaubt. Von T2-Guards konsumiert. */
export function shouldBlockFeature(plan: Plan, feature: FeatureId): boolean;
```

Feature-Zuordnung (Paket-Matrix, aus dem Gesamtkonzept):

| Feature              | free             | pro    | max                   | ultimate |
| -------------------- | ---------------- | ------ | --------------------- | -------- |
| `groups`             | –                | ✓      | ✓                     | ✓        |
| `voice_input`        | ✓                | ✓      | ✓                     | ✓        |
| `ai_assist`          | – (Kontingent 0) | ✓ (60) | ✓ (110)               | ✓ (200)  |
| `graph_write`        | –                | –      | ✓                     | ✓        |
| `location_reminders` | –                | –      | ✓                     | ✓        |
| `mcp_readwrite`      | –                | –      | ✓ (lesend+schreibend) | ✓        |

`voice_input` ist ein reines Anzeige-Entitlement (lokale Browser-Spracheingabe) — kein Server-Endpunkt, kein Guard (AK10); im Code als Kommentar an der Katalog-Definition festgehalten.

## `GET /plans` (AK3)

Neuer öffentlicher Router `server/src/express/routes/plans.ts`, `plansPublicRouter`, gemountet in `server/src/express/index.ts` **vor** `app.use(requireAuth)` (Muster `inviteLinksPublicRouter`). Antwort: `getPlansCatalog()` als JSON, 200, ohne Session.

## `/auth/me` (AK4)

`authRouter.get('/auth/me', …)` liefert zusätzlich:

- `plan: Plan` (aus der DB-Zeile, analog zum bestehenden `role`-Refresh).
- `entitlements: EntitlementMap` (`getEntitlements(plan)`).

Pass-Through-Zweig (kein Auth konfiguriert, `!isAuthActive()`): antwortet weiterhin 200 ohne DB-Zugriff, mit `plan: 'free'` und der zugehörigen `entitlements`-Map aus `getEntitlements('free')`.

## PAT-Session (AK5)

`server/src/express/apiTokenAuth.ts`: beim Aufbau von `req.session.user` für einen gültigen Bearer-Token wird `plan: user.plan` ergänzt (gleiche Stelle wie `role`).

## `PATCH /admin/users/:id/plan` (AK6)

`server/src/express/routes/admin.ts`, Muster `PATCH /admin/users/:id/role`:

- `requireRole('admin')` als Route-Middleware.
- Id kein Integer > 0 → 400.
- Body `{ plan }` nicht in `PLAN_VALUES` → 400.
- Nutzer nicht gefunden → 404.
- Sonst: Plan setzen, aktualisiertes `AdminUserDto` (inkl. `plan`) zurückgeben, 200.

## Fehlervertrag (AK7)

`openapi.yml`, Schema `Error`: neue **optionale** Felder `code`, `feature`, `requiredPlan`, `currentPlan` (`message` bleibt einziges Pflichtfeld).

`server/src/express/http-error.ts`: neue Funktion neben `sendError`:

```ts
export type PlanErrorCode = 'plan_required' | 'quota_exhausted';

export function sendPlanError(
	res: Response<ErrorDto>,
	status: number,
	message: string,
	fields: { code: PlanErrorCode; feature: string; requiredPlan?: string; currentPlan?: string },
): void;
```

Setzt `{ message, code, feature, requiredPlan, currentPlan }` (nur gesetzte optionale Felder). `plan_required` gehört zu 403, `quota_exhausted` zu 429 (vom Aufrufer übergeben, keine harte Kopplung in `sendPlanError` selbst nötig — Tests prüfen den in T1 vorgesehenen Gebrauch).

## Kontingent-Restfeld (AK8) und OpenAPI/Client (AK11)

Reine Vertrags-/Generierungsschritte ohne eigenen Testfall — abgesichert durch die Assertions aus TF3/TF4 auf die generierten DTOs (`components['schemas']`) und einen grünen `pnpm build:api`/Typecheck.

## Rollout-Schalter (AK9)

`MONETIZATION_ENFORCED` wird ausschließlich in `plans.ts` (`isMonetizationEnforced`, `shouldBlockFeature`) ausgewertet. Default aus. `getEntitlements()` liefert in beiden Stellungen dieselbe Map (das _ob_ erlaubt bleibt wahrheitsgemäß); nur `shouldBlockFeature()` unterscheidet nach Schalterstellung.
