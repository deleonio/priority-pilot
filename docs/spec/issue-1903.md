# Spec #1903 — Tab „KI" (Schalter, Provider, Access-Token)

Quelle: PO-Entscheidungen 2026-09-30 (Q1=A Token bleiben bei „aus" gültig, Q2=B Free sperrt alles, Q3=A aus = eingeklappt).

## Ziel

Ein Settings-Tab „KI" ersetzt „KI-Provider" (Index 2) und „Access-Token" (letzter Tab). Oben Schalter „KI aktivieren" (Präferenz `pp-ai-enabled`), darunter Provider-Einstellungen und Karte „Access-Token" mit den `KolDetails` „Access-Token erstellen" / „Vorhandene Access-Token".

## Regeln

1. Tab-Leiste: „KI" vorhanden; „KI-Provider" und „Access-Token" entfallen (AK1). Test: `SettingsPage.test.tsx` (Tab-Liste), `settings-tabs.spec.ts`.
2. Schalter heißt „KI aktivieren", „KI-Features aktiv" entfällt (AK2). Test: `SettingsPage.test.tsx`.
3. Schalter aus → Details im DOM, `_open` false; an → offen (AK3/AK4). Test: `SettingsPage.test.tsx`.
4. Free (kein `ai_assist`): Schalter gesperrt, Paket-Alert bleibt, auch mit eigenem Provider (AK6). `computeAiFeaturesEnabled` liefert ohne `ai_assist` immer `false` (AK7). Test: `aiPreferences.test.ts`, `SettingsPage.test.tsx`.
5. `/settings/llm` und `/settings/zugriff` öffnen „KI"; `/settings/standort` bleibt „Standort" (AK8). Test: `settings-tabs.spec.ts`.
6. 375 px: Tab, Schalter, Karte innerhalb des Viewports (AK9). Test: `settings-tabs.spec.ts`.

## Nicht testbar / bewusst ohne neuen Test

- AK5 (Plus/Pro-Scope) und AK6 (Free-e2e): bestehende Specs `issue-1356-token-scope.spec.ts`, `issue-1526-access-token-gating.spec.ts` referenzieren alte Labels/Routen — Nachziehen (Test-Pflege) in der Umsetzung, siehe PR-Body.
- AK10: keine Serveränderung.
