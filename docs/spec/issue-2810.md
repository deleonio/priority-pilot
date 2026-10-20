# Spec #2810 — Admin-MCP: Token-Anlegen für Rolle admin vom Paket-Gate ausnehmen

## Ziel

Ein Admin mit Paket `free` kann nach Doku (`docs/mcp-admin.md`) keinen API-Token anlegen, weil
`POST /api-tokens` hinter `requirePlanFeature('mcp_read')` (ab Plus) hängt — der Admin-MCP-Endpunkt
selbst ist aber schon paketfrei erreichbar. Der Fix (PO-Entscheidung 2026-10-20, bindend): das
`mcp_read`-Gate beim Token-Anlegen nimmt Konten mit Rolle `admin` aus, analog zur `adminRead`-Ausnahme
im Token-Guard (`apiTokenAuth.ts` — lesende `/admin/*` überspringen das Paket-Gate). Die Rolle wird je
Request frisch aus der DB geprüft, nicht aus dem Session-Snapshot. Für Nicht-Admins ändert sich nichts.

## Voraussetzungen

- `POST /api-tokens` mit `requirePlanFeature('mcp_read')` (`server/src/express/routes/apiTokens.ts:75-77`);
  `requirePlanFeature` liest den Plan bereits frisch per `User.findByPk` aus der DB
  (`server/src/express/planGuard.ts:54`).
- Rollout-Schalter `MONETIZATION_ENFORCED=true` aktiviert das Paket-Gate (Testseite wie #1524 AK6).
- Bestehende #1524-AK6-Fälle in `server/src/express/api-tokens.test.ts` (free→403, plus→201,
  Rollout-aus→201) bleiben unverändert grün.

## Verhalten

1. **Admin + free darf anlegen (AK1):** Session mit Rolle `admin` und Paket `free` erhält bei
   `POST /api-tokens` eine 201-Antwort mit dem Klartext-Token (nur in dieser einen Antwort); der Token
   erscheint in `GET /api-tokens` (ohne Klartext). Der Token authentifiziert an `POST /mcp/admin/v1`:
   `tools/list` liefert die admin_*-Werkzeuge.
2. **Nicht-Admins unverändert (AK2):** Session mit Rolle `member` bzw. `tester` und Paket `free`
   erhält weiterhin 403 mit `code: 'plan_required'` und `feature: 'mcp_read'`; mit Paket plus/pro
   bleibt das Anlegen 201 (durch die bestehenden #1524-AK6-Fälle abgesichert — member+free→403 ist der
   free-Fall dort, plus→201 der zweite; Dedup, kein neuer Test für plus).
3. **Frische DB-Rolle (AK3):** Wird ein eingeloggter Admin in der DB auf Rolle `member` zurückgestuft,
   erhält er beim nächsten Token-Anlegen 403 — die Ausnahme prüft die frische DB-Rolle, nicht den
   Session-Snapshot (Deklassierung wirkt sofort).

## Testfälle

- `server/src/express/api-tokens.test.ts` — neuer describe-Block „Admin-Ausnahme beim Anlegen (#2810)":
  - AK1: admin+free bei eingeschaltetem Rollout → 201 mit Klartext; Token in der Liste.
  - AK2: tester+free bei eingeschaltetem Rollout → 403 `plan_required`/`mcp_read` (bewusst `tester`:
    der member-Fall ist durch den bestehenden #1524-free-Fall (Default-Rolle member) gedeckt; der
    Tester-Fall sichert, dass die neue Ausnahme wirklich rollenspezifisch `admin` ist).
  - AK3: admin-Session, DB-Rolle danach auf `member` → 403 `plan_required`.
- `server/src/express/mcp-admin.test.ts` — neuer describe-Block „Token-Anlegen für Admin vom
  Paket-Gate ausgenommen (#2810)":
  - AK1 (end-to-end): admin+free bei eingeschaltetem Rollout legt per `tokenFor`-Muster einen Token
    an; `tools/list` auf `/mcp/admin/v1` liefert admin_*-Werkzeuge.

Kein Produktioncode im Spec-PR; die Umsetzung liegt an der Seam `requirePlanFeature('mcp_read')`
bzw. inline vor der Route (Entscheidung der Impl-Phase).

## Offene Fragen

- (keine)
