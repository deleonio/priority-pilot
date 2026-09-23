# 📊 Kosten-Report – Ticket #1037

**Aktions-Buttons im Settings-Tab KI-Provider responsiv wie im Tab Allgemein (mobil volle Breite, desktop links inline)**

---

## 📈 Executive Summary

| Metrik                       | Wert        | Bewertung     |
| ---------------------------- | ----------- | ------------- |
| **Gesamtkosten (valueCost)** | **$4.8934** | ✅ Gut        |
| Token Input (inkl. Cache)    | 9.01M       | ✅ Normal     |
| Token Output                 | 73.4K       | ✅ Sehr gut   |
| Cache-Effizienz              | **95.9%**   | ⭐ Exzellent  |
| Turns (API-Calls)            | 132         | ✅ Normal     |
| Kosten/Turn                  | $0.0371     | ✅ Akzeptabel |

> **Gesamtbewertung: ✅ GUT** – Ticket unterschreitet die Zielmarke von $10 deutlich und zeigt exzellente Cache-Nutzung.

---

## 📊 Detaillierte Phasenanalyse

### 🔍 Analyse-Phase

| Metrik      | Wert            | Bewertung               |
| ----------- | --------------- | ----------------------- |
| Modell      | `claude-opus-5` | ❌ Teuer                |
| Kosten      | **$1.1333**     | ❌ 23% der Gesamtkosten |
| Token In    | 1.01M           | ✅ Normal               |
| Token Out   | 12.2K           | ✅ Normal               |
| Cache-Read  | 94.4%           | ⭐ Sehr gut             |
| Turns       | 18              | ✅ Normal               |
| Kosten/Turn | **$0.0630**     | ❌ Hoch                 |

**Bewertung:** ❌ **KOSTENINTENSIV** – Opus-Modell ist für diese Aufgabe überdimensioniert.

---

### 🎨 UX-Phase

| Metrik      | Wert                        | Bewertung              |
| ----------- | --------------------------- | ---------------------- |
| Modell      | `claude-haiku-4-5-20251001` | ✅ Günstig             |
| Kosten      | **$0.1732**                 | ✅ 4% der Gesamtkosten |
| Token In    | 0.67M                       | ✅ Normal              |
| Token Out   | 12.1K                       | ✅ Normal              |
| Cache-Read  | 94.0%                       | ⭐ Sehr gut            |
| Turns       | 14                          | ✅ Normal              |
| Kosten/Turn | **$0.0124**                 | ⭐ Exzellent           |

**Bewertung:** ⭐ **SEHR GUT** – Haiku-Modell perfekt gewählt, hohe Effizienz.

---

### 📋 Spec-Phase

| Metrik      | Wert              | Bewertung               |
| ----------- | ----------------- | ----------------------- |
| Modell      | `claude-sonnet-5` | ⚠️ Mittel               |
| Kosten      | **$1.3982**       | ❌ 29% der Gesamtkosten |
| Token In    | 2.66M             | ❌ Hoch                 |
| Token Out   | 15.0K             | ✅ Normal               |
| Cache-Read  | **95.9%**         | ⭐ Exzellent            |
| Turns       | 32                | ❌ Hoch                 |
| Kosten/Turn | $0.0437           | ✅ Akzeptabel           |

**Bewertung:** ❌ **KOSTENINTENSIV** – Sonnet ist für Spec-Aufgaben angemessen, aber Token Input sehr hoch.

---

### 💻 Implement-Phase

| Metrik      | Wert              | Bewertung               |
| ----------- | ----------------- | ----------------------- |
| Modell      | `claude-sonnet-5` | ⚠️ Mittel               |
| Kosten      | **$1.2869**       | ❌ 26% der Gesamtkosten |
| Token In    | 2.87M             | ❌ Hoch                 |
| Token Out   | 13.2K             | ✅ Normal               |
| Cache-Read  | **97.7%**         | ⭐ Exzellent            |
| Turns       | 40                | ❌ Sehr hoch            |
| Kosten/Turn | $0.0322           | ✅ Akzeptabel           |

