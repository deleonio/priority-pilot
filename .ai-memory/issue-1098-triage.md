# Issue 1098 — Triage (Re-Triage), Stand 2026-08-28T18:18:41Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢 (vorher 🟡).** Trigger: KI-ANALYSE-Block stand=2026-08-28T18:02:05Z vorhanden → Re-Triage; 2 Delta-Kommentare: Bot-Crash-Notice (18:10Z, keine Entscheidung — UX-Phase hatte Block geschrieben, aber kein VERDICT emittiert) + **Autoren-Antwort deleonio 18:13:52Z = bindend**: (1) Geo-Config serverseitig pro User, (2) InputRange mit Kreuz-Schranken statt Alerts (Anzeige: nicht kleiner als Alarm, Default 5 km; Alarm: max Anzeige, Default 1 km), (3) abhängige Issues sequenziell (#1101 nach #1098). Block komplett neu geschrieben (alle 3 offenen Fragen beantwortet → 🟢), Routing-Tabelle unverändert übernommen, Labels `ai:needs-analyse` entfernt + `ai:needs-spec` gesetzt (UX lief bereits — Block vorhanden; kein `ai:needs-ux-ui`, keine UX-Wiederholung nötig). Kein Ping, Titel/Body-Text unangetastet, kein Auto-Close (Anforderungen offenbar nicht implementiert).

## Erledigt
- Delta-Kommentare gelesen (nur die 2 seit stand); Autoren-Antwort in AK2/AK7/Randbedingungen eingebaut.
- Alte Block-Pfade als halluziniert entlarvt und korrigiert: `frontend/src/routes/settings.tsx`/`DashboardCards.tsx`/`Root.tsx`/`server/src/db.ts`/`user-settings.ts` existieren NICHT — echt sind `frontend/src/components/SettingsPage.tsx`, `Dashboard.tsx:222` (`<NearbyCard />` bedingungslos), `NearbyCard.tsx` (formatKm, `nearby-preference-off`), `Footer.tsx:4-14` (Adresse bei aus schon null), `useGeolocation.ts:5,162` (fixes 5-min-Intervall, localStorage `pp-geolocation-enabled` :17), `server/src/models/user.ts`, `server/src/express/routes/llmProviders.ts` (per-User-Config-Vorbild), `server/src/express/routes/tasks.ts:331-344` (GET /tasks/nearby ohne Radius).
- Body-Splice per head/tail (Zeilen 1–10 + neuer Block + ab Zeile 46), `gh issue edit --body-file`, Landing verifiziert (stand 1×, KI-UX + Routing intakt, User-Text Zeile 1 unversehrt).

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx:235-292` — Geo-Switch-Block; neuer Geo-Settings-Block DARUNTER (AK1), `_disabled`-Muster :338, key-Remount :266-272 für TF3.
- `frontend/src/lib/useGeolocation.ts:5` `GEOLOCATION_INTERVAL_MS` + `:162` setInterval — AK5 macht das konfigurierbar (Fallback 5 min); Hook läuft als EIGENE Instanz in SettingsPage/NearbyCard/Footer (jede Instanz eigenes Timer/Position-Ref).
- `frontend/src/components/Dashboard.tsx:222` — `<NearbyCard />` bedingungslos → AK4 bedingtes Rendern; ersetzt #1066-Zustand `nearby-preference-off`.
- `server/src/express/routes/llmProviders.ts` + `server/src/express/llmProviders.test.ts` — Vorbild für per-User-Geo-Config-Route (requireAuth, Validierung, Dataisolation-Test TF5, neue Datei `geo-config.test.ts`).
- `server/src/express/routes/tasks.ts:344` — nearby-Endpunkt: Server-Filter auf gespeicherte Anzeige-Entfernung (TF6, Erweiterung `tasks-nearby.test.ts`).

## Annahmen
- 50-km-Obergrenze der Anzeige-Entfernung (Autor nannte kein max; InputRange braucht `_max`) — im Block als Annahme dokumentiert, nicht blockierend.
- „Geo-Config serverseitig" umfasst nur die 3 NEUEN Werte; Migration des bestehenden `pp-geolocation-enabled`-Switch (localStorage) ist NICHT Scope („alle Einstellungen immer serverseitig" als Folge-Thema in Randbedingungen vermerkt).
- UX-Phase gilt als erledigt (Block liegt vor, „advisory, not blocking"); InputRange-Entscheidung des Autors ersetzt die KolInputNumber-Empfehlung des UX-Blocks — deshalb direkt `ai:needs-spec`.

## Verworfen
- `ai:needs-ux-ui` setzen (UX-Neulauf) — Block existiert, Antworten vereinfachen die UI statt neue UX-Fragen zu erzeugen; wäre Phase-Verschwendung.
- Split — Server+Frontend in einem PR (Präzedenz #1083: ein zusammenhängender AK-Satz, API-Vertrag Teil desselben Features).
- Titel-/Body-Copyedit („Geo settings entfernung" — unpräzise, aber nicht substantiell falsch).
- #1101-Label `ai:needs-ux-ui` entfernen (sequenzielle Abarbeitung betreffend) — außerhalb des Fokus dieses Laufs; nur in Randbedingungen verankert.

## Offen
- Wegwerf-Artefakte untracked in `.ai-memory/`, NICHT committen: `issue-1098-body.md`, `issue-1098-block.md`, `issue-1098-new.md`, `issue-1098-splice.py` (dieser Lauf) + `issue-1098-ux-block.md` (UX-Lauf). Nur `issue-1098-triage.md` + `issue-1098-ux.md` sind echte Phasen-Notizen. `rm` brauchte Freigabe (Muster #1083/#1095).

## Nächster Schritt
- Spec-Phase (Label `ai:needs-spec` gesetzt): rote Tests für AK1–AK8 — TF5 neu `server/src/express/geo-config.test.ts`, TF6 Erweiterung `tasks-nearby.test.ts`, TF1–TF3 in `SettingsPage.test.tsx`, TF4 in `useGeolocation.test.ts`, TF7/TF8 neu `frontend/e2e/issue-1098-geo-settings.spec.ts`.

## Fallstricke
- Routing-Tabelle im Body: ux ja/sonnet/medium, spec ja/sonnet/medium, impl ja/opus/high, review ja/sonnet/medium — unverändert, für Folgephasen bindend.
- AK2 hat KEINE Error-States mehr (Autoren-Entscheidung) — wer Inline-`_msg`/Error-Tests aus dem UX-Block umsetzt, arbeitet gegen die Entscheidung; der Inline-Error-Abschnitt des KI-UX-Blocks ist explizit obsolet (im Analyse-Block vermerkt).
- TF3: KoliBri `_disabled`-Wechsel nach Mount braucht key-Remount (`SettingsPage.tsx:266-272`), sonst Unit-Mock grün / live rot.
- TF8: Bounding-Box-Assertions statt scrollWidth (App-Shell clippt overflow-x:hidden, Memory 2026-08-24).
- Intervall-Verkürzung darf Nominatim-Rate-Limit (1 req/s) nicht reißen — Re-Entrancy-Guard im Hook bleibt; 3 Hook-Instanzen (Settings/Nearby/Footer) beachten.
- OpenAPI/Client-Typen mitändern (DTO für Geo-Config; `client`-Import im Frontend).
