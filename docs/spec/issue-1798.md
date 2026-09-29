# Spec #1798 — Wirkungsmessung Fürsorge-Vorschläge (Server)

Zweck: Admin sieht, ob Fürsorge-Vorschläge (#1791) und -Pushes (#1794) wirken. Nur Server, keine UI.

## Ereignisse (anonym)

- Tabelle `care_suggestion_events` (Modell `models/careSuggestionEvent.ts`, Default-Export `CareSuggestionEvent`): `woche`, `templateKey`, `reaktion` ∈ `angezeigt` | `uebernommen` | `abgelehnt`. **Keine `userId`-Spalte.**
- Dedup „je Vorschlag, Nutzer und Woche einmal" über einen nicht umkehrbaren Bezug (z. B. HMAC), nie in der Auswertung sichtbar.
- Anzeige: `GET /scores/care-suggestions` schreibt je gelieferter Vorlage (`typ: 'vorlage'`) höchstens ein `angezeigt` pro Nutzer und Woche.
- Ablehnung: `POST /scores/care-suggestions/dismissals` → `abgelehnt`. Übernahme: `POST /tasks` mit `careTemplateKey` → `uebernommen`, ohne Schlüssel nichts. Antworten unverändert (204 / 201).
- Protokollierungsfehler lassen den Nutzer-Request nicht scheitern.

## Push-Verlauf

- `care-config` PUT mit geändertem `carePushEnabled` schreibt einen Eintrag (Modell `models/carePushToggle.ts`, Default-Export `CarePushToggle`: `userId`, `aktiv`, `geaendertAm`); gleicher Wert schreibt nichts. Dient der Gruppierung push an/aus in der Bindung.

## Auswertung `GET /admin/care-wirkung` (nur Admin)

- 401 ohne Session, 403 für Member.
- Antwort: `{ wochen: [{ woche, angezeigt, uebernommen, abgelehnt, ignoriert }], bindung: { push_an: { w4, w12 }, push_aus: { w4, w12 } } }`.
- `ignoriert` = angezeigt − übernommen − abgelehnt, nur für Wochen, die ≥ 7 Tage zurückliegen (sonst 0).
- Bindungszelle: Kohorte = Registrierungswoche; aktiv = ≥ 1 erledigte Aufgabe in Woche 4/12. Zelle `{ nutzer, aktiv, quote }`; bei `nutzer` < 5 der String `"unterdrueckt"`.
- Keine Nutzer-IDs, E-Mails, Namen in der Antwort.

## Datenschutz

Textvorschlag in `website/src/privacy.ts` liegt im Impl-PR zur menschlichen Prüfung (kein Test).