**Bewertung:** ❌ **KOSTENINTENSIV** – Hohe Turn-Zahl deutet auf komplexe Umsetzung oder viele Iterationen hin.

---

### 👁️ Review-Phase

| Metrik      | Wert              | Bewertung               |
| ----------- | ----------------- | ----------------------- |
| Modell      | `claude-sonnet-5` | ⚠️ Mittel               |
| Kosten      | **$0.7534**       | ⚠️ 15% der Gesamtkosten |
| Token In    | 1.25M             | ✅ Normal               |
| Token Out   | 11.1K             | ✅ Normal               |
| Cache-Read  | 95.0%             | ⭐ Sehr gut             |
| Turns       | 17                | ✅ Normal               |
| Kosten/Turn | $0.0443           | ✅ Akzeptabel           |

**Bewertung:** ✅ **GUT** – Sonnet für Review angemessen, gute Effizienz.

---

### 📝 Documenter-Phase

| Metrik      | Wert                        | Bewertung              |
| ----------- | --------------------------- | ---------------------- |
| Modell      | `claude-haiku-4-5-20251001` | ✅ Günstig             |
| Kosten      | **$0.1485**                 | ✅ 3% der Gesamtkosten |
| Token In    | 0.55M                       | ✅ Normal              |
| Token Out   | 9.8K                        | ✅ Normal              |
| Cache-Read  | 93.1%                       | ⭐ Sehr gut            |
| Turns       | 11                          | ✅ Normal              |
| Kosten/Turn | **$0.0135**                 | ⭐ Exzellent           |

**Bewertung:** ⭐ **SEHR GUT** – Haiku-Modell perfekt gewählt.

---

## 📊 Kostenverteilung

```
Analyse (opus)    ████████████████████░░░░░░░░ 23% ($1.1333)
Documenter (haiku) ██░░░░░░░░░░░░░░░░░░░░░░░░░░░   3% ($0.1485)
UX (haiku)        ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░   4% ($0.1732)
Review (sonnet)    ██████░░░░░░░░░░░░░░░░░░░░░░░░  15% ($0.7534)
Implement (sonnet) ██████████░░░░░░░░░░░░░░░░░░░  26% ($1.2869)
Spec (sonnet)      ████████████░░░░░░░░░░░░░░░░░  29% ($1.3982)

Gesamt: $4.8934
```

---

## ✅ Was gut lief

### ✅ 1. Exzellente Cache-Nutzung (95.9%)

- **8.64M Token** wurden aus dem Cache gelesen
- Nur **0.37M Token** wurden neu in den Cache geschrieben
- **Cache-Read spart ~90% der Kosten** (0.1x Preis vs. echter Input)
- Alle Phasen zeigen **> 93% Cache-Effizienz**

**Impact:** Ohne Cache wären die Kosten bei ~$40-50 gelegen!

---

### ✅ 2. Richtige Modellwahl für Folgephasen

- UX und Documenter liefen auf **Haiku** (✅ sehr günstig)
- Review auf **Sonnet** (✅ angemessen)
- **Kosten/Turn** in diesen Phasen: $0.012-0.044 (sehr gut)

---

### ✅ 3. Geringe Output-Token (73.4K)

- Output ist pro Token am teuersten ($15/Mio)
- 73.4K Output-Token sind für 6 Phasen sehr moderat
- **Output/Turn: ~556 Token** (effizient)

---

### ✅ 4. Gesamtkosten unter Zielmarke

- **$4.89 < $10** (interne Zielmarke)
- Ticket ist kosteneffizient umgesetzt

---

## ❌ Was schlecht lief

### ❌ 1. Analyse-Phase auf Opus (23% der Kosten)

**Problem:**

