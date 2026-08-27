# Issue #1060 — Triage (Mistral-API-Anbindung funktioniert nicht mehr)

## Erledigt

- Re-Triage-Lauf 2 (2026-08-27T13:43Z). Vorheriger Block hatte `stand=2026-08-27T13:39:52Z`,
  Ampel 🟡, 4 offene Fragen. Delta-Kommentare seit `stand`: NUR der eigene Ping-Kommentar
  (`issuecomment-5439980399`, 13:40:24Z) — keine menschliche Antwort.
- Code gelesen: `server/src/llm/llmProviders.ts` (komplett, 361 Z.), `server/src/llm/llm.ts`
  (komplett, 766 Z.). Kein Bug gefunden — Provider-Aufloesung schluessig.
- ENV-Namen gegengeprueft (`grep MISTRAL_API_KEY` ueber yml/md/example): konsistent in
  `server/.env.example:16`, `docs/server-setup.md:127`, `docs/deployment.md:105`,
  `.ai-knowledge/project.md:98`, `openapi.yml:251`. KEIN Rename beim Refactoring.
- Issue-Body neu geschrieben mit `stand=2026-08-27T13:43:03Z`, Ampel auf 🔴 gesetzt,
  Routing-Tabelle unveraendert (ux nein / spec+impl+review ja, sonnet, medium).
- EINEN `<!-- ai-triage-decision -->`-Kommentar gepostet
  (`issuecomment-5440024966`) mit Ursachen-Tabelle a/b/c + 4 Fragen + Empfehlung.
- Labels: `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-human` gesetzt.
  Kein Phasen-Trigger (korrekt bei 🔴).

## Relevante Stellen

- `server/src/llm/llmProviders.ts:76-105` — `BUILTIN_DEFINITIONS`, Mistral zuerst
  (Fallback-Prioritaet), `defaultUrl: https://api.mistral.ai/v1`,
  `defaultModel: mistral-medium-latest`.
- `server/src/llm/llmProviders.ts:64-71` — Kommentar zu `fallbackModels` dokumentiert, dass
  Mistrals `GET /models` **HTTP 402 nach Ablauf des Free-Tiers** liefert. Das ist der stärkste
  Hinweis auf die wahrscheinlichste Ursache (Abo abgelaufen, kein Code-Bug).
- `server/src/llm/llmProviders.ts:133-137` — `builtinFallbackKey()`: Mistral nur, wenn
  `MISTRAL_API_KEY` nicht leer; sonst OpenRouter; sonst `null`.
- `server/src/llm/llmProviders.ts:244-250` — `effectiveActive()`: explizit aktive Zeile schlaegt
  Fallback. Ein unbeabsichtigt aktiv gebliebener Custom-Provider verdraengt Mistral hier.
- `server/src/llm/llmProviders.ts:165-187` — `toRuntimeConfig()`: Built-in loest ENV auf,
  `model = provider.model || ENV || default`.
- `server/src/llm/llm.ts:400-423` — `requestModelJson()`: die drei 503-Meldungen
  (kein Provider / API-Key fehlt / kein Modell) im Wortlaut.
- `server/src/llm/llm.ts:351-357` — 502-Meldung `"<label> antwortete mit HTTP <status>: <detail>"`.
  Wortlaut-Unterschied zu den 503ern ist das Unterscheidungsmerkmal a vs. b.

## Annahmen

- Der Ping-Kommentar aus Lauf 1 hat die Pipeline NICHT gestoppt (kein
  `ai-triage-decision`-Marker) — deshalb kam dieser Re-Triage-Lauf ohne neue Info an.
  Mit `ai:needs-human` + Decision-Kommentar steht die Pipeline jetzt.
- Ampel 🔴 statt 🟡, weil der zweite Durchlauf belegt hat, dass die fehlende Information
  in dieser Umgebung nicht beschaffbar ist (nicht nur "noch nicht geklaert").

## Verworfen

- **Screenshot auslesen** (`curl -sL .../user-attachments/2b57a443-...`): vom Bash-Tool als
  genehmigungspflichtig abgelehnt (2x versucht, auch ohne `;`-Verkettung). Der Fehlertext,
  die entscheidende Information, bleibt damit unerreichbar. NICHT nochmal versuchen ohne
  vorherige Freigabe von `curl`.
- **Git-Archaeologie** (`git log -- server/src/llm/`): liefert nur `cd100af`, weil
  `git rev-parse --is-shallow-repository` = `true`. Historie des Refactorings vom
  24./25.08.2026 ist nicht einsehbar. Kein Workaround ohne `git fetch --unshallow`.
- **Analyse raten**: bewusst NICHT gemacht. Ohne Fehlertext ist nicht entscheidbar, ob
  ueberhaupt ein Code-Fix noetig ist (Fall a/b = Konfiguration bzw. abgelaufenes Abo).

## Offen

- Alle 4 Fragen aus dem Decision-Kommentar (Fehlertext woertlich / `MISTRAL_API_KEY` gesetzt
  und Account aktiv / welcher Provider ist aktiv markiert / funktioniert OpenRouter?).
- Ticket ist blockiert bis zur menschlichen Antwort.

## Nächster Schritt

Auf die Antwort von @deleonio im Kommentar `issuecomment-5440024966` warten. Beim naechsten
Re-Triage: dieser Kommentar UND alle danach folgenden lesen — die Antwort ist bindend.
Bestaetigt sie Fall (a) oder (b) → Ticket schliessen bzw. auf "Fehlermeldung verstaendlicher
machen" umformulieren, NICHT in die Umsetzung geben. Nur Fall (c) rechtfertigt eine Impl.

## Fallstricke

- Der 503-Text ("Kein aktiver LLM-Provider …" / "Mistral: API-Key fehlt (MISTRAL_API_KEY) …")
  und der 502-Text ("Mistral antwortete mit HTTP …") sind wortwoertlich verschieden. Der
  Screenshot-Text allein entscheidet a/b/c — nicht weiter im Code suchen, bevor er vorliegt.
- Ein Ping-Kommentar (Skill Schritt 4b) stoppt die Pipeline NICHT. Fuer echte Blockade braucht
  es `<!-- ai-triage-decision -->` als ERSTE Zeile plus Label `ai:needs-human`. Genau das war
  der Fehler von Lauf 1.
- Bei 🔴/🟡 darf KEIN Phasen-Trigger (`ai:needs-spec`/`ai:needs-ux-ui`/`ai:needs-impl`) gesetzt
  sein; ein vorhandener waere zu entfernen. Hier war keiner gesetzt.
