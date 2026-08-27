<!-- ai-review -->
**reviewed** — PR #1061 (Adressfeld + Forward-Geocoding für Aufgaben). **Review ohne Issue — PR-Beschreibung ist massgebend (keine AK-Verifikation möglich)**, da `closingIssuesReferences` leer ist. Runde 2 (Fixup-Nachweis): alle 4 Findings aus Runde 1 durch Commit f215c176 behoben, keine neuen Findings.

## 🎯 Review-Status

`reviewed`

Delta-Review von Commit f215c176 (einziger Commit seit Runde 1): F1–F4 sauber adressiert — jeweils mit prüfenden Tests statt nur Code-Fix, nie umnummeriert. CI auf f215c176 grün (verify, e2e 1–4, precheck). Die Round-1-Basisbewertung bleibt unverändert: Server-Seite überzeugt (Validierung, idempotente Migration, Auth, Fallback), die Frontend-Logik ist jetzt getestet.

## ✅ Behobene Anmerkungen

| #   | Finding | Behoben via | Datum |
| --- | ------- | ----------- | ----- |
| F1  | 🔴 `useAddressSearch` komplett ohne Test (Debounce, Mindestlänge, Überholschutz ungeprüft) | Commit f215c176 — `frontend/src/lib/useAddressSearch.test.ts` NEU: 4 Tests (Mindestlänge < 3 → kein Aufruf; Debounce → genau 1 Aufruf mit letztem Text; Überholschutz inkl. verworfener Spätantwort; Unmount-abort). Mit Biss: assertiert Mock-Aufrufe und `signal.aborted` direkt | 2026-08-27 |
| F2  | 🟡 `createNominatimRateLimiter()`-Factory → zwei getrennte Zähler (2 req/s möglich) | Commit f215c176 — `server/src/logics/nominatim.ts` exportiert jetzt `isNominatimRateLimited()` auf Modulebene mit EINER geteilten `rateLimitMap`; beide Routen umgestellt. Neuer Cross-Route-Test in `geocode-search.test.ts`: Reverse-Geocode < 1 s nach Suche → gedrosselt trotz Nominatim-Treffer-Mock | 2026-08-27 |
| F3  | 🟡 Effect-Cleanup ohne `abort`; `loading` nie konsumiert | Commit f215c176 — Cleanup ruft `controller?.abort()`; zusätzlicher abort-Guard im `.then` (Mock-Adapter, die trotz abort resolven, überschreiben keine alten suggestions mehr); `TaskForm.tsx` zeigt `loading` als `_hint` („Adresse wird gesucht …") an der KolCombobox | 2026-08-27 |
| F4  | 🟡 Sichtbare UI-Änderung ohne 375px-e2e-Test | Commit f215c176 — `frontend/e2e/issue-1061-task-address.spec.ts` NEU: 375×667, Nominatim per `page.route` gestubbt (5 lange `display_name`), Bounding-Box-Checks für Feld und geöffnete Vorschlagsliste (nicht `scrollWidth` — App-Shell clippt) | 2026-08-27 |

## 📋 Offene Findings

Keine.

---

Review-Typ: Fixup-Nachweis · Updated: 2026-08-27
