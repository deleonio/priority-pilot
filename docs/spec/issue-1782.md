# Spec #1782 — Server: Pakete auf Free, Plus und Pro umstellen

Quelle: ADR 0018 (Preismodell Free/Plus/Pro), KI-ANALYSE-Block von #1782. Umstellung bestehender Konten: #1785.

## Paketmatrix

| Feature              | free | plus | pro |
| -------------------- | ---- | ---- | --- |
| `voice_input`        | ja   | ja   | ja  |
| `graph_write`        | ja   | ja   | ja  |
| `groups`             | -    | ja   | ja  |
| `ai_assist`          | -    | ja   | ja  |
| `location_reminders` | -    | ja   | ja  |
| `mcp_read`           | -    | ja   | ja  |
| `graph_weight` (neu) | -    | ja   | ja  |
| `mcp_readwrite`      | -    | -    | ja  |

`PLAN_VALUES` ist exakt `['free','plus','pro']`. `requiredPlan` je Feature = kleinstes enthaltende Paket.

## Preise (Cent)

plus 499 / 1347 / 4790, pro 999 / 2697 / 9590 (monatlich / quartalsweise / jährlich). `GET /plans` kennt kein `max`/`ultimate`. Jeder `PAYPAL_PLAN_IDS`-Betrag entspricht `PLAN_PRICES`.

## Abhängigkeiten

Ziel: einfache Abhängigkeiten für alle Pakete, Gewichte ab Plus.
Bei `MONETIZATION_ENFORCED=true` legt ein Free-Konto per `POST /tasks/:id/dependencies` ohne `weight` an (201) und entfernt per DELETE (204). Mit `weight` antwortet der Server 403 `plan_required` (`feature: graph_weight`), nichts wird angelegt. Plus darf `weight` setzen.

## Downgrade und Altwerte

Nach Plus → Free bleiben Daten lesbar und vorhanden, gesperrte Schreibzugriffe liefern 403. Altwerte `'max'`/`'ultimate'` in `users.plan` liefern bei `GET /auth/me` kein 500 (Auswertung wie plus/pro bis #1785).

## MCP

Plus liest per MCP/API-Token, Hochstufen auf `readwrite` liefert 403 (`mcp_readwrite`, `requiredPlan: pro`); Pro darf.
