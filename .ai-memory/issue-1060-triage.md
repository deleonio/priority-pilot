# Issue #1060 — Triage (Mistral-API-Anbindung funktioniert nicht mehr)

## Erledigt

- Re-Triage-Lauf 4 (2026-08-27T16:23Z): Abschluss des soft-aborteden 16:18er-Laufs. Der Lauf
  um 16:18:09Z hatte Body (🟢-Analyse + Routing) geschrieben und `.ai-memory/issue-1060-body.md`
  gepflegt, aber Step 5 (Labels) NICHT mehr ausgefuehrt — deshalb stand das Ticket noch auf
  `ai:needs-analyse`. Delta-Kommentare seit `stand=2026-08-27T16:18:09Z`: KEINE
  (letzter Kommentar 16:16:11Z, die Antwort von @deleonio).
- Body verifiziert (nicht umgeschrieben, `stand` bewusst unveraendert — keine neue Info):
  KI-ANALYSE-Block mit Ampel 🟢, Routing ux=nein / spec+impl+review=ja (sonnet, medium),
  offene Fragen: keine.
- Code-Behauptungen der Analyse gegengeprueft (2026-08-27T16:23Z, alle stimmen):
  `llmProviders.ts:84` = `defaultModel: 'mistral-medium-latest'`; `openapi.yml:252/296/367`
  dokumentieren Default `mistral-small-latest`; `fallbackModels` enthaelt `mistral-small-latest`
  (Z. 88) und `mistral-large/medium/ministral`-Eintraege.
- Menschen-Antwort (Kommentar 16:16:11Z von @deleonio) auf den Decision-Kommentar
  13:44:01Z: HTTP **402**, Subscription war NICHT das Problem, `MISTRAL_API_KEY` gesetzt,
  Mistral als aktiv markiert, OpenRouter funktioniert. Damit Fall (a)+(b) ausgeschlossen →
  Ursache = Code-Default `mistral-medium-latest` (abo-pflichtig) statt dokumentiertem
  `mistral-small-latest`.
- Labels final gesetzt: `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-spec`
  hinzugefuegt. Stand: `ai:analysed`, `ai:model:sonnet`, `ai:needs-spec`.
- Kein Ping-Kommentar (spec-ready, keine offenen Fragen — Body-Block + Labels sind die
  komplette Kommunikation). Kein autonomes Schliessen: Anforderung im Code nicht erfuellt
  (`llmProviders.ts:84` steht noch auf `mistral-medium-latest`).
- Kein MEMORY.md-Eintrag: nichts ueber dieses Ticket hinaus Generalisierbares
  (needs-human-Mechanik steht bereits im Skill-TRIGGER).

## Relevante Stellen

- `server/src/llm/llmProviders.ts:84` — `defaultModel: 'mistral-medium-latest'`: DER Fix-Punkt
  (AK1: zurueck auf `mistral-small-latest`).
- `server/src/llm/llmProviders.ts:85-93` — `fallbackModels`-Katalog (mistral-small-latest Z. 88);
  greift auch, wenn `GET /models` mit 402 antwortet.
- `server/src/llm/llmProviders.ts:165-187` — `toRuntimeConfig()`: Aufloesung
  `provider.model || ENV(MISTRAL_MODEL) || defaultModel` (AK2-Reihenfolge unveraendert lassen).
- `server/src/llm/llm.ts:322-357` — `callProvider()`, 502-Meldung Z. ~354: hier soll das
  verwendete Modell mit in die Fehlermeldung (AK3).
- `openapi.yml:252/296/367` — dokumentieren `mistral-small-latest` (AK4: Code an Doku
  angleichen, nicht umgekehrt; Z. 2002/2077 sind nur Beispiele, nicht aendern).
- Tests, die den Default assertieren und mitgezogen werden muessen:
  `server/src/llm/llmProviderActivation.test.ts:103`,
  `server/src/express/routes/llmProviders.test.ts:179`.
- Weitere AK4-Doku-Stellen: `server/.env.example` (MISTRAL_MODEL-Kommentar),
  `docs/server-setup.md`, `docs/deployment.md`, `docs/llm-providers.md`.

## Annahmen

- Die 16:18er-Analyse interpretiert "Subscription war nicht das Problem" zutreffend:
  402 entsteht durch Modell/Plan-Mismatch (Free-Tier-Key + medium-Modell), nicht durch
  abgelaufenes Abo. Vom Melder bestaetigt indirekt (OpenRouter/free laeuft, Mistral/medium 402).
- Shallow-Clone (`true`): Refactoring-Historie nicht einsehbar — die Default-Umstellung selbst
  ist per git log NICHT belegbar, nur die Code/Doku-Diskrepanz ist belegt.

## Verworfen

- **Screenshot auslesen** (`curl -sL .../user-attachments/2b57a443-...`): vom Bash-Tool als
  genehmigungspflichtig abgelehnt. Ueberfluessig geworden — der Melder hat den Fehlertext
  (HTTP 402) zwischenzeitlich selbst genannt.
- **Git-Archaeologie** (`git log -- server/src/llm/`): nur `cd100af` sichtbar (shallow clone).
  Kein Workaround ohne `git fetch --unshallow`.
- **Ticket schliessen / auf "Fehlermeldung verstaendlicher machen" umformulieren**: verworfen,
  weil die Antwort Fall (c) belegt (Regression im Code-Default), nicht (a)/(b).

## Offen

- Nichts aus Triage-Sicht. Pipeline: Spec-Phase laeuft als naechstes (`ai:needs-spec` gesetzt).

## Nächster Schritt

Triage ist abgeschlossen. Naechste Phase: Spec (AK1-AK4 aus dem Body-Block als rote Tests,
sonnet/medium). Ein Re-Triage gibt es nur bei neuen Kommentaren — dann Delta seit
`stand=2026-08-27T16:18:09Z` lesen.

## Fallstricke

- Der 503-Text ("Kein aktiver LLM-Provider …") und der 502-Text ("Mistral antwortete mit
  HTTP …") sind wortwoertlich verschieden — bei Rueckfragen zur Diagnose nicht vermischen.
- Ein Ping-Kommentar (Skill 4b) stoppt die Pipeline NICHT; dafuer braucht es
  `<!-- ai-triage-decision -->` als erste Zeile + `ai:needs-human` (Fehler von Lauf 1).
- Body nicht mehr anfassen, wenn sich nichts geaendert hat: `stand` nur bei echtem Rewrite
  zuruecksetzen (Skill Schritt 4), kein Pro-forma-Edit.
- Nutzer mit persistiertem `provider.model='mistral-medium-latest'` in der DB bleiben auf dem
  bezahltpflichtigen Modell — kein Migrations-Fall, die Modellwahl in der App bleibt bewusst
  vorrangig (AK2).
