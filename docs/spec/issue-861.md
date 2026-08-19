# Issue 861: OpenRouter ContextLength Integration

## Ziel

OpenAPI-Spec und Server-Endpunkt erweitern, um Model-Größe und Kontext-Größe von OpenRouter zu liefern.

## Vorbedingung

- OpenRouter-API ist erreichbar und liefert Model-Daten
- Server-Endpunkt `/models/free` ist implementiert

## Schritte

1. Client ruft GET /models/free auf
2. Server fragt OpenRouter-API ab
3. Server mappt OpenRouter-Antwort auf FreeModel-Struktur
4. Server liefert Modelle mit contextLength-Feld (optional, number)

## Erwartetes Ergebnis

- GET /models/free liefert Modelle mit contextLength-Feld (optional, number)
- Fehlende contextLength in OpenRouter-Antwort bricht nicht ab (Feld ist optional)
- OpenAPI-Spec definiert contextLength korrekt

## Testable Cases

- TC1: GET /models/free liefert Modelle mit contextLength-Feld (optional, number)
- TC2: Fehlende contextLength in OpenRouter-Antwort bricht nicht ab (graceful degradation)

---
## Versionierung

- **v1.1** (2026-08-19): Nightly-Sync — Ist-Stand verifiziert, ContextLength implementiert
- **v1.0** (Initialefassung für Issue #861)