# Issue 1012 — Documenter

## Erledigt
- PR 1012-Diff und -Metadaten gelesen (gh pr diff/view). PR ist gemergt (536db736, 2026-08-25T04:06:21Z).
- Klassifikation: new (neuer Endpoint POST /llm-providers/{id}/test + UI-Test-Button + upstreamError-Helfer).
- /tmp/doc.json geschrieben mit classification, summaries, release_note, files (8 relevante Dateien).
- JSON-Validität mit jq geprüft – gültig.

## Relevante Stellen
- server/src/express/routes/llmProviders.ts:368-692 — POST /:id/test mit runProviderTest, Cache (10s TTL), Vorab-Checks (Key/Modell).
- server/src/llm/upstreamError.ts — neu, zentrale upstreamErrorDetail() (200 Zeichen, detail/error.message/message).
- openapi.yml:273-338 — neuer Endpoint mit LlmProviderTestResult-Schema.
- frontend/src/components/LlmSettings.tsx:183-199, 243-261 — Testen-Button + inline-Ergebnis-Anzeige.

## Annahmen
- Titel bereits konform (feat(llm): …) → kein Vorschlag nötig, Felder leer gelassen.
- Keine verknüpften Issues (PR-Body nennt keine #NNN, nur Background aus Betrieb).

## Verworfen
- Classification internal: Nein, Nutzer-merkliche Feature-Erweiterung (Test-Button in UI).
- Classification fixed: Nein, kein Bugfix, sondern neue Funktionalität.
- Classification improved: Nein, primär neu, nicht Erweiterung Bestehender.
- Classification breaking: Nein, keine API/Vertragsänderung, nur neuer Endpoint.

## Offen
- (keine)

## Nächster Schritt
- Phase abgeschlossen — /tmp/doc.json steht bereit für Render-Schritt.

## Fallstricke
- Titel war bereits konform → Felder title/title_reason leer gelassen (nicht mit Originaltitel füllen).
- Files-Array auf die 3-8 relevantesten Dateien beschränkt (nicht alle 13 Dateien aus PR auflisten).
- Issues leer, da PR-Body keine Closes #/Fixes #-Referenz enthält.
