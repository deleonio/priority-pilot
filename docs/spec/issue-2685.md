# SSRF-Guard: DNS-Fehler fail-closed

**Stand:** 2026-10-17 — Issue #2685

## Ziel

`isPublicEndpoint` behandelt einen fehlgeschlagenen DNS-Lookup als **nicht öffentlich** (fail-closed) und protokolliert die Ursache; die Lookup-Funktion ist injizierbar, damit Tests ohne Netzwerk/DNS laufen.

## Ablauf

1. **DNS-Fehler:** Reicht der Host nicht auf ein IP-Literal auf und schlägt der Lookup fehl (z. B. `ENOTFOUND`), liefert `isPublicEndpoint(url)` `false` — statt wie bisher `true` (fail-open). Der Aufrufer antwortet unverändert mit 400 und `INTERNAL_ENDPOINT_MESSAGE`; die Ursache steht nur im Log.
2. **Protokollierung:** Bei der Ablehnung wegen DNS-Fehlers entsteht **genau ein** `console.error`-Eintrag mit Host und DNS-Ursache (z. B. Fehlercode).
3. **Injizierbarkeit:** `isPublicEndpoint` nimmt die Lookup-Funktion als optionalen zweiten Parameter (Default `node:dns/promises.lookup`, Muster `fetchIcs(url, fetchImpl, …)`); kein globaler Zustand.
4. **Unverändert:** IP-Literale (intern → `false`, öffentlich → `true`) und der resolve-Pfad (jede aufgelöste Adresse öffentlich → `true`) bleiben im Verhalten bestehen.

## Erwartetes Ergebnis

- Nicht auflösbarer Host: `false` plus ein Log-Eintrag (Host + Ursache); Anbieter-Test/Speichern/Aktivieren und ICS-Abruf lehnen ab, ohne dass ein interner Abruf versucht wird.
- Öffentliche IP-Literale und per injiziertem Lookup auflösbare Hosts verhalten sich wie bisher (`true` bzw. interne Auflösung → `false`).
- Testsuite läuft ohne Netzwerk/DNS: alle DNS-Fälle laufen über Injektion.

## Bausteine

Erweitert `server/src/llm/endpointGuard.ts` / `server/src/llm/endpointGuard.test.ts`; Aufrufer (`llmProviders.ts`, `calendar-ics.ts`, `llm.ts`) bleiben unverändert. Bestandstests (interne Liste, öffentliche Literale) decken AK3 ab und bleiben unangetastet.
