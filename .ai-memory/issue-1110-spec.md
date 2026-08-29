# Issue 1110 — Spec (Phase 3), Stand 2026-08-29T08:05:00Z

**ERGEBNIS:** Rote Tests + Spec in einem Commit auf `ai/harness/1110` (Draft-PR). AK1/AK2/AK4 rot,
AK3-Server-Test als Verriegelung grün, AK5/AK6/AK7 dedupliziert (bereits gedeckt).

## Erledigt
- Spec angelegt: `docs/spec/issue-1110.md` (Card-Titel `In der Nähe (${displayDistanceKm} km)`
  ganzzahlig, Distanzkette, Regression-Dedup).
- **TF5 Unit** `frontend/src/components/NearbyCard.test.tsx` (neu, 4 Tests, AK1): mockt
  `../api` (getGeoConfig/listNearbyTasks), `../lib/useGeolocation` und `@public-ui/react-v19`
  (KolCard spiegelt `_label` als `data-label`, Muster UpdatePrompt.test.tsx). Läuft rot:
  Label ist heute statisch „In der Nähe", `getGeoConfig` wird nie gerufen.
- **TF1/TF3/TF6 e2e** `frontend/e2e/issue-1110-nearby-radius.spec.ts` (neu, 4 Tests):
  AK1 `(5 km)`-Attribut-Vertrag, AK2 5→12 nach PUT+Reload (beide rot, richtige Ursache),
  AK3 `(0,0 km)`-Format (grün, Verriegelung), AK4 Adresssuche-Kette (rot).
- **TF2 Server** `server/src/express/tasks-nearby.test.ts` erweitert: Test „liefert exakt 0 für
  einen Task an der Position und die Haversine-Distanz sonst (AK3 #1110)" mit unabhängigem
  Haversine-Orakel im Testfile (absichtlich NICHT aus der Route importiert). Grün = Verriegelung.
- Verifikation: Unit 4/4 rot (Richtige-Ursache-Log im Output), e2e 2 rot + 1 grün + AK4 rot,
  Server-File 7/7 grün, `tsc --noEmit` (frontend) + eslint (beide Dateien) sauber, prettier gelaufen.

## Relevante Stellen
- `frontend/src/components/NearbyCard.tsx:56` — statisches `_label="In der Nähe"`; Zielzeile.
  `:23` `formatKm` (1 Nachkommastelle) nur für die Item-Distanz; der Titel braucht die Ganzzahl.
- `frontend/src/api.ts:598` — `getGeoConfig()` existiert; NearbyCard muss ihn beim Mount rufen.
- `frontend/src/components/TaskForm.tsx:947-965` — `onValueChange` setzt lat/lon auf null,
  `onSelect` → `applyAddressCoords` (:293) setzt sie. **AK4-Befund: siehe unten (realer Bug).**
- `frontend/src/components/AddressAutocomplete.tsx:39-47,153-165` — `choose()` ruft `onSelect`
  (mousedown + click, idempotent); Selektion im e2e per `getByRole('option')` zuverlässig.
- `server/src/express/routes/tasks.ts:345-383` — nearby-Route unverändert korrekt (kein Umbau).

## Annahmen
- Titel-Format: `displayDistanceKm` ganzzahlig ohne Nachkommastelle („(5 km)", „(12 km)") —
  Issue-Beispiele; `formatKm` („5,0") wäre dort falsch.
- e2e-Vertrag über das reflektierte `_label`-Attribut am `kol-card`-Host (Präzedenz
  `header-appearance.spec.ts:39`); Shadow-DOM-Textassertion bewusst vermieden.
- AK4 exakt-0- und Haversine-Werte sind als Verriegelung grün — Route ist korrekt getestet;
  „rot" ist nur für NEUES Verhalten (AK1/AK2/AK4) gefordert (SKILL: red, not broken).

## Verworfen
- AK5 (Filter außerhalb Radius) — gedeckt durch `tasks-nearby.test.ts` („nur Tasks innerhalb…")
  und `issue-1098-geo-settings.spec.ts` AK6. Kein Duplikat.
- AK6 (vier Card-Zustände) — gedeckt durch `issue-1066-nearby-card.spec.ts` (AK8/AK4/AK9/AK2).
- AK7 (375px Bounding-Box) — gedeckt durch `issue-1066-nearby-card.spec.ts:133` (AK5); der
  wenige Zeichen längere Titel fällt unter denselben Guard.
- Live-Update des Titels via `GEO_CONFIG_CHANGED_EVENT` — vom Issue explizit nicht gefordert
  („beim nächsten Laden"), kein Test.
- Unit-Tests der vier Card-Zustände — wäre Duplikat der e2e-Deckung (AK6-Dedup).

## Offen
- **AK4 ist ein realer Bug, kein Testfehler (impl-Relevanz!):** Ein über die Adresssuche
  angelegter Task wird mit `latitude: null, longitude: null` gespeichert, obwohl der Treffer
  Koordinaten hatte (per e2e-Debug-Spec verifiziert: POST-Payload
  `{"address":"Musterstraße 1, 12345 …","latitude":null,"longitude":null}`, Feldwert = volle
  Treffer-Adresse, also wurde `onSelect` ausgeführt). Hypothese: nach `choose()` setzt der
  KoliBri-Wert-Sync der KolCombobox erneut `onValueChange` ab, und `TaskForm.tsx:948-953`
  wirft dann die Koordinaten weg (Freitext-Clearing trifft die Selektion). Exakt diese Kette
  ist die #1110-Ursachensuche; Fix NUR in der Impl-Phase (Separation of Duties).
- Wegwerf-Artefakt: `/tmp/issue1110.md` (Body-Fetch) — außerhalb des Repos, kein Commit.

## Nächster Schritt
- Impl-Phase: (1) Card-Titel aus `getGeoConfig` (AK1/AK2, Unit+e2e grün machen), (2) AK4
  Koordinaten-Verlust fixen (wahrscheinlich: `onValueChange` darf Treffer-Koordinaten nicht
  nullen, wenn `next === hit.address` bzw. Selektion merken), (3) AK3-Verriegelung bleibt grün.

## Fallstricke
- Routing-Tabelle (spec sonnet/medium, impl sonnet/high, review sonnet/high) bindend.
- `_label`-Attribut-Vertrag: KoliBri reflektiert `_label` am Host — `textContent()` des Hosts
  sieht den Shadow-DOM-Titel NICHT; nicht auf Text-Assertion am Host umstellen.
- `NearbyTask`/`GeoConfig` aus `'client'` importieren; Schema-Hand-Edits werden überschrieben
  (MEMORY 2026-08-29) — hier nicht nötig, kein neuer Endpunkt.
- e2e „Anlegen"-Button ist `Anlegen` (exact), nicht „Speichern"; QuickCapture-Schritt per
  `Überspringen` überspringen (Muster crud.spec.ts:49-60).
- AK4-Test bricht bewusst an der ERSTEN Assertion (coords null); wer ihn „repariert", arbeitet
  gegen den Vertrag — er ist der eigentliche 0-km-Bug-Nachweis.
