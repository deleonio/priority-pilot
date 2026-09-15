# Spec — Issue #1462: T7 Downgrade und Kündigung

Ziel: Ein voller Zyklus Upgrade → Downgrade/Kündigung → Upgrade läuft ohne Datenverlust. Gesperrt wird nur der
Schreibzugriff (Guards via `shouldBlockFeature`), nie ein Datensatz gelöscht.

## Vorbedingung

`MONETIZATION_ENFORCED=true`. Nutzer mit Paket `max`/`ultimate` hat Gruppen, Graph-Abhängigkeiten (`Dependency`),
Aufgaben mit `lat`/`lon` und Favoriten (`PlaceFavorite`) angelegt.

## Schritte & erwartetes Ergebnis

1. **Downgrade auf `free`** (Admin-Route bzw. `applyPlanChange`/`applyDuePendingPlan` aus `logics/paypal.ts`):
   - `GET /auth/me` → `entitlements.{groups,ai_assist,graph_write,location_reminders,mcp_readwrite}.allowed === false`.
   - Lese-Endpunkte (`GET /groups`, `GET /tasks`, `GET /tasks/nearby`, `GET /place-favorites`) bleiben 200 mit
     unveränderter Trefferzahl (AK1).
   - Bestand (Gruppen, Dependencies, Tasks mit Koordinaten, Favoriten) zählt vor/nach identisch (AK2).
2. **Kündigung wirksam für Guards** (AK3): nach `cancelSubscription`/`applyDuePendingPlan` ist das für
   `shouldBlockFeature`/`requirePlanFeature` maßgebliche Paket (`User.plan`) `free`; eine Schreibroute
   (`POST /groups`) antwortet 403 `plan_required`. Lücke: `paypal.ts` schreibt bislang nur `Subscription.plan`,
   nicht `User.plan` — ohne Abgleich bleibt der Guard grün trotz Kündigung (roter Testfall erwartet).
3. **Re-Upgrade** (AK4): Schreibzugriffe funktionieren wieder, AK2-Bestand unverändert und bearbeitbar.
4. **KI-Kontingent** (AK5): `ai_usage`-Zeile des laufenden Monats bleibt beim Downgrade erhalten,
   `quotaRemaining` ist unter `free` 0 (`AI_ASSIST_MONTHLY_QUOTA.free === 0`); eine neue `yearMonth`-Zeile trägt
   automatisch das volle Kontingent des dann aktiven Pakets.
5. **API-Token** (AK6): ein `readwrite`-Token wird beim Downgrade nicht gelöscht/widerrufen; effektiver Scope
   kappt bis zum Upgrade auf `read` (Spaltenwert bleibt `readwrite`, Muster `apiTokenAuth.ts:93-99`).
6. **UI** (AK7): keine neue Upsell-Komponente/kein neuer Textbaustein — bestehendes Angebot wird an den
   gesperrten Stellen weiter angezeigt (E2E `frontend/e2e/issue-1462-downgrade.spec.ts`).

## Nicht-Ziele

- Kein Löschpfad für Daten bei Downgrade.
- Keine neue Paket-Matrix-Kodierung außerhalb `logics/plans.ts`.
