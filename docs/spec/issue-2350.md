# Spec #2350 — KI-Entwurf für geeignete Aufgaben (Klick, kein Auto-Lauf)

Quelle: Entscheidung C aus #1937; baut auf #2349 (`classifyLlmSuitability`) auf.

## Vertrag

- Neues Task-Feld `aiDraft` (TEXT, nullable, Migration). Das Task-DTO liefert es (`null` wenn leer).
- `POST /tasks/:id/ai-draft` (Guard `requirePlanFeature('ai_assist')` + `meterAiQuota()`):
  - Kategorie serverseitig über `classifyLlmSuitability(title, description)`; der Client schickt keine Kategorie.
  - Genau ein LLM-Aufruf mit dem Prompt der Kategorie (`draft` / `summary` / `research`, je eigener Prompt, Aufgabentitel enthalten).
  - Antwort-Freitext (getrimmt) wird in `aiDraft` gespeichert und als `200 { aiDraft }` geliefert; `aiUsage.count` +1.
  - Ohne Eignung (`null`): `400`, kein LLM-Aufruf, keine Zählung.
  - Ohne `ai_assist`: `403` `code: 'plan_required'`. Fremde / unbekannte Task-ID: `404`.
- `DELETE /tasks/:id/ai-draft`: setzt `aiDraft` auf `null`, `description` unverändert, `204`. Fremde ID: `404`.
- UI (Aufgabe bearbeiten, `TaskForm.tsx`): nur bei `aiSuitability != null` die Aktion
  `data-testid="ai-draft-action"`; `aiDraft` steht in eigenem Bereich `data-testid="ai-draft-section"` (getrennt von der
  Beschreibung) mit Löschen-Aktion `data-testid="ai-draft-delete"`. Touch-Target >= 44 px, bei 375 px kein Überlauf.
  Kein Upsell-Hinweis (ADR 0014).

## Szenario 1 — Entwurf erzeugen / löschen (API)

Plus-Nutzer, Aufgabe „E-Mail an Krankenkasse wegen Kur-Antrag entwerfen". POST → Entwurf gespeichert, Zählung +1;
DELETE → `aiDraft` null, Beschreibung unverändert (AK1/AK2).

## Szenario 2 — Grenzen (API)

Free: 403; fremder Nutzer: 404; „Fenster putzen": 400 ohne LLM und ohne Zählung (AK3).

## Szenario 3 — Anzeige (UI)

Geeignete Aufgabe zeigt Aktion, ungeeignete nicht (AK4). Nach Klick erscheint der Entwurf im eigenen Bereich, löschbar;
bei 375 px bedienbar (AK5).
