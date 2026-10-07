# Spec #2349 — KI-Eignung von Aufgaben kennzeichnen (Heuristik, kein LLM)

Quelle: Entscheidung C aus #1937. Kein LLM-Aufruf, keine Persistenz, keine Migration.

## Vertrag

- `classifyLlmSuitability(title, description)` in `server/src/logics/llmSuitability.ts` (rein, synchron)
  liefert `'draft' | 'summary' | 'research' | null`.
  - draft: Schriftliches entwerfen/formulieren (E-Mail, Brief, Antrag, Text).
  - summary: Unterlagen/Dokument zusammenfassen.
  - research: etwas recherchieren/vergleichen/herausfinden.
  - `null`: kein Vorarbeit-Charakter (z. B. „Fenster putzen"), leere Eingabe.
  - Je App-Sprache (de, en, es, fr, it, nl, pl, pt, ru, sv) wird mindestens ein typischer Satz je Kategorie erkannt.
- Die Task-Antwort (`GET /tasks`) enthält `aiSuitability` (Kategorie) nur, wenn das Paket des Nutzers
  `ai_assist` enthält (`shouldBlockFeature(plan, 'ai_assist') === false`). Sonst fehlt das Feld
  oder ist `null`. Wert beim Lesen berechnet, nicht gespeichert.
- UI: Aufgabenzeile (`TaskTree.tsx`, `.task-tree-badges`) zeigt bei gesetzter Kategorie ein
  nicht-interaktives Badge `data-testid="ai-suitability-badge"` mit dem Kategorienamen
  (de: Entwurf / Zusammenfassung / Recherche), sonst nichts. Bricht bei 375 px um statt aus der Zeile.

## Szenario 1 — Klassifikation

Vorbedingung: Titel (+ Beschreibung). Schritt: `classifyLlmSuitability`. Erwartet: Kategorie bzw. `null` (AK1/AK2).

## Szenario 2 — API-Gating

Vorbedingung: `MONETIZATION_ENFORCED=true`, Aufgabe „E-Mail an Krankenkasse wegen Kur-Antrag entwerfen".
Free: kein `aiSuitability`; Plus: `draft` (AK3). Geeignete Aufgabe vs. „Fenster putzen": `null`.

## Szenario 3 — Anzeige

Vorbedingung: eine geeignete und eine ungeeignete Aufgabe. Erwartet: nur die geeignete trägt das Badge
mit Kategoriename (AK4); bei 375 px liegt die rechte Badge-Kante innerhalb der Zeile (AK5).