- Analyse lief mit `claude-opus-5` ($5/Mio Input, $25/Mio Output)
- Kosten: **$1.1333** für nur 18 Turns
- **Kosten/Turn: $0.0630** (höchster Wert aller Phasen)

**Ursache:**

- Ticket wurde mit `ai:model:sonnet` klassifiziert
- ADR-0004 sieht vor: Analyse läuft immer auf starkem Modell
- Aber: Die Aufgabe war **CSS/Layout-Anpassung** (keine komplexe Architektur)

**Optimierungspotenzial:** 💰 **$0.80-1.00 Ersparnis**

- Für reine UI/Layout-Tickets: **Sonnet reicht aus**
- Opus sollte nur für Architektur-Entscheidungen oder komplexe Code-Analysen verwendet werden

---

### ❌ 2. Spec-Phase zu teuer (29% der Kosten)

**Problem:**

- Spec lief mit `claude-sonnet-5` ($3/Mio Input, $15/Mio Output)
- **Höchster Token-Input aller Phasen** (2.66M)
- **Meiste Turns** (32) in Folgephasen

**Ursache:**

- Spec-Phase musste Tests schreiben (rote Tests)
- Hoher Kontextbedarf für Test-Szenen
- Cache-Read war zwar hoch (95.9%), aber absoluter Input trotzdem hoch

**Optimierungspotenzial:** 💰 **$0.50-0.70 Ersparnis**

- Für reine CSS-Anpassungen: **Spec-Phase überspringbar** (ADR-0004 erlaubt dies)
- Oder: **Haiku für Spec** bei einfachen Layout-Änderungen
- Die Analyse hätte direkt `ai:needs-impl` setzen können (da keine Anwendungscode-Logik)

---

### ❌ 3. Implement-Phase mit hoher Turn-Zahl (40)

**Problem:**

- 40 Turns = höchste API-Call-Zahl
- Kosten: **$1.2869** (26% der Gesamtkosten)
- **Kosten/Turn: $0.0322** (akzeptabel, aber verbesserbar)

**Ursache:**

- Komplexe Test-Szene (Custom-Provider anlegen)
- Viele Iterationen für korrekte e2e-Tests
- Mussten mehrere Viewports testen (320px, 375px, 1280px)

**Optimierungspotenzial:** 💰 **$0.30-0.50 Ersparnis**

- **Haiku statt Sonnet** für Implement-Phase bei UI-Tickets
- Oder: **Bessere Prompt-Optimierung** (weniger Iterationen)

---

## 💡 Optimierungsempfehlungen

### 🎯 Priorität 1: Modell-Routing anpassen (Potenzial: ~$1.50-2.00 Ersparnis)

**Maßnahme:** Analyse-Phase soll Modell basierend auf Ticket-Typ wählen

```
IF Ticket-Typ == "UI/CSS/Layout" AND Komplexität == "niedrig"
    USE sonnet für Analyse
ELSE IF Ticket-Typ == "Architektur/Komplexe Logik"
    USE opus für Analyse
```

**Implementierung:**

- ADR-0004 anpassen: Analyse-Modell nicht statisch auf Opus setzen
- Neue Klassifikation: `ai:model:analyse:haiku|sonnet|opus`
- Oder: Automatische Erkennung im Triage-Skript

**Erwartete Ersparnis:** 40-50% der Analyse-Kosten = **$0.45-0.55**

---

### 🎯 Priorität 2: Spec-Phase überspringen bei UI-Tickets (Potenzial: ~$0.70-1.00)

**Maßnahme:** Für reine CSS/Layout-Änderungen Spec-Phase überspringen

**Begründung:**

- ADR-0004 erlaubt Spec-Skip bei Tickets OHNE Anwendungscode
- CSS-Änderungen sind per Definition kein Anwendungscode
- Tests können direkt in Implement-Phase geschrieben werden

**Implementierung:**

