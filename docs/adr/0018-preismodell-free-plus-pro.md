# ADR 0018 — Preismodell: Free, Plus und Pro

- **Status:** Accepted (2026-09-29)
- **Datum:** 2026-09-29
- **Kontext:** [ADR 0014](0014-paket-angebote-ohne-dialog.md) (teilweise ersetzt), [ADR 0013](0013-zahlungsweg-paypal-abos.md) (PayPal im Web), [ADR 0017](0017-store-billing-google-play.md) (Google Play), [Epic #1780](https://github.com/deleonio/priority-pilot/issues/1780), Issue #1803

## Kontext

Die Preisstrategie im Epic #1780 ersetzt die vier Stufen (Free, Pro, Max, Ultimate) durch drei. Sie will Fair Use statt festem KI-Kontingent, einfachere MCP-Grenzen und einen Hinweis dort, wo eine Funktion gerade helfen würde. ADR 0014 entscheidet an drei Stellen anders. Ohne diese ADR widersprechen sich Umsetzung und Regelwerk.

## Entscheidung

**1. Drei Stufen: Free, Plus, Pro.**

| Funktion                                              | Free |   Plus   |        Pro        |
| ----------------------------------------------------- | :--: | :------: | :---------------: |
| Aufgaben, Serien, Checklisten, Fristen, Punkte        |  ✅  |    ✅    |        ✅         |
| Balance-Analyse, Fürsorge, Spracheingabe              |  ✅  |    ✅    |        ✅         |
| Einfache Abhängigkeiten                               |  ✅  |    ✅    |        ✅         |
| Gruppen, gewichtete Abhängigkeiten, Orts-Erinnerungen |  –   |    ✅    |        ✅         |
| KI-Hilfe                                              |  –   | Fair Use | erhöhter Fair Use |
| MCP lesen                                             |  –   |    ✅    |        ✅         |
| MCP schreiben                                         |  –   |    –     |        ✅         |

**2. Preise** (Endpreise, nach § 19 UStG ohne Umsatzsteuer):

| Paket |  Monat | Quartal (−10 %) | Jahr (−20 %) |
| ----- | -----: | --------------: | -----------: |
| Plus  | 4,99 € |         13,47 € |      47,90 € |
| Pro   | 9,99 € |         26,97 € |      95,90 € |

Maßgeblich zur Laufzeit bleibt `server/src/logics/plans.ts`; die Preise hier sind der Entscheidungsstand.

**3. Grundsätze.** Das Kernerlebnis ist kostenlos, die Fürsorge gehört vollständig in Free. Begrenzt werden Funktionen, nie die Zahl der Aufgaben. Der Aufgaben-Graph ist vor dem Kauf erlebbar. Bestandskunden zahlen nicht mehr: Pro und Max werden Plus, Ultimate wird Pro (#1785).

**4. Fair Use statt festem KI-Kontingent.** Plus und Pro nutzen die KI ohne festes Kontingent; Pro hat die höhere Fair-Use-Grenze. Die Grenze schützt vor Missbrauch und ist kein Verkaufsargument.

**5. MCP lesen ab Plus, schreiben ab Pro.** Plus-Konten können ihre Daten über MCP abfragen, Änderungen über MCP bleiben Pro vorbehalten.

**6. Upgrade-Hinweise im Arbeitsfluss kommen zurück, ohne Angebots-Dialog.** Wo eine nicht enthaltene Funktion dem Nutzer gerade helfen würde, steht ein zurückhaltender Inline-Hinweis mit Link auf den Pakete-Reiter (Umsetzung #1787). Er ist nicht modal, verdeckt keine Eingabe, unterbricht keinen Arbeitsschritt und ist wegklickbar. Es bleibt bei genau einem Hinweis an der Stelle des Bedarfs; kein Dialog, kein Event, keine Sperre der laufenden Aktion.

## Ersetzte Punkte aus ADR 0014

- **Punkt 2 (MCP-Grenzen Lesen ab Max, Schreiben ab Ultimate)** → ersetzt durch Entscheidung 5: Lesen ab Plus, Schreiben ab Pro.
- **Punkt 7 (KI ohne Kontingent in Free, eigener Provider als Ausweg) und das feste KI-Kontingent** → ersetzt durch Entscheidung 4: Fair Use in Plus und Pro.
- **Punkt 5, Satz „Im Arbeitsfluss wird eine nicht enthaltene Funktion gar nicht erst angeboten", und Konsequenz „Entdeckbarkeit verschiebt sich von der Störung zur Beschriftung"** → ersetzt durch Entscheidung 6: Inline-Hinweis am Bedarf.

Alles andere aus ADR 0014 gilt weiter, vor allem: kein Angebots-Dialog (Punkt 3), Badges ohne (i)-Schalter (Punkt 4), Angebote und Erklärung in den Einstellungen, Preis-Matrix als Tabelle (Punkt 6). Punkt 1 (Spracheingabe in Free) ist durch die Matrix bestätigt.

## Konsequenzen

- Die Paketmatrix in `plans.ts`, Preise und Migration folgen in #1782 und #1785; dieses Ticket ändert keinen Code.
- Das Stufenmodell verliert Max und Ultimate; Bestandskunden wechseln ohne Preiserhöhung.
- Die Hinweis-Regel schafft einen Wiedereinstieg für Entdeckbarkeit, ohne die Fehler des Dialogs (Textverlust, Modal in Modal) zu wiederholen.
- Zahlungswege bleiben: Web über PayPal, Android über Google Play (ADR 0017). Stripe ist zurückgestellt.
