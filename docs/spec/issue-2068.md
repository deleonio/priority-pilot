# Spec: Issue #2068 — KI-Vorschläge für den Erststart aus Freitext

## Ziel

Neuer Endpunkt `POST /tasks/suggest-initial`: Der Nutzer beschreibt Freitext („Was beschäftigt dich
gerade?“), der Server lässt daraus 5–8 konkrete Task-Vorschläge je Titel erzeugen — jede mit einer
gültigen Säule des Nutzers und optional einer Abhängigkeit (`dependsOn`) zu einem anderen Vorschlag
derselben Antwort. Es werden **keine** Tasks angelegt, nur vorgeschlagen. Muster, Guards und
Fehlerantworten entsprechen exakt `parseTasks.ts` bzw. `suggestPillars.ts`.

## Vorbedingungen

- Eingeloggter Nutzer (App-Auth wie bisher; Route hängt an derselben App wie `parse-text`).
- Mind. eine angelegte Säule des Nutzers — ohne Säulen gibt es nichts, worauf Vorschläge verweisen
  könnten (`suggestPillars.ts`: 503).
- Neuer injizierbarer Suggester `suggestInitialTasksParser` in `AppDeps` (Default: echter LLM-Call);
  Tests injizieren einen Mock, nie einen echten API-Aufruf.

## Schritte und erwartetes Ergebnis

1. **Erfolgsfall (AK1):** `POST /tasks/suggest-initial` mit `{ text }` (1–2000 Zeichen nach Trim)
   antwortet 200 mit `{ suggestions: [...] }`; 5–8 Einträge; jeder Eintrag hat einen nicht-leeren
   `title: string`, eine `pillarId` aus den Säulen des Nutzers (`ownerScope`) und optional
   `dependsOn: number` — ein Index auf einen **anderen** Eintrag desselben Arrays (`0..n-1`,
   `!==` eigener Index).
2. **Bereinigung (AK2):** Suggester-Ausgabe wird je Eintrag validiert; verworfen werden Einträge mit
   leerem/fehlendem Titel, unbekannter `pillarId` (nicht unter den Säulen des Nutzers) oder
   ungültigem `dependsOn` (eigener Index, negativ, außerhalb `0..n-1` oder kein Integer). Die Antwort
   enthält nur gültige Einträge in ursprünglicher Reihenfolge; die Bereinigung ist kein Fehlerfall —
   auch eine Restliste unter 5 Einträgen antwortet 200.
3. **Paket-Guard und Kontingent (AK3):** `requirePlanFeature('ai_assist')` und `meterAiQuota()`
   laufen wie bei `parse-text` VOR dem Handler — Free mit `MONETIZATION_ENFORCED=true` → 403
   `plan_required`; über Budget → Fair-Use-429 `ai_throttled` (#1783: erste Anfrage über Budget
   wird noch gebucht, die nächste im Drosselintervall abgewiesen); erfolgreicher Aufruf zählt genau
   1 auf `ai_usage`.
4. **Eingabe-Fehler (AK4):** fehlender/leerer/Whitespace-`text`, `text` > 2000 Zeichen → 400 mit
   derselben Message-Struktur wie `parseTasks`; unbekannter `?provider=` → 400 (#749); Nutzer ohne
   Säulen → 503 „Es sind keine Säulen konfiguriert.“ (wie `suggest-pillars`).
5. **Vertrag (AK5):** openapi.yml erhält den Pfad `/tasks/suggest-initial` plus Input- und
   Suggestion-Schema; die Route nutzt die generierten Typen aus `server/src/api` (`pnpm --filter
server build` bleibt grün). Kein eigener Test — der Vertrag läuft über die Build-Typen.

## Abgrenzung

- Kein Task-/Serien-Anlegen, kein zweiter Endpunkt, keine Frontend-Änderung (diese folgen später).
- Plan-Matrix, Quota-Zähler und Fair-Use-Drossel werden nicht verändert — nur benutzt.
- Bestehende Endpunkte und deren Tests bleiben unberührt.
