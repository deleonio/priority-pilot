# Issue 641: Config/Docs — .env.example, Deployment-Doku, Multi-Provider-Setup-Guide

**Stand:** 2026-08-14
**Issue:** #641 (Teil von #637, Re-Analyse nach Merge von #640/PR #652)
**Ziel:** Die Doku hinkt dem implementierten Stand hinterher — `server-setup.md` kennt nur Mistral,
`llm-providers.md` beschreibt nicht den Settings-UI-Konfigurationsweg aus #640, `deployment.md` hat
keine Provider-Strategie-/Migrationsnotiz. Dieses Ticket bringt die drei Docs auf den Stand der
implementierten Kaskade (Mistral→OpenRouter, **kein** `LLM_PROVIDER`-Switch).

## Vorbedingung

- `server/src/llm/llm.ts` implementiert die Kaskade (Env-Fallback + DB-Config aus #640).
- `docs/llm-providers.md` existiert und beschreibt die Kaskaden-Architektur (Env-Weg), aber noch
  nicht den Settings-UI-Weg.
- `docs/server-setup.md` Z. 127–136 erwähnt nur `MISTRAL_API_KEY`; Fehlertabelle Z. 220 nennt nur
  „`MISTRAL_API_KEY` fehlt → 503" ohne OpenRouter-Fallback.
- `docs/deployment.md` Z. 106 verlinkt bereits `llm-providers.md`, enthält aber keine
  Provider-Auswahl-/Migrationsnotiz.

## Hinweis zum Testumfang (Carve-out)

Alle vier Akzeptanzkriterien betreffen ausschließlich **Markdown-Inhalt**
(`docs/server-setup.md`, `docs/llm-providers.md`, `docs/deployment.md`, `server/.env.example`).
Nach [ADR 0001](../adr/0001-github-workflows-bleiben-ungetestet.md) und dem
Nicht-Anwendungscode-Carve-out in `.github/prompts/spec.md` werden für Markdown-Inhalt **keine
Tests** erzwungen — ein `grep`-Test auf eigens geschriebenen Doku-Text ist ein reiner
Change-Detector ohne Fehlerfangwert. Dieser Spec ersetzt daher die „roten Tests": die
Journeys unten sind der Vertrag, den die Umsetzung erfüllen muss; der Review prüft die
AK-Erfüllung im PR-Body-Text (Zitat/Link je AK), nicht über eine Test-Suite.

## Journey 1: server-setup.md kennt die Kaskade

### Ziel

Wer `server-setup.md` als Setup-Anleitung befolgt, erfährt, dass zwei Provider (Mistral +
OpenRouter) kaskadiert werden können und dass der Ausfall eines Keys nicht zwingend zu 503 führt.

### Schritte

1. Abschnitt „5. Env-Datei" lesen (aktuell nur `MISTRAL_API_KEY`, Z. 127–136).
2. Troubleshooting-Tabelle Zeile `/tasks/suggest-pillars → 503` lesen (Z. 220).

### Erwartetes Ergebnis

- Abschnitt 5 erwähnt `OPENROUTER_API_KEY`/`OPENROUTER_MODEL` als optionale Ergänzung zur Kaskade
  (Verweis auf `llm-providers.md` reicht, kein Duplizieren der vollen Variablen-Tabelle).
- Die 503-Zeile in der Troubleshooting-Tabelle beschreibt den tatsächlichen Fallback: 503 nur wenn
  **kein** Key gesetzt ist (`MissingApiKeyError`), nicht schon wenn Mistral allein fehlt — konsistent
  mit `server/src/llm/llm.ts` (`MissingApiKeyError`) und der Fehlertoleranz-Tabelle in
  `llm-providers.md`.

## Journey 2: llm-providers.md beschreibt beide Konfigurationswege

### Ziel

Wer `llm-providers.md` liest, erfährt neben dem Env-Weg auch, dass die Konfiguration alternativ
über die Settings-UI (LLM-Tab, #640/PR #652) persistiert werden kann und welcher Weg Vorrang hat.

### Vorbedingung

- `llm-providers.md` beschreibt aktuell nur den Env-Weg (Abschnitt „Einrichtung").

### Schritte

1. Abschnitt „Einrichtung" lesen.

### Erwartetes Ergebnis

- Ein Abschnitt (oder Unterabschnitt) beschreibt den Settings-UI-Weg: `/settings` → Tab „LLM",
  Write-Only-Keys, „gespeichert"/„nicht gesetzt"-Status — konsistent mit
  `docs/spec/issue-640.md` Journey 6/7.
- Beschrieben ist, dass eine in der DB persistierte Config (Settings-UI) Vorrang vor Env hat
  (konsistent mit `docs/spec/issue-640.md` Journey 5 / `loadEffectiveLlmConfig`).

## Journey 3: deployment.md enthält Provider-Strategie-/Migrationsnotiz

### Ziel

Wer ein Deployment plant oder ein bestehendes Mistral-only-Deployment betreibt, erfährt, dass die
Kaskade optional ist und bestehende Single-Provider-Setups ohne Änderung weiterlaufen.

### Vorbedingung

- `deployment.md` Z. 106 verlinkt bereits `llm-providers.md`, ohne eigene Strategie-Aussage.

### Schritte

1. Abschnitt „2. Konfiguration (Env-Datei)" bzw. den `llm-providers.md`-Verweis lesen.

### Erwartetes Ergebnis

- Eine kurze Notiz (2–4 Sätze) hält fest: Provider-Wahl ist konfigurierbar (Mistral, OpenRouter,
  oder beide kaskadiert); bestehende Mistral-only-Deployments laufen nach dem Merge unverändert
  weiter (Env-Fallback), keine Migration nötig.

## Journey 4: Kein `LLM_PROVIDER`-Switch in der Doku

### Ziel

Die Doku führt keinen in der Codebasis nicht existierenden Konfigurationsschalter ein und
suggeriert damit kein falsches Mentalmodell (Switch statt Kaskade).

### Schritte

1. `docs/`, `server/.env.example` nach `LLM_PROVIDER` durchsuchen.

### Erwartetes Ergebnis

- Kein Treffer für `LLM_PROVIDER` in `docs/` oder `server/.env.example` — weder vorher noch nach
  der Umsetzung dieses Issues neu eingeführt.

## Akzeptanzkriterien → Journey-Zuordnung

| AK (Issue-Body)                                                         | Journey   |
| ----------------------------------------------------------------------- | --------- |
| `server-setup.md` erwähnt beide Provider + Kaskaden-/Fallback-Verhalten | Journey 1 |
| `llm-providers.md` beschreibt Env- und Settings-UI-Weg                  | Journey 2 |
| `deployment.md` enthält Provider-Auswahl-/Migrationshinweis             | Journey 3 |
| Kein `LLM_PROVIDER` in der Doku                                         | Journey 4 |

## Hinweise zur Nutzung

- `server/.env.example` selbst braucht laut Re-Analyse **keine** Änderung mehr (bereits Z. 19–23
  vorhanden) — Journey 4 prüft nur, dass kein `LLM_PROVIDER` nachträglich eingeführt wird.
- Umsetzung bitte gegen `server/src/llm/llm.ts` und die Settings-UI aus PR #652 abgleichen, nicht
  gegen Annahmen — insbesondere die genaue Fallback-Bedingung für 503 (Journey 1).
