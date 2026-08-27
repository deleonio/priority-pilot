# Documenter PR #1061 — Adressfeld + Forward Geocoding für Aufgaben

## Erledigt

- PR #1061 analysiert (Titel bereits CC-konform: `feat(server): add task address field with forward geocoding search`).
- Klassifizierung: `new` (neue Feature-Funktionalität: optionales Adressfeld + Forward-Geocoding-Suche).
- Zusammenfassung erstellt (EN/DE, je 3–5 Sätze mit allen technischen Komponenten).
- Release-Note für Endanwender (2–4 Sätze: neues optionales Feld, Nominatim-Suche mit Debounce/Mindestlänge).
- 8 relevante Dateien dokumentiert (Server + Frontend + Migration + E2E + OpenAPI).
- Keine linked issues (PR-Body leer, keine "Closes #"/"Fixes #").
- `/tmp/doc.json` erstellt und mit `jq` verifiziert.

## Relevante Stellen

- `server/src/models/task.ts` — Task-Modell um `address`-Spalte erweitert (nullable, VARCHAR(255)).
- `server/src/express/routes/geocodeSearch.ts` — neuer GET /geocode-search Endpunkt (Nominatim-Integration, Rate-Limit, Fallback).
- `server/src/logics/nominatim.ts` — geteilte Rate-Limit-Infrastruktur (1 req/sec) für alle Nominatim-Routen.
- `frontend/src/lib/useAddressSearch.ts` — Debounced Search Hook (400ms, Min 3 Zeichen, Abort-on-Change, Loading-State).
- `frontend/src/components/TaskForm.tsx` — KolCombobox-Integration mit Loading-Hint.
- `server/src/logics/migrate.ts` — Migration `migrateTaskAddress` (idempotent, Bestands-DB-kompatibel).
- `openapi.yml` — API-Spec um address + /geocode-search + GeocodeSearchResult erweitert.
- `frontend/e2e/issue-1061-task-address.spec.ts` — 375px-Layout-Test mit Bounding-Box-Checks.

## Annahmen

- Titel ist bereits CC-konform (true vom Workflow übergeben, Type/Scope = feat/server passen).
- Keine linked issues → leeres `issues`-Array (kein "Closes #"/"Fixes #" im PR-Body).

## Verworfen

- Keine Alternativen verworfen — Klassifizierung `new` ist eindeutig (neue Funktionalität für Endanwender).

## Offen

- Keine — Dokumentation abgeschlossen, /tmp/doc.json liegt bereit.

## Nächster Schritt

- Keiner aus Documenter-Sicht — Workflow übernimmt den Output.

## Fallstricke

- Title-Check: Wenn `TITLE_OK=true` und Type/Scope passen → `title` leer lassen (nicht neu schreiben).
- Files-Liste: 3–8 Dateien, nur die technisch relevanten (keine reinen Test-Dateien dokumentieren, ausser E2E für UI-Änderungen).
- Migration nur bei `breaking` → hier leer, da nur additive Änderung (nullable Feld).
