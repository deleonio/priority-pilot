# Issue 1098 — Implement (Lauf 1), Stand 2026-08-28

**ERGEBNIS: VERDICT not-ready — Soft-Deadline traf den Lauf ~9 Min nach Start; KEIN Produktivcode geschrieben.** Spec-Modus verifiziert und aufgesetzt, PR bleibt Draft (#1103). Alles Weitere steht im nächsten Schritt an.

## Erledigt
- SKILL.md gelesen; Issue 1098 hat `ai:needs-impl` + `ai:analysed` (Assignee deleonio — menschlicher Owner, nicht blockierend, Nummer war explizit gegeben).
- Spec-Draft-PR gefunden und verifiziert: **#1103** „Geo settings entfernung", head `ai/harness/1098`, `isDraft: true`, `closingIssuesReferences` enthält #1098 (echtes Closing-Ref, kein Trap).
- Branch ausgecheckt (HEAD `bc160334` „memory: spec"; lokaler main-Stash vorher: `git stash -u` nötig, weil untracked `.ai-memory/issue-1098-*.md` den Switch blockierten — nach dem Lauf ggf. `git stash pop` auf main beachten).
- Rot-Tests lokalisiert (Commit `fa49cefa` „test: red spec tests for #1098"): `server/src/express/geo-config.test.ts` (129 Z., komplett gelesen — API-Vertrag s. Fallstricke), `server/src/express/tasks-nearby.test.ts` (+66 Z., nutzt `PUT /geo-config` via `setDisplayDistance` :77-82), `frontend/src/components/SettingsPage.test.tsx` (+125 Z.), `frontend/src/lib/useGeolocation.test.ts` (+54 Z.), `frontend/e2e/issue-1098-geo-settings.spec.ts` (133 Z., neu), `frontend/e2e/issue-1066-nearby-card.spec.ts` (+24 Z. angepasst).
- Quick-Check (SKILL step 2): alle benannten Dateien existieren (`SettingsPage.tsx`, `useGeolocation.ts`, `Dashboard.tsx`, `server/src/models/user.ts`, `routes/llmProviders.ts`); Ampel 🟢 laut Analyse-Block → implementierbar.
- `docs/spec/issue-1098.md` (70 Z.) komplett gelesen — verbindlicher Vertrag: Defaults 5/1/5, Schranken alarm ∈ [1, display], display ∈ [alarm, 50], interval ∈ [1, 60], alles ganze Zahlen, 400 bei Verstoß, nichts persistieren bei 400.

## Relevante Stellen
- `server/src/express/routes/llmProviders.ts` (467 Z.) — Muster für requireAuth + per-User-Config-Route + Validierung.
- `server/src/models/user.ts` (54 Z.) — hier (oder eigene Tabelle/Spalten) die drei Felder persistieren.
- `server/src/express/routes/tasks.ts:331-344` — `GET /tasks/nearby`, AK6-Server-Filter auf `displayDistanceKm` (Default 5).
- `frontend/src/components/SettingsPage.tsx:235-292` — Geo-Switch-Block; darunter die drei `KolInputRange` (AK1); `_disabled`-Muster :338, key-Remount :266-272 (AK3), `_hint` :242 folgt Intervall.
- `frontend/src/lib/useGeolocation.ts:5` `GEOLOCATION_INTERVAL_MS` + `:162` setInterval — AK5 konfigurierbar, Fallback 5 min; 3 Instanzen (Settings/Nearby/Footer).
- `frontend/src/components/Dashboard.tsx:222` — `<NearbyCard />` bedingungslos → AK4 bedingtes Rendern; `Footer.tsx:4-14` Adresse/Koordinaten bei aus null.
- OpenAPI/Client-Typen mitändern (DTO Geo-Config; `client`-Import im Frontend).

## Annahmen
- Keine codebezogenen neuen Annahmen; die der Triage/Spec (50-km-Obergrenze, localStorage-Switch out of scope, UX-Block obsolet für Errors) gelten unverändert.
- Memory-only-Commit ist nach Push-ok (Muster `memory: spec` auf demselben Branch); prettier-Check nur auf die Notiz-Datei.

## Verworfen
- Teil-Implementierung (nur Server-Route) innerhalb der Restzeit — Voll-Gate (format/prettier/lint/knip/test) vor Push nicht mehr schaffbar; halbfertiger, ungegateter Code auf dem Spec-Branch wäre für den Folgelauf schlechter als ein sauberer Notiz-Stand.
- Labels gesetzt/verändert — verboten (Workflow macht das).

## Offen
- Komplette Implementierung AK1–AK8 (Server: Route+Modell+Registrierung+OpenAPI; Frontend: Settings-Block, useGeolocation-Intervall, Dashboard/Footer-Bedingung, NearbyCard-Distanzformat `(2,4 km)` + Server-Filter; E2E TF7/TF8).
- Voll-Gate + `gh pr ready 1103` + PR-Beschreibung erweitern (Implementierungs-Zusammenfassung, Testergebnisse).

## Nächster Schritt
- Server zuerst: `geo-config`-Route nach `llmProviders.ts`-Muster (`requireAuth`, GET=Defaults 5/1/5 falls nichts gespeichert, PUT mit Schranken-Validierung → 400 ohne Persistenz), dann `pnpm --filter server test -- geo-config` grün, danach Frontend in derselben Reihenfolge wie Relevante Stellen.

## Fallstricke
- GET/PUT antworten mit dem **flachen** Objekt `{displayDistanceKm, alarmDistanceKm, intervalMinutes}` (deepEqual im Test — kein Wrapper-Feld!).
- 400-Cases aus `geo-config.test.ts:94-101`: alarm 0, alarm>display, display 0, display 51, interval 61, interval 0 — ganzzahlig prüfen (kein 2.5).
- `tasks-nearby.test.ts` baut User-Config über dieselbe PUT-Route auf → Route MUSS vor/n mit tasks-Filter zusammen fertig werden; `displayDistanceKm = 50` dort als Max-Filter-Fall dokumentiert (Testkommentar :17).
- AK2: KEINE Error-States/Alerts/Inline-`_msg` (Autoren-Entscheidung) — dynamische Kreuz-Schranken in den `_min`/`_max` der InputRange statt dessen.
- AK3: `_disabled`-Wechsel nach Mount → key-Remount (`SettingsPage.tsx:266-272`).
- TF8: Bounding-Box-Assertions statt scrollWidth (App-Shell `overflow-x:hidden`).
- Intervall-Verkürzung darf Nominatim 1 req/s nicht reißen — Re-Entrancy-Guard im Hook bleibt; 3 Hook-Instanzen beachten.
- E2E-Filter-Falle: `pnpm --filter frontend test:e2e -- <pattern>` filtert nicht — direkt `npx playwright test e2e/<datei>.spec.ts` im `frontend`-Verzeichnis.
