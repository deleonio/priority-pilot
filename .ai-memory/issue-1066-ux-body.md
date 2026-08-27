### Was ist das Problem?

Das Dashboard zeigt, was als nächstes dran ist — aber nicht, was **räumlich in der Nähe** liegt. Für Wege-Erledigungen (Einkaufen, Post, Behörde) fehlt die Sicht „was kann ich von hier aus mitnehmen“. Dazu fehlt die technische Basis: Tasks tragen nur eine Freitext-`address` (#1063), **keine Koordinaten** — eine Distanzberechnung ist nicht möglich. Die Adress-Suche im Formular verwirft die Koordinaten sogar aktiv (siehe unten).

### Wo tritt es auf?

- Dashboard — `frontend/src/components/Dashboard.tsx` (Card fehlt; KolCard-Muster der Nachbar-Cards)
- Task-Formular — `frontend/src/components/TaskForm.tsx` + `frontend/src/lib/useAddressSearch.ts`: der Server liefert zu jedem Adress-Vorschlag `{address, lat, lon}`, aber der Hook mappet auf reine Strings (`results.map((entry) => entry.address)`) — die Koordinate geht bei der Auswahl verloren
- Task-Modell — `server/src/models/task.ts` (keine lat/lon-Spalten); Nachzug-Muster für Spalten existiert (`address` in `server/src/logics/migrate.ts`)
- Serien — `server/src/models/series.ts` (`address`-Snapshot auf Instanzen, #1063); Koordinaten-Snapshot fehlt ebenda in der Generierung
- Geo-Badge — `frontend/src/components/GeoBadge.tsx` (heute `address`-basiert, #1063; Einbau in `TaskTree`, `SeriesTab`, `CompletedTasksTable`)
- API — neu: `GET /tasks/nearby` in `server/src/express/routes/tasks.ts` + Schema `server/src/api.d.ts`; vorhanden: `/api/v1/reverse-geocode` + `api.reverseGeocode` (`frontend/src/api.ts`)
- Geolocation — `frontend/src/lib/useGeolocation.ts` (Präferenz-Schalter + localStorage-Spiegel existieren, Einstellungsseite)

### Wie soll es sein?

- **Nur Koordinaten in der DB (bindende Entscheidung, 27.08.):** Ein Standort wird über die Adresssuche gewählt (Vorschlag picken) und **ausschließlich als lat/lon gespeichert** — keine Adress-Zeichenkette als Geo-Daten. Die Adresse wird **immer aus den Koordinaten aufgelöst** (Reverse-Geocoding) — gleiches Pattern wie bei der eigenen Location. Vorteil: Umbenennungen von Straßen & Co. kompromitieren die Datenlage in der DB nicht.
- Das Dashboard hat eine Card „In der Nähe“: max. 10 **offene** Tasks (nicht `Done`), aufsteigend sortiert nach Distanz zu meiner aktuellen Position, je Eintrag `#id`, Titel und Distanz in km; Klick führt zum Task.
- Meine Position wird nur nach Freigabe geholt (bestehender Präferenz-Schalter + Browser-Freigabe); ohne Freigabe zeigt die Card einen klaren Hinweis, der Rest des Dashboards bleibt unbeeinträchtigt.
- Eine Serien-Instanz erbt beim Generieren die **Koordinaten** des Templates als Snapshot (analog dem `address`-Snapshot, #1063) — Koordinaten sind stabil, daher ist der Snapshot hier genau richtig.

### Thema (optional)

Feature

### Komplexität (optional)

Komplex (viele betroffene Dateien oder unsicheres Gebiet)

### Woran messen wir das?

- AK1: Wird ein Standort über einen gewählten Adress-Vorschlag gesetzt, speichert der Task ausschließlich lat/lon; das Leeren des Standorts setzt beide Werte zurück (NULL). Es wird keine Adress-Zeichenkette als Geo-Datensatz gespeichert.
- AK2: Das Dashboard zeigt eine Card mit max. 10 offenen Tasks (`Open`/`In process`), aufsteigend sortiert nach Distanz zur aktuellen Position; Tasks ohne Koordinaten und erledigte Tasks erscheinen nicht.
- AK3: Jeder Eintrag zeigt die Distanz in km (eine Nachkommastelle ausreichend).
- AK4: Verweigert der Browser die Positionsfreigabe oder ist sie nicht verfügbar, zeigt die Card einen klaren Hinweis statt eines Fehlers — Rest-Dashboard bleibt voll nutzbar.
- AK5: Bei 375px kein Layoutbruch ([Mobile-UI-Regeln](docs/mobile-ui-rules.md)), Card folgt dem KolCard-Muster der Nachbar-Cards; die Position wird erst nach Nutzer-Freigabe abgefragt.
- AK6: Eine neu generierte Serien-Instanz trägt die Koordinaten des Templates als Snapshot; eine spätere Template-Änderung ändert bestehende Instanzen nicht (#553-Muster).
- AK7: `GET /tasks/nearby` ist auth-geschützt und liefert ausschließlich Tasks des eigenen Users (Datenisolation, Muster #207/#244).
- AK8: Ist die Geolocation-Präferenz in den Einstellungen aus, wird die Position nicht abgeholt — die Card zeigt einen dezenten Hinweis mit Verweis auf die Einstellung.
- AK9: Gibt es keine (oder unter 10) Tasks mit Koordinaten, zeigt die Card eine klare Leer-Aussage bzw. entsprechend weniger Einträge — kein Fehlerzustand.
- AK10: Wird eine Adresse freitextlich eingetragen, ohne einen Vorschlag zu wählen, hat der Task keine Koordinate und erscheint nicht in der Card — das Speichern schlägt nicht fehl.
- AK11: Wird im UI eine Adresse zu einem Standort angezeigt, stammt sie aus dem Reverse-Geocoding der Koordinaten; schlägt die Auflösung fehl, degradiert die Anzeige kontrolliert (z. B. „Adresse nicht verfügbar“), kein Fehlerzustand.

### Screenshots / weitere Hinweise (optional)

**Entscheidung (Ticket-Autor, 27.08., bindend):** Coordinates-only in der DB; Adresse immer aufgelöst anzeigen (Reverse-Geocoding), gleiches Pattern wie die eigene Location. Begründung: Straßen-Umbenennungen dürfen die Datenlage nicht kompromitieren — Koordinaten sind stabil, Adress-Texte nicht.

**Konsequenz für #1063 (heute gemergt):** `GeoBadge` und Serien-Snapshot stützen sich aktuell auf den Freitext `address` (`GeoBadge.tsx` nimmt eine `address`-Prop, Serien generieren `address`-Snapshots). Mit Coordinates-only keyen Geo-Badge und Geo-Feature auf lat/lon; die Auflösung zur Anzeige läuft per Reverse-Geocoding. Das Schicksal der `address`-Spalten (entfällt vs. bleibt als Suchtext-Echo) ist eine Spec-Entscheidung — die Spalten wurden erst heute gemergt.

**Reverse-Geocoding-Kosten einplanen:** Die Card löst bis zu 10 Adressen auf — Nominatim erlaubt 1 req/s, kein Batch-Endpunkt. Auflösung daher kontrolliert (sequenziell/lazy) und client-seitig pro Session cachen; **kein** Adress-Cache in der DB (widerspräche der Entscheidung).

**Vorhandene Bausteine (nichts Neues erfinden):**
- `/api/v1/geocode-search` liefert lat/lon je Treffer; `useAddressSearch` muss je Vorschlag lat/lon mitliefern, damit die Auswahl die Koordinate erfasst (AK1/AK10).
- `/api/v1/reverse-geocode` + `api.reverseGeocode` existieren; `useGeolocation` mit Präferenz (localStorage) und 5-Minuten-Intervall.
- Migrations-Muster: `address`-Spalten-Nachzug in `server/src/logics/migrate.ts`; lat/lon analog (nullable, Bestand bleibt NULL).
- Distanz: Haversine serverseitig im `/tasks/nearby`-Endpoint, Response inkl. Distanz; TaskStatus ist `Open | In process | Done`.

**Offene Fragen (entscheiden Triage/UX):**
- Umkreis-Cap: ohne Radius-Deckel kann die Top-10 Tasks in hunderten km enthalten. Vorschlag: großzügiger fester Cap (z. B. 25 km) oder bewusst ohne Cap.
- Platzierung der Card im Dashboard (nach Deadlines? neben Vorschlägen?).
- Wo genau soll die aufgelöste Adresse sichtbar sein (Card-Einträge, Geo-Badge-Tooltip, Task-Detail)?

**Kein Scope:**
- Karten-/Map-Ansicht, Routenplanung, Live-Tracking (Position wird nur punktuell beim Card-Aufruf geholt).
- Umkreissuche mit wählbarem Radius-Filter.
- Bulk-Geocoding/Nachziehen von Koordinaten für Bestandsadressen — Koordinaten entstehen beim nächsten Bearbeiten bzw. über künftige Serien-Generierungen.
- Distanz-Anzeigen außerhalb der Dashboard-Card (Task-Listen, Suche).
- Adress-Zeichenketten als Geo-Datenquelle oder Adress-Cache in der DB (durch die Entscheidung abgedeckt).

<!-- KI-ANALYSE:START stand=2026-08-27T19:08:49Z -->
### Umsetzungskontext
- Betroffene Dateien (verifiziert):
  - `server/src/models/task.ts` — neue `latitude`/`longitude`-Spalten (nullable) neben `address` (Feld Zeile 37, Spaltendef. Zeile 136)
  - `server/src/models/series.ts` — `latitude`/`longitude` analog `address` (Feld Zeile 34, Definition Zeile 128)
  - `server/src/logics/migrate.ts` — Spalten-Nachzug nach dem `address`-Muster (Zeilen 74–75, SQLite: nullable braucht kein NOT NULL/DEFAULT)
  - `server/src/logics/series.ts` — Koordinaten-Snapshot in `generateDueInstances` neben `address: series.address ?? null` (Zeile 142)
  - `server/src/express/routes/tasks.ts` — Validierung/Persistenz von lat/lon (Validierung analog `address`, Zeile 28 ff.) + neuer `GET /tasks/nearby` (Haversine, `getUserId`/`ownerScope` aus `requireAuth.js`, Zeile 9)
  - `openapi.yml` — DTO-Quelle aller Typen (Routes importieren `components` daraus); Task-/Series-Schemas um lat/lon erweitern, Nearby-Endpoint neu. Hinweis: der im Ticket genannte Pfad `server/src/api.d.ts` existiert nicht — Schema-Quelle ist `openapi.yml`
  - `frontend/src/lib/useAddressSearch.ts` — Vorschläge künftig `{address, lat, lon}` statt reiner Strings (heute verwirft `results.map((entry) => entry.address)` die Koordinaten)
  - `frontend/src/components/TaskForm.tsx` — Koordinate des gewählten Vorschlags übernehmen; Leeren des Standorts → NULL/NULL
  - `frontend/src/components/Dashboard.tsx` — neue Card „In der Nähe" nach dem KolCard-Muster der Nachbar-Cards (Zeile 156)
  - `frontend/src/components/GeoBadge.tsx` — Keying auf lat/lon, Anzeige-Adresse per Reverse-Geocoding (aktuelle Verwendung: `CompletedTasksTable.tsx:127`, `SeriesTab.tsx:148`; `TaskTree` nutzt den Badge heute nicht)
  - `frontend/src/api.ts` — Client für `/tasks/nearby` neu; `reverseGeocode` (Zeile 509) und `geocodeSearch` (Zeile 526) existieren bereits
  - `frontend/src/lib/useGeolocation.ts` — Präferenz-Schalter, localStorage-Spiegel, 5-Minuten-Intervall existieren (AK8-Basis)
- Betroffene Komponenten: Task/Series-Modelle, Serien-Generator (Snapshot), neuer Nearby-Router (Haversine + Owner-Scope), `useAddressSearch`, `useGeolocation`, Dashboard-Card, `GeoBadge`
- Vorhandenes Muster: `server/src/express/routes/reverseGeocode.ts` (#866) für Koordinaten-→Adresse inkl. Rate-Limit-Fallback; `address`-Nachzug + Serien-Snapshot (#1063, heute gemergt) für Migration und Vererbung; `ownerScope`-Datenisolation (#207/#244) für den neuen Endpoint
- Randbedingungen: Nominatim 1 req/s, kein Batch — Adress-Auflösung der Card-Einträge sequenziell/lazy + client-seitiger Session-Cache; **kein** Adress-Cache in der DB (bindende Entscheidung Coordinates-only, 27.08.); Bestand ohne Koordinaten bleibt NULL (kein Bulk-Geocoding, explizit kein Scope); kein Umkreis-Cap (Triage-Entscheidung zu der offenen Frage im Ticket: AK2 definiert Top-10 nach Distanz ohne Radius, ein Cap wäre eine neue Anforderung; AK9 deckt den Dünn-Bestand ab); Verbleib der `address`-Spalten ist Spec-Entscheidung (siehe offene Fragen)
- Erwartetes Ergebnis: Standort wird ausschließlich als lat/lon gespeichert (bei Vorschlags-Auswahl); Dashboard-Card zeigt max. 10 offene Tasks aufsteigend nach Distanz mit #id, Titel, km; jede im UI gezeigte Adresse stammt aus Reverse-Geocoding der Koordinaten

### Akzeptanzkriterien
- AK1: Vorschlags-Auswahl speichert ausschließlich lat/lon; Leeren setzt beide auf NULL; keine Adress-Zeichenkette als Geo-Datensatz.
- AK2: Dashboard-Card mit max. 10 offenen Tasks (`Open`/`In process`), aufsteigend nach Distanz zur aktuellen Position; ohne Koordinaten/erledigte erscheinen nicht.
- AK3: Je Eintrag Distanz in km mit einer Nachkommastelle.
- AK4: Verweigerte/nicht verfügbare Freigabe → klarer Hinweis in der Card, Rest-Dashboard unbeeinträchtigt.
- AK5: Bei 375px kein Layoutbruch (docs/mobile-ui-rules.md), KolCard-Muster, Positionserhebung erst nach Freigabe.
- AK6: Neu generierte Serien-Instanz trägt Template-Koordinaten als Snapshot; spätere Template-Änderung ändert Bestandsinstanzen nicht (#553-Muster).
- AK7: `GET /tasks/nearby` auth-geschützt, liefert nur Tasks des eigenen Users (#207/#244).
- AK8: Geolocation-Präferenz aus → keine Positionsabholung, dezenter Hinweis mit Verweis auf die Einstellung.
- AK9: Keine/<10 Tasks mit Koordinaten → Leer-Aussage bzw. weniger Einträge, kein Fehlerzustand.
- AK10: Freitext-Adresse ohne Vorschlags-Auswahl → keine Koordinate, erscheint nicht in der Card, Speichern schlägt nicht fehl.
- AK11: Im UI gezeigte Adresse stammt aus Reverse-Geocoding; Fehlschlag degradiert kontrolliert („Adresse nicht verfügbar"), kein Fehlerzustand.

### Testfälle
- AK1 → Vitest-Unit `frontend/src/lib/useAddressSearch.test.ts` (Vorschlag trägt lat/lon) + API-Test `server/src/express/api.test.ts` (POST/PUT mit lat/lon persistiert Koordinaten; Leeren → NULL; Freitext ohne Koordinate bleibt speicherbar, deckt auch AK10)
- AK2/AK3 → API-Test für den Nearby-Endpoint (Sortierung aufsteigend, max. 10, nur offene Status, Distanzfeld in km) + e2e `frontend/e2e/nearby.spec.ts`
- AK4/AK8/AK9 → e2e `frontend/e2e/nearby.spec.ts` (Freigabe verweigert → Hinweis statt Fehler; Präferenz aus → Hinweis mit Einstellungs-Verweis; 0 bzw. <10 Tasks → Leer-Aussage/verringerte Liste)
- AK5 → e2e bei 375px-Viewport: kein Layoutbruch, Card folgt KolCard-Muster, keine ungefragte Positionsabholung
- AK6 → node:test `server/src/logics/series.test.ts` (Koordinaten-Snapshot analog dem `address`-Block ab Zeile 450)
- AK7 → API-Test Datenisolation nach Muster `server/src/express/api-auth-protection.test.ts` (User A sieht keine Tasks von User B, unauth → 401)
- AK11 → Vitest-Unit für die Adress-Anzeige (Reverse-Geocoding-Ergebnis; Fehlschlag → „Adresse nicht verfügbar")

### Ampel
- Ampel: 🟢
- Begründung: Bindende Entscheidung (Coordinates-only) liegt vor; 11 bereits prüfbare AKs; alle Bausteine existieren (Reverse-Geocoding-Route, Adresssuche mit lat/lon im Server-Response, Geolocation-Präferenz, Migrations- und Snapshot-Muster aus #1063). Umfang groß (Server + Frontend), aber kohärent in einem PR umsetzbar — Vorbild #1063 mit derselben Form wurde heute als ein Ticket gemergt. Kein Split: die Teile sind streng sequenziell abhängig (Spalten → Endpoint → Card), eigenständige Sub-Tasks entstünden nicht.

### ❓ Offene Fragen
- [ ] UX: Platzierung der Card im Dashboard (Vorschlag: nach der „Nächste Aufgabe“-Sektion bzw. neben den Deadlines — endgültige Platzierung in der UX-Phase)
- [ ] UX: Wo genau wird die reverse-geocodete Adresse sichtbar (Card-Einträge vs. GeoBadge vs. Task-Detail)? Das AK-Set fordert in der Card nur #id, Titel und Distanz
- [ ] Spec: Verbleib der `address`-Spalten in Tasks/Series (entfällt vs. bleibt als Suchtext-Echo) — Spalten wurden erst heute gemergt (#1063)
<!-- KI-ANALYSE:END -->

<!-- KI-UX:START -->

## UX-Beratung

### Interaktion

**Ein Screen, eine Aufgabe bleibt beim Dashboard** (Regel 5, ux-design.md §1): „Nächste Aufgabe" trägt weiter die einzige Primäraktion („Jetzt starten", `--pp-signal`) und die einzige `--pp-brand`-Fläche. „In der Nähe" ist eine Scan-Liste ohne Primäraktion — keine Signalfarbe, kein zweiter Primary-Button in der Card. Klick auf einen Eintrag führt zum Task; das tappbare Ziel ist die **ganze Zeile** (Padding statt größerem Icon, Regel 2: ≥44px Höhe, Ziel 48dp, ≥8dp Leerraum zwischen den Einträgen).

**Der Kardinalpunkt ist AK10:** Freitext-Adresse ohne Vorschlags-Auswahl speichert still keinen Standort — der Task verschwindet dann unsichtbar aus der Card. Das darf nicht stumm bleiben. Empfehlung: im `TaskForm` ein dezenter Inline-Hinweis unter dem Standort-Feld, sobald Freitext ohne gewählten Vorschlag vorliegt („Kein Standort gesetzt — der Task erscheint nicht in »In der Nähe«"). Kein Blocker, keine rote Meldung — das Speichern bleibt wie gefordert gültig.

**AK4 und AK8 sind zwei unterscheidbare Zustände**, nicht ein Hinweistext für beide:
- AK8 (Präferenz aus, `useGeolocation`-Default ist aus): Hinweis + Weg zur Einstellung — in der App lösbar.
- AK4 (Browser verweigert, `permissionDenied`): Hinweis muss sagen, dass die Freigabe **im Browser** erteilt werden muss — ein App-interner Link führt ins Leere. Kein Fehlerzustand, kein `KolAlert` in Danger-Optik: ein erwarteter Zustand wird als Text dargestellt (Muster der Leerzustände in `Dashboard.tsx`, `dashboard-next-task-empty`).

**AK11** analog: „Adresse nicht verfügbar" als dezente Textzeile, kein Alarm.

### Mobile-First

- **Platzierung:** unterhalb von „Was ist jetzt dran?" (`Dashboard.tsx:199`), oberhalb von „Wichtigste Tasks". Begründung: die Nähe-Sicht beantwortet eine Nachfrage zur nächsten Aufgabe, nicht die Kernfrage des Dashboards — hierarchisch nach der Hauptaussage, aber vor den reinen Statistik-Blöcken. Kein eigener Anker oben im Screen.
- **Eine Spalte, Liste statt Tabelle** (Regel 3): Einträge als Liste, kein `KolTableStateful` — die 375px-Regel der Komponententabelle verlangt auf Mobile ohnehin Listen. Kein horizontales Scrollen; der e2e-Test misst Bounding-Boxen (`el.x + el.width ≤ Viewport`), da die Shell mit `overflow-x: hidden` clippt — `scrollWidth` ist hier kein verlässlicher Indikator.
- **Distanz braucht Kontext am Wert** (ux-design.md §1 „Zahlen brauchen Kontext"): „2,4 km" direkt am Eintrag, nicht im Tooltip. Zahlenkolonne rechtsbündig mit `font-variant-numeric: tabular-nums` (`--pp-font-size-sm` genügt), Titel auf `--pp-font-size-base` (Fließtext ≥16px, Anti-Pattern-Liste).
- **Positionsabfrage nie ambushen:** erst wenn die Präferenz an ist **und** die Card sichtbar gerendert wird — kein Prompt beim reinen Dashboard-Aufruf für Nutzer, die die Card nie lesen. Das 5-Minuten-Intervall aus `useGeolocation` nicht auf das Dashboard übertragen: ein Punktaufruf genügt (Ticket schließt Live-Tracking explizit aus).

### A11y/BITV

- **GeoBadge-aria-label ist die wichtigste A11y-Falle des Umbaus** (`GeoBadge.tsx`): heute liest der Screenreader `Standort: <address>`. Bei Coordinates-only darf dort kein „Standort: 52.5200066, 13.4049541" landen — das ist unbrauchbar. Empfehlung: bei erfolgreicher Reverse-Auflösung der aufgelöste Kurzort (Stadt/Bezirk), sonst neutrales „Standort gesetzt" — nie Rohkoordinaten im Label. Damit bleibt Regel 9 gewahrt: Information nie allein über das Icon (1.4.1).
- **Vier gestaltete Zustände** (Regel 7): Laden (Skeleton statt Spinner — die Card-Struktur ist vorhersagbar: 10 Zeilen; alternativ `KolSpin` mit `_label`), Leer (AK9 als Einladung zum Handeln: „Noch kein Task mit Standort — setze einen beim Anlegen"), Verweigert/Aus (AK4/AK8), Erfolg. Zustandswechsel in einer `aria-live="polite"`-Region kündigen, damit Screenreader das Nachladen der Liste mitbekommen.
- **Fokusreihenfolge** folgt der DOM-Reihenfolge der Sections; jede Zeile ist ein einziges fokussierbares Element mit sichtbarem Namen („#12 – Post abgeben, 2,4 km") statt drei einzelnen Tab-Stops. Fokusring über `--pp-focus-ring`, auch auf Touch sichtbar (Regel 9).
- **Kontrast** in beiden Schemata rechnen: Hinweistexte in `--pp-ink-muted` (≥4.5:1), Distanz-Badge/Text gegen `--pp-surface-1` ≥4.5:1 bzw. ≥3:1, falls es eine Grenze bekommt (1.4.3/1.4.11). Skeleton/Loader-Bewegung unter `prefers-reduced-motion: reduce` auf Opacity reduzieren (Regel 10, Tokens deglobben das bereits auf 1ms).

### KoliBri

- Card: `KolCard _label="In der Nähe" _level={0}` nach `Dashboard.tsx:156` — Label benennt die Gruppe, kein rohes `<h3>` außerhalb. Die Sektionsüberschrift folgt dem vorhandenen Muster (`role="region"` + `aria-labelledby` wie `Dashboard.tsx:171`).
- Zustände: Hinweise als Text (`Kern`-Muster der Nachbar-Sektionen); `KolAlert` nur, falls ein echter Störungstext nötig wird — `_type` passend zur Rolle (`warning` für AK4, `info` für AK8), nie Danger für erwartete Zustände.
- Listen: rohe `ul`/`li` ist zulässig (ux-design.md §4 erlaubt Layout-/Listen-HTML); Klick-Ziel ist ein Link-artiges Element mit vollständigem sichtbaren Namen — kein Icon-only-Button, kein `aria-label`-Ersatz.
- Kein neuer Komponentenbedarf; `KolBadge` ist bewusst **nicht** der Weg für den Geo-Marker (Doku-Kommentar in `GeoBadge.tsx` — Test-/BITV-Vertrag verlangt `data-testid` + `aria-label` auf demselben Element, das die Web Component nicht leisten kann).

### Design-Sprache

- Nur Tokens: Abstände `--pp-space-3/4` innerhalb der Card, Sektionsabstand `--pp-space-6`, keine Hex-Werte, kein Abstand außerhalb der Skala (Anti-Pattern-Liste). Wer eine Hintergrundrolle zieht, setzt `color` in derselben Regel (§2 Regel 6 — sonst dunkelmodus-unlesbar).
- Kein `--pp-*status-*`-Missbrauch: die Distanz ist kein Status; Reihenfolge transportiert die Sortierung, Farbe bleibt neutral.
- Icon: Font-Awesome-Globus wie `GeoBadge.tsx`, kein Emoji (Craft-Floor-Refuse-Liste).

### Offene UX-Fragen

1. **Adresse in der Card sichtbar?** Das AK-Set fordert nur #id, Titel, Distanz. Empfehlung: nein — Card-Einträge bleiben schlank (Datensparsamkeit wie in `GeoBadge.tsx` dokumentiert); die aufgelöste Adresse gehört ins Task-Detail, Marker in der Card genügt. Muss die Spec festschreiben.
2. **Leerzustand-Wortlaut AK9:** „keine Tasks mit Koordinaten" (Tasks existieren, tragen aber keinen Standort) vs. „keine offenen Tasks" — zwei Fälle, eine Card. Wortlaut in der Spec festlegen, nicht der Implementierung überlassen.
3. **Refresh-Semantik:** Distanz zum Zeitpunkt des Dashboard-Aufrufs einfrieren oder bei erneutem Aufruf neu berechnen? Empfehlung: bei jedem Card-Aufruf neu (Position wird ohnehin punktuell geholt), aber **ohne** neues Browser-Prompt bei erteilter Freigabe.
4. **Ziel der Einstellungs-Verlinkung (AK8):** Route zur Einstellungsseite mit gefokussem Geolocation-Schalter oder nur Textverweis? Ersteres ist der bessere Weg, kostet aber eine Navigation.

<!-- KI-UX:END -->

<!-- ai-phase-routing:START -->
| Phase | Run | Modell | Effort |
| --- | --- | --- | --- |
| ux | ja | sonnet | medium |
| spec | ja | sonnet | medium |
| impl | ja | opus | high |
| review | ja | opus | medium |
<!-- ai-phase-routing:END -->
