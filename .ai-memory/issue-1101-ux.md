# Issue 1101 — UX (Phase 2), Stand 2026-08-28

## Erledigt
- Issue-Body geladen (KI-ANALYSE-Block stand=2026-08-28T18:02:05Z, Ampel 🟡, AK1–AK6, TF1–TF5, 4 offene Fragen; Feld `UI-Bezug` existiert im Analyse-Block NICHT — nur Umsetzungskontext/AK/Testfälle).
- Regeln gelesen: docs/mobile-ui-rules.md (Regel 4 Settings-Liste, Regel 7 asynchrone Zustände, Craft-Floor-Refuse-Liste inkl. „Emoji als Icon-Ersatz"), .ai-knowledge/ux-design.md (§4 KoliBri-Tabelle, §7 Craft Floor).
- Bestandscode gelesen: `frontend/src/lib/push.ts` (komplett: `usePushSubscription` mit supported/enabled/pending/failed/toggle), `frontend/src/components/SettingsPage.tsx:177-230` (KolSwitch „Push-Nachrichten aktivieren" + pushFailed-Alert + nicht-verfügbar-Alert + „Push testen"), `frontend/public/push-sw.js:14-60` (Payload `{title,body?,url?}`, `tag: 'priority-pilot'` Coalescing #504, notificationclick-Navigation), `server/src/logics/push.ts:1-40` (Payload-Interface), `frontend/src/components/NearbyCard.tsx:22-24` (`formatKm`, de-DE, 1 Nachkommastelle), `server/src/express/routes/push.ts:70ff` + `frontend/src/api.ts:391-422` (Endpunkte/Methoden).
- **Kernbefund:** AK4 ist UI- UND serverseitig bereits gebaut (#355/#386/#971) — `/push/vapid-public-key`, `/push/subscribe`, `/push/unsubscribe`, `/push/test` existieren. UX-Block schreibt das als „nicht neu bauen" fest; Lieferumfang dieses Tickets ist nur Trigger (Standort) + Nachrichtenaussage + Deep-Link.
- KI-UX-Block in den Issue-Body geschrieben: Zeilen 39–80, zwischen `<!-- KI-ANALYSE:END -->` (Z. 37) und `<!-- ai-phase-routing:START -->` (Z. 82). Verifiziert per erneuter `gh issue view`. Kein Label gesetzt, kein Kommentar, kein Titel-/Body-Copyedit.
- Zusammensetzung des Bodys ohne python/awk (beide brauchen Approval): `gh issue view > Datei`, dann `head -n 38` + `cat block` + `tail -n +39` → `gh issue edit --body-file`.

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx:177-230` — bestehender Push-Opt-in; UX-seitig vollständig (alle vier Zustände von Regel 7), darf nicht dupliziert werden.
- `frontend/public/push-sw.js:29-34` — `tag: 'priority-pilot'` ersetzt aufeinanderfolgende Pushes → Einzel-Pushes für mehrere Aufgaben überschreiben sich; Aggregation ist damit faktisch erzwungen (Empfehlung im Block: „3 Aufgaben in der Nähe").
- `frontend/public/push-sw.js:42-60` — `notificationclick` navigiert auf `payload.url` → AK5-Deep-Link muss direkt anfahrbare App-Route sein.
- `server/src/logics/push.ts:19-26` — Payload-Kontrakt `{title, body?, url?}`; AK5 darf keine neuen Felder einführen (SW ignoriert sie still).
- `frontend/src/components/NearbyCard.tsx:22-24` — `formatKm` als Formatkonvention für die Entfernung im Push-Body.
- `server/src/express/routes/push.ts:70ff` — belegt, dass die Issue-Prämisse „Backend-Endpunkte fehlen" unzutreffend ist (beratend notiert, nicht korrigiert — Copyedit verboten).

## Annahmen
- Verdict ux-ready: alle drei offenen UX-Punkte haben einen fail-safe Default (Aggregation=ja, Geo-Job nur bei aktiver Geo-Subscription, Dedup-Fenster + Obergrenze als Randbedingung); keiner braucht einen Menschen vor der Spec.
- `grep -rn "alarm|Alarmabstand|geoIntervall"` (frontend+server, ohne Tests) = 0 Treffer → #1098 ist noch nicht umgesetzt, Geo-Settings-Werte existieren noch nicht (Abhängigkeit bleibt in der Ampel 🟡 des Analyse-Blocks).
- Offene Fragen 1/2/4 des Analyse-Blocks (pro-User-Job, Subscription-Schema, Reihenfolge #1098) sind Architektur, nicht UX — deshalb nicht ux-blocking.

## Verworfen
- KoliBri-MCP-Abfrage (z. B. `spec/switch`) — kein neues Bedienelement, bestehende Komponenten unverändert; nichts zu verifizieren.
- E2E/Playwright-Inspektion — laut SKILL.md in der Pipeline rein statisch.
- Neuer Settings-Status „letzte Geo-Prüfung vor X min" als AK-Empfehlung — bläht die flache Settings-Liste (Regel 4) über ihren Zweck auf; im Block explizit davon abgeraten.
- UX-Frage nach Berechtigungs-Kaskade (Notification + Geolocation gleichzeitig) — wird bereits vom bestehenden getrennten Switch-Design sauber getragen; nur die Kopplungs-Empfehlung (Job nur bei Geo-Opt-in) aufgenommen.

## Offen
- Wegwerf-Dateien in `.ai-memory/`: `issue-1101-body.md`, `issue-1101-ux-block.md`, `issue-1101-new.md` (Body-Zusammensetzung) — NICHT committen; nur diese Datei ist die Phasen-Notiz. `rm` brauchte früher Freigaben, die nicht kamen.

## Nächster Schritt
- Spec-Phase: KI-UX-Block (Zeilen 39–80 im Issue-Body) als beratende Randbedingungen übernehmen — Priorität: AK5-Deep-Link als echte Route + `formatKm`-Konvention, AK6-Dedup-Fenster, Aggregation statt Einzel-Pushes (bestehender `tag`-Coalescing), Geo-Opt-in-Kopplung.

## Fallstricke
- Die Issue-Prämisse „AK4 fehlt serverseitig" ist falsch — die Spec-Phase darf keine doppelten Endpunkte/Subscriptions-Tabellen ausschreiben; `PushSubscription`-Modell existiert bereits (`server/src/logics/push.ts:3`, Import aus `models/index.js`).
- Mehrere AK3-Einzel-Pushes pro Lauf kollidieren mit dem fixen `tag` im SW — wer ohne Aggregation testet, sieht nur die letzte Notification (sieht aus wie „Dedup kaputt").
- Payload-Felder außerhalb `{title, body?, url?}` werden still verworfen — AK5 „Entfernung + Deep-Link" muss in `body`/`url` passen, nicht als neues Feld.
