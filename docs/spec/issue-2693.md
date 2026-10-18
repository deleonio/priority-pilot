# E-Mail-Parsing nur einmal vorhalten — Balamentum (Server)

**Stand:** 2026-10-18
**Ziel:** `normalize` und `parseEmails` existieren im Server-Quelltext genau einmal; `adminEmails.ts` und `allowedEmails.ts` importieren sie. Verhalten und Fehlermeldungen bleiben byte-identisch (reines Refactoring, #2693).

## Vertrag: `server/src/logics/emailParsing.ts`

Neues, zustandsloses Helfer-Modul (Muster `nominatim.ts`, `push.ts`), exportiert beide Helfer:

### `normalize(email: string): string`

- Trimmt Whitespace an beiden Enden und wandelt in Kleinbuchstaben um.

### `parseEmails(raw: string): string[]`

- Leerer/whitespace-only Roh-Wert → `[]`.
- Beginnt der trimmte Wert mit `[`: JSON.parse. Bei Array → Einträge per `String()` koerziert übernehmen; bei Nicht-Array oder Parse-Fehler → CSV-Fallback.
- Sonst: CSV — Aufteilung am Komma.
- Jeder Eintrag wird normalisiert; leere Einträge werden verworfen.

## Schritte

1. `emailParsing.ts` anlegen, beide Helfer exportieren (Vertrag wie oben).
2. `adminEmails.ts` und `allowedEmails.ts` importieren von dort; die lokalen Duplikate entfallen.
3. `maskEmail`, `isAdminEmail`, `isEmailAllowed`, `getConfiguredEmails`, `isOpenSignup` und alle Wurffälle/Log-Ausgaben bleiben unangetastet.

## Erwartetes Ergebnis

- Suche über `server/src` findet je Helfer genau eine Definition; beide Verbraucher importieren aus `emailParsing.ts` (AK1, statischer Nachweis per grep).
- Die Bestandssuiten `adminEmails.test.ts` und `allowedEmails.test.ts` bleiben unverändert grün (AK2) — Spiegel für unverändertes Verhalten.
- Der Vertrag des neuen Moduls ist direkt gespiegelt: `emailParsing.test.ts` prüft Normalisierung, JSON/CSV-Erkennung, Koersion, CSV-Fallback und Verwurf leerer Einträge.
