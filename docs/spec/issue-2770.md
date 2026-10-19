# Spec #2770 — Zifferblatt-Fehlerfälle: Timeout und Kontext-Wiederherstellung

Quelle: #2765 (Nits 2+4 aus #2751). Zwei Fehlerfälle desselben Balance-Bilds — je einer an einer
Aufrufstelle der Auftakt-Freigabe. Ein kleiner PR trägt beide Fixes.

## Ziel

Das Zifferblatt bleibt in keinem Fehlerfall dauerhaft leer oder leer nach erneutem Aufbau:

1. **Hängender Balance-Status-Request (AK1):** Ohne Spiegelstand hält `Dashboard.tsx` (Effekt um
   `api.getBalanceStatus`, Aufruf :296) den Auftakt zurück, bis die Antwort kommt. Hängt der
   Request, blieb das Bild dauerhaft unsichtbar. Der Request erhält deshalb ein `AbortSignal`,
   das nach einem großzügigen Timeout (≈ 10 s) abbricht (Muster `CareHint.tsx:124–140`:
   AbortController + `setTimeout(() => controller.abort(), …)`); der Abbruch landet im
   bestehenden `catch` und gibt den Auftakt für den lokalen Wert frei.
2. **Kontext-Wiederherstellung (AK2):** `onRestored` in `BalanceFigureGL.tsx` (:375–386) baut die
   Engine neu und übergibt bisher den rohen `stateRef`-Wert. Es gilt dieselbe ODER-Politik wie im
   laufenden Effekt (:412–416): `!(auftaktBereit === false && animated)`.

## Voraussetzungen

- Fehlerfall 1: Kein gerätelokaler Spiegel (`balanceStatusCache` leer) — mit Spiegel ist die
  Freigabe unabhängig vom Request (bestehender Test, bleibt unverändert).
- Fehlerfall 2: WebGL-Bühne mit gehaltenem Auftakt (`auftaktBereit === false`) als Standbild
  (`animated === false`).

## Verhalten

### Fehlerfall 1 — Timeout (AK1, AK3)

- Der `getBalanceStatus`-Aufruf trägt ein `AbortSignal`; nach Timeout-Ablauf bricht es ab und der
  bestehende `catch` setzt `auftaktBereit = true` (Fehlzustand statt Dauer-unsichtbar).
- **AK3 — Regelbetrieb unverändert:** Schnell antwortende Requests erreichen den Timeout nie
  (kein zusätzlicher Fehlerzustand, kein Flackern); kurze Wartezeiten deutlich unter dem Timeout
  brechen nicht vorzeitig ab. Das `cancelled`-Flag des Effekts bleibt maßgeblich — der Abort eines
  Vorgänger-Requests (Effect re-runt auf `[tasks, userId]`) darf die Freigabe des Nachfolge-Effekts
  nicht vorwegnehmen.
- Timer-Aufräumen im Effect-Cleanup (unmount) ist Impl-Verantwortung; von außen nicht
  beobachtbar (der bestehende `catch` schluckt den Abort still) — deshalb kein Test.

### Fehlerfall 2 — ODER-Politik nach Wiederherstellung (AK2)

- Nach `webglcontextlost` + `webglcontextrestored` baut `onRestored` die Engine neu und setzt die
  Freigabe mit derselben Politik wie der laufende Effekt. Als Standbild zeigt auch die neu
  gebaute Engine sofort den fertigen Stand, obwohl der echte Balance-Wert noch fehlt.
- Der bisher übergebene rohe `stateRef`-Wert (`false`) leerte das Bild nach jeder
  Kontext-Wiederherstellung neu.

## Testabbildung

| AK  | Test                                                                                  | Datei                                              |
| --- | ------------------------------------------------------------------------------------- | -------------------------------------------------- |
| AK1 | Request erhält ein `AbortSignal`; Timeout-Abrich gibt den Auftakt frei                | `frontend/src/components/Dashboard.test.tsx`       |
| AK3 | Gegenprobe: Kein vorzeitiger Abbruch kurzer Wartezeiten; Antwort gibt wie bisher frei | `frontend/src/components/Dashboard.test.tsx`       |
| AK2 | `onRestored` übernimmt die ODER-Politik des laufenden Effekts (u_rise bleibt 1)       | `frontend/src/components/BalanceFigureGL.test.tsx` |

jsdom hat kein WebGL: Der GL-Test fährt die echte Komponente mit einem minimalen WebGL2-Ersatz an
`canvas.getContext` (kompiliert „erfolgreich", protokolliert Uniform-Werte) und löst die
Kontext-Events am Canvas aus. `u_rise` ist der Uniform der Auftakt-Rechnung (`auftaktStand`);
1 = freigegebener fertiger Stand, 0 = gehalten (leer).
