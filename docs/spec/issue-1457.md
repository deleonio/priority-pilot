# Spec — Issue #1457: T2 Serverseitiges Feature-Gating

Quelle: KI-ANALYSE-Block im Harness-Marker-Kommentar von #1457, AK1–AK9. Baut auf #1456 (T1) auf: `server/src/logics/plans.ts` (`shouldBlockFeature`, `isMonetizationEnforced`) und `server/src/express/http-error.ts` (`sendPlanError`) existieren bereits.

## Ziel

Eine einzige Guard-Factory `requirePlanFeature(feature: FeatureId)` in `server/src/express/planGuard.ts` (neu) setzt die Paket-Matrix aus `plans.ts` an den betroffenen Routen durch. Keine Routendatei kennt eine Plan-/Paketliste. Bei ausgeschaltetem `MONETIZATION_ENFORCED` verhält sich jede Route byte-gleich wie heute.

## Guard-Factory (AK1)

```ts
// server/src/express/planGuard.ts
export const requirePlanFeature = (feature: FeatureId) => (req: Request, res: Response, next: NextFunction) => {
  const plan = /* Plan des angemeldeten Nutzers, Muster requireAuth.ts */;
  if (shouldBlockFeature(plan, feature)) {
    sendPlanError(res, 403, '…', { code: 'plan_required', feature, requiredPlan: /* kleinstes erlaubendes Paket */, currentPlan: plan });
    return;
  }
  next();
};
```

Läuft **nach** `requireAuth`/`apiTokenAuth` (Plan kommt aus `req.session.user.plan`).

## Route → Feature (verbindlich, aus dem Analyse-Block)

- `groups` (ab `pro`): `POST /groups`, `PATCH /groups/:id`, `DELETE /groups/:id`, `POST /groups/:id/invitations`, `PATCH /groups/:id/members/:userId`, `DELETE /groups/:id/members/:userId`, `POST /groups/:id/invite-links`, `DELETE /invite-links/:id`, `POST /invitations/:id/accept`, `POST /invite-links/:token/redeem`. `POST /invitations/:id/decline` bleibt ungegatet.
- `graph_write` (ab `max`): `POST /tasks/:id/dependencies`, `DELETE /tasks/:id/dependencies/:depId`.
- `location_reminders` (ab `max`): `GET /tasks/nearby`, `PUT /geo-config`, `POST /geo/position`, `geocodeSearch.ts`, `reverseGeocode.ts`, Schreibrouten `placeFavorites.ts` (`POST`/`PATCH`/`DELETE`). Zusätzlich `runGeoPushNotifications()` (`geo-background-job.ts`) filtert Nutzer ohne `location_reminders`.

Lesend ungegatet: `GET /graph`, `GET /forest`, `GET /next`, `GET /groups`, `GET /place-favorites`, `GET /geo-config`. `POST /tasks`/`PATCH /tasks/:id` bleiben ungegatet (Freitext-Adresse ohne Paket speicherbar, AK5).

## Fehlerantwort (AK2)

403, Body `sendPlanError(res, 403, message, { code: 'plan_required', feature, requiredPlan, currentPlan })`.

## Rollout-Schalter (AK3)

`shouldBlockFeature()` liefert bei ausgeschaltetem `MONETIZATION_ENFORCED` immer `false` (T1-Vertrag) — der Guard ruft ausschließlich diese Funktion auf, kein eigener Schalter-Check nötig.

## MCP-Loopback (AK6)

`server/src/mcp/tools.ts`, `callApi()` (:73–97): bei einer 403-Antwort mit `code === 'plan_required'` im Body wird ein lesbarer JSON-RPC-Fehler erzeugt, der Feature und `requiredPlan` nennt — generisch anhand des Codes, nicht anhand einer Tool-Liste (Muster: bestehende Übersetzung des Scope-Guard-403).

## OpenAPI (AK7)

`openapi.yml`: jede gegatete Route bekommt eine 403-Antwort mit Schema `Error` (bereits vorhanden, `openapi.yml:4416`). `pnpm build:api` bleibt grün.

## Testabdeckung (AK8)

`server/src/express/plan-gating-coverage.test.ts` enumeriert den gemounteten Router-Stack und vergleicht ihn gegen die obige Zuordnungstabelle — eine neue Schreibroute in einer betroffenen Datei ohne Guard-Eintrag lässt den Test fehlschlagen.

## Geo-Background-Job (AK9)

`runGeoPushNotifications()` (`geo-background-job.ts:170`) überspringt bei eingeschaltetem Rollout Nutzer ohne `location_reminders`; bei ausgeschaltetem Rollout unverändert.