- Analyse-Phase setzt direkt `ai:needs-impl` bei UI-only Tickets
- Bedingung: `Betroffene Dateien` enthalten nur `*.css`, `*.tsx` (Layout)

**Erwartete Ersparnis:** 100% der Spec-Kosten = **$1.3982**

---

### 🎯 Priorität 3: Günstigere Modelle für Implement-Phase (Potenzial: ~$0.50-0.80)

**Maßnahme:** Haiku statt Sonnet für UI-Implementierungen

**Begründung:**

- UI-Code ist oft repetitiv und einfach
- Haiku ($1/Mio Input, $5/Mio Output) vs. Sonnet ($3/Mio, $15/Mio)
- **Faktor 3 günstiger**

**Implementierung:**

- Neue Regel: `ai:model:haiku` für alle UI/Layout-Tickets
- Oder: Automatische Erkennung basierend auf `Betroffene Dateien`

**Erwartete Ersparnis:** 66% der Implement-Kosten = **$0.8511**

---

### 🎯 Priorität 4: Prompt-Optimierung (Potenzial: ~$0.30-0.50)

**Maßnahmen:**

1. **Kontext-Beschränkung:** Nur relevante Dateien in Prompt laden
2. **Cache-Aware Prompting:** Bewusst Cache-nutzen (bereits gut umgesetzt!)
3. **Fewer-Shot Examples:** Weniger Beispiele, mehr Direktivität

**Erwartete Ersparnis:** 10-15% der Gesamtkosten = **$0.49-0.73**

---

## 📊 Gesamt-Optimierungspotenzial

| Maßnahme                | Ersparnis | Aufwand | Priorität   |
| ----------------------- | --------- | ------- | ----------- |
| Spec-Phase überspringen | **$1.40** | Niedrig | ⭐⭐⭐ HOCH |
| Haiku für Implement     | **$0.85** | Niedrig | ⭐⭐⭐ HOCH |
| Sonnet für Analyse (UI) | **$0.50** | Mittel  | ⭐⭐ HOCH   |
| Prompt-Optimierung      | **$0.50** | Mittel  | ⭐ Mittel   |
| **Gesamt**              | **$3.25** |         |             |

**Mögliche Kosten nach Optimierung: $4.89 - $3.25 = 💰 $1.64**

> **Das wäre eine Kostenreduktion von 🎯 66%!**

---

## 🛡️ Qualitätssicherung bei Kostensenkung

### ✅ Was NICHT geändert werden darf:

1. **Testabdeckung:** Alle Akzeptanzkriterien müssen weiter getestet werden
2. **Code-Qualität:** Keine Abstriche bei Type-Safety, Linting, Formatting
3. **Review-Prozess:** Menschliche Review bleibt obligatorisch
4. **Dokumentation:** Spec-Dokumente müssen bei komplexen Tickets erhalten bleiben

---

### ✅ Qualitäts-Gates (bereits umgesetzt):

- ✅ `pnpm format` – Code-Formatierung
- ✅ `pnpm lint` – Linting
- ✅ `pnpm knip` – Unused dependencies
- ✅ `pnpm test` – 414 Tests passed
- ✅ e2e-Tests – 5/5 grün
- ✅ Bestandstests – unverändert grün

**Alle Gates wurden für Ticket #1037 erfolgreich durchlaufen!**

---

## 📈 Benchmark-Vergleich

| Ticket          | Typ    | Kosten    | Token In | Cache-Effizienz | Bewertung |
| --------------- | ------ | --------- | -------- | --------------- | --------- |
| #1037           | UI/CSS | **$4.89** | 9.01M    | **95.9%**       | ✅ GUT    |
| #912 (Referenz) | ?      | $2.42     | ?        | ?               | ?         |

> **Hinweis:** Ticket #912 war der Referenzlauf aus ADR-0004. Ein direkter Vergleich ist schwierig, da die Ticket-Typen unterschiedlich sind.

---

## 🎯 Fazit & Handlungsempfehlungen

