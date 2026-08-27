<!-- ai-review -->
**needs-fixup** — PR #1061 (Adressfeld + Forward-Geocoding für Aufgaben). **Review ohne Issue — PR-Beschreibung ist massgebend (keine AK-Verifikation möglich)**, da `closingIssuesReferences` leer ist. Runde 1 (Kreuzverhör): 4 Findings, davon eines blockierend (F1).

## 🎯 Review-Status

`needs-fixup`

Server-Seite überzeugt: `address` an Task inkl. Validierung (String ≤255 / `null`, leerer String → `null`) und Serialisierung, idempotente `migrateTaskAddress` mit Alt-Schema-, Idempotenz- und No-op-Test, `GET /geocode-search` hinter dem globalen `requireAuth` (`server/src/express/index.ts:180` — die PR-Body-Zusage stimmt), Fallback „leere Liste statt 5xx" dokumentiert und getestet. Die Extraktion nach `server/src/logics/nominatim.ts` entfernt echte Duplizierung.

Die Frontend-Seite trägt dagegen die gesamte nicht-triviale neue Logik (Debounce, Mindestlänge, Überholschutz) und ist ungetestet.

Ausdrücklich **geprüft und verworfen** (keine Findings): der `client.GET as unknown as … & { __unsafe: true }`-Cast in `frontend/src/api.ts:527` ist kein neuer Hack, sondern das bestehende Muster aus Zeile 510 (#866); der Endpunkt ist auth-geschützt; die Typen kommen generiert aus dem `client`-Workspace-Paket, im Diff fehlt nichts.

## ✅ Behobene Anmerkungen

| #   | Finding | Behoben via | Datum |
| --- | ------- | ----------- | ----- |
| –   | _(noch keine — Runde 1)_ | – | – |

## 📋 Offene Findings

| #   | 🚦  | Was | Wo |
| --- | --- | --- | --- |
| F1  | 🔴  | `useAddressSearch` komplett ohne Test — Debounce (400 ms), Mindestlänge (3), Abbruch überholter Anfragen sind die zugesagten Kerneigenschaften und werden nirgends geprüft. Die `TaskForm`-Tests mocken `geocodeSearch` auf `[]` und asserten den Aufruf nicht → ein Wegfall des Debounce bliebe grün, obwohl dann pro Tastenanschlag ein Nominatim-Request rausginge. | `frontend/src/lib/useAddressSearch.ts:27` |
| F2  | 🟡  | `createNominatimRateLimiter()` ist eine Factory und wird zweimal aufgerufen (`reverseGeocode.ts:16`, `geocodeSearch.ts:136`) → zwei getrennte Zähler, derselbe Nutzer darf 2 req/s an Nominatim auslösen. Der Modul-Header verspricht das Gegenteil („an einer Stelle statt je Route dupliziert"). Fix: geteilte Instanz auf Modulebene. | `server/src/logics/nominatim.ts:10` |
| F3  | 🟡  | Effect-Cleanup ruft nur `clearTimeout`, kein `abort` → beim Schliessen des Formulars läuft die Anfrage bis zum 5-s-Timeout weiter und setzt State auf einer unmounteten Komponente. Zusatz: `loading` wird berechnet und exportiert, aber von `TaskForm.tsx:271` nie konsumiert — der Nutzer bekommt während 400 ms + Netz keinerlei Rückmeldung. | `frontend/src/lib/useAddressSearch.ts:57` |
| F4  | 🟡  | Sichtbare UI-Änderung (neue `KolCombobox` mit Overlay-Vorschlagsliste) ohne 375px-e2e-Test und ohne Begründung im PR — SKILL.md Schritt 3 „Mobile-first" macht das zum Finding. Die jsdom-Tests können es nicht abfangen: dort ist `KolCombobox` durch ein nacktes `<input>` ersetzt, die Liste wird nie gerendert. Lange Nominatim-`display_name`-Einträge sind genau der Überlauf-Kandidat. | `frontend/src/components/TaskForm.tsx:887` |

Details, Begründung und konkrete Vorschläge stehen in den Inline-Kommentaren des Reviews.

---

Review-Typ: Kreuzverhör · Updated: 2026-08-27
