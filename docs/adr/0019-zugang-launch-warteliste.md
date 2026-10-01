# ADR 0019 — Zugang zum Launch: Warteliste statt Ablehnung

- **Status:** Accepted (2026-10-01)
- **Datum:** 2026-10-01
- **Kontext:** [ADR 0015](0015-oeffentliche-website-und-app-unter-app.md) (Punkt 6 teilweise ersetzt), [Epic #1960](https://github.com/deleonio/priority-pilot/issues/1960), Issue #1961, Folge-Issues [#1982](https://github.com/deleonio/priority-pilot/issues/1982), [#1983](https://github.com/deleonio/priority-pilot/issues/1983)

## Kontext

Der Login akzeptiert nur vom Administrator freigeschaltete Adressen: `GOOGLE_ALLOWED_EMAILS` ist eine reine Env-Allowlist (`server/src/logics/allowedEmails.ts`), und wer nicht darauf steht, erhält einen Anmeldefehler — es entsteht kein Konto. Jede öffentliche Erwähnung der App verliert so Interessenten, bevor sie etwas ausprobieren konnten. `OPEN_SIGNUP=true` (ADR 0015, Punkt 6) öffnet die Registrierung zwar vollständig, ist aber ein Schalter ohne Kontrolle: weder Rangfolge noch Drosselung noch ein Grund, wartende Interessenten nachziehen zu lassen.

Für den Launch wird deshalb ein Zugangsmodell gebraucht, das Interessenten nicht abweist, den Zustrom aber steuert. Die bisherige Konvention „Die Allowlist bleibt als Alternative erhalten" (ADR 0015) reicht dafür nicht aus — sie ist als Architektur-Entscheidung festzuhalten.

## Entscheidung

**1. Die Allowlist bleibt Admin-Instrument.** `GOOGLE_ALLOWED_EMAILS` bleibt unangetastet und dient weiterhin dem Administrator, um Einzelne verbindlich freizuschalten (z. B. Team, Dienstleister). Sie ist nicht mehr das Zugangsmodell für den Launch.

**2. Warteliste mit Referral-Rang als Zugangsmodell zum Launch.** Interessenten melden sich an und landen auf einer Warteliste statt im Anmeldefehler. Der Rang auf der Liste wächst durch Empfehlungen (Referral), so dass engagierte Interessenten nach vorne rücken. Nachteile: Wartende können frustriert abspringen, und der Referral-Rang ist missbrauchsanfällig (Selbst-Einladungen über eigene Aliasse). Beides wird in Kauf genommen, weil der Kontrollgewinn überwiegt — Zustrom und Support-Last bleiben steuerbar, während ein Absprungender ohne Warteliste ohnehin unerreichbar verloren wäre und Rang-Manipulation nur die eigene Position verbessert, ohne andere zu verdrängen. Umsetzung: #1982.

**3. Automatische Freischaltung über Gruppen-Einladungen.** Empfänger von Gruppen-Einladungen werden ohne Warteliste automatisch freigeschaltet — Einladungen sind der direkte Weg in die App. Umsetzung: #1983.

**4. Alternativen und warum nicht:**

- **Voll offen (`OPEN_SIGNUP=true` als Default):** keine abgewiesenen Interessenten, aber keine Kontrolle über Zustrom und Support-Last beim Launch; der Schalter bleibt als Notfallschalter einzelner Instanzen erhalten, wird aber nicht das Launch-Modell.
- **Einladungs-Only (ausschließlich Freischaltung über Einladungen):** kontrolliert, aber ohne Einladung bleibt der Weg für jeden Interessenten zu — dasselbe Problem wie die Allowlist, nur weicher.

**5. Priorisierung:** Für die Freischalt-Reihenfolge gilt: ausdrücklich Eingeladene zuerst (Entscheidung 3), dann die Warteliste nach Referral-Rang (Entscheidung 2). Die Allowlist-Freischaltung (Entscheidung 1) wirkt jederzeit unabhängig davon.

## Ersetzte Punkte aus ADR 0015

- **Punkt 6, Satz „Die Allowlist bleibt als Alternative erhalten; der Produktions-Startcheck akzeptiert beides"** → ersetzt durch die Entscheidungen 1–3: Die Allowlist bleibt als Admin-Instrument erhalten, das Launch-Zugangsmodell sind Warteliste und Einladungs-Freischaltung. `OPEN_SIGNUP` bleibt als Notfallschalter einzelner Instanzen bestehen (Alternative 4, „voll offen"), ist aber nicht mehr das launch-übliche Modell.

Alles andere aus ADR 0015 gilt weiter, vor allem Website an der Wurzel, App unter `/app/` und die Kill-Switch-Regel für den alten Service Worker.

## Konsequenzen

- Warteliste (#1982) und Auto-Freischaltung (#1983) bauen auf diesem ADR auf; dieses Ticket ändert keinen Code und kein Nutzerhandbuch.
- Bis #1982/#1983 umgesetzt sind, bleibt der Status quo: unbekannte Adressen werden abgewiesen, das Nutzerhandbuch (Kapitel „Anmeldung") beschreibt die Ablehnung weiter.
- Das Nutzerhandbuch wird mit der Umsetzung der Folge-Issues auf Warteliste und Einladungs-Freischaltung umgestellt.
- Die Allowlist-Konfiguration (`GOOGLE_ALLOWED_EMAILS`, `OPEN_SIGNUP`) bleibt env-getrieben; der Server braucht dafür keine neue Infrastruktur.