### ✅ GUT Gelaufen:

1. ✅ **Cache-Nutzung ist exzellent** (95.9%) – Weiter so!
2. ✅ **Output-Effizienz ist sehr gut** (73.4K Token)
3. ✅ **Gesamtkosten unter Zielmarke** ($4.89 < $10)
4. ✅ **Qualität wurde nicht geopfert** (alle Tests grün)

---

### ❌ SCHLECHT Gelaufen:

1. ❌ **Analyse auf Opus** – Für UI-Tickets unnötig teuer
2. ❌ **Spec-Phase lief** – Hätte übersprungen werden können
3. ❌ **Implement auf Sonnet** – Haiku wäre ausreichend gewesen

---

### 💡 Optimierungsfokus:

**Quick Wins (hohe Ersparnis, niedriger Aufwand):**

1. **Spec-Phase überspringen bei UI-only Tickets** – 💰 **$1.40 Ersparnis**
2. **Haiku für Implement-Phase bei UI** – 💰 **$0.85 Ersparnis**

**Mittelfristig:** 3. **Sonnet für Analyse bei einfachen Tickets** – 💰 **$0.50 Ersparnis**

---

### 🎯 Prognose:

Bei Umsetzung aller Optimierungen können die Kosten für ähnliche UI-Tickets von **$4.89 auf ~$1.64 gesenkt werden** (🎯 **-66%**).

**Die Umsetzungsqualität bleibt dabei unverändert hoch**, da:

- ✅ Alle automatisierten Tests weiterlaufen
- ✅ Der menschliche Review-Prozess erhalten bleibt
- ✅ Die Code-Qualitätsgates (Format, Lint, Type-Check) unverändert bleiben

---

## 📎 Anhang: Rohdaten

```json
{
	"ticket": "#1037",
	"totalCost": 4.8934,
	"totalTokensIn": 9014098,
	"totalTokensOut": 73408,
	"totalTurns": 132,
	"cacheReadTokens": 8641915,
	"cacheCreationTokens": 369613,
	"cacheEfficiency": 0.959,
	"phases": {
		"analyse": {
			"model": "claude-opus-5",
			"cost": 1.1333,
			"tokensIn": 1009768,
			"tokensOut": 12210,
			"turns": 18,
			"cacheRead": 953559
		},
		"ux": {
			"model": "claude-haiku-4-5-20251001",
			"cost": 0.1732,
			"tokensIn": 667281,
			"tokensOut": 12092,
			"turns": 14,
			"cacheRead": 627260
		},
		"spec": {
			"model": "claude-sonnet-5",
			"cost": 1.3982,
			"tokensIn": 2663477,
			"tokensOut": 14958,
			"turns": 32,
			"cacheRead": 2554826
		},
		"implement": {
			"model": "claude-sonnet-5",
			"cost": 1.2869,
			"tokensIn": 2874892,
			"tokensOut": 13210,
			"turns": 40,
			"cacheRead": 2809289
		},
		"review": {
			"model": "claude-sonnet-5",
			"cost": 0.7534,
			"tokensIn": 1245067,
			"tokensOut": 11077,
			"turns": 17,
			"cacheRead": 1183119
		},
		"documenter": {
			"model": "claude-haiku-4-5-20251001",
			"cost": 0.1485,
			"tokensIn": 553013,
			"tokensOut": 9813,
			"turns": 11,
			"cacheRead": 514635
		}
	}
}
```

---

## 🔗 Links

- [Ticket #1037](https://github.com/deleonio/priority-pilot/issues/1037)
- [PR #1038](https://github.com/deleonio/priority-pilot/pull/1038)
- [ADR-0004: Analyse-getriebenes Routing](../adr/0004-analyse-getriebenes-routing.md)
- [Kostendaten: `.costs/1037.json`](../../.costs/1037.json)

---

_Generiert am 26. August 2026 | Datenquelle: `.costs/1037.json`_
