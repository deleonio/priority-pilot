# Spec #2795 — Durchsetzungsstelle nach BFSG konkret eintragen (Website)

## Ziel

Die Zugänglichkeitserklärung (#2769) nennt die Durchsetzungsstelle nach § 14 BFSG in beiden
Sprachfassungen konkret statt als Platzhalter: die Marktüberwachungsstelle der Länder für die
Barrierefreiheit von Produkten und Dienstleistungen (MLBF) mit vollständigen Kontaktdaten.

## Regeln

1. **De-Fassung (AK1):** `website/src/accessibility.ts`, Abschnitt „Durchsetzungsstelle“ — der
   Platzhalter-Satz („Welche Stelle konkret zuständig ist, tragen wir hier nach, sobald sie
   benannt ist.“) weicht der MLBF mit vollständigem Namen und Kontaktdaten (Postanschrift
   Carl-Miller-Str. 6, 39112 Magdeburg; Website www.mlbf-barrierefrei.de; E-Mail
   kontakt@mlbf-barrierefrei.de; Telefon +49 391 567 6970).
2. **En-Fassung (AK2):** derselbe Abschnitt („Enforcement“) ersetzt den Platzhalter-Satz
   („We will name the competent enforcement body here once it has been determined.“) durch den
   deutschen Eigennamen (MLBF) plus kurze englische Funktionsbezeichnung („Market surveillance
   authority of the German federal states …“) mit denselben Kontaktdaten.
3. **Test-Vertrag (AK3):** `website/src/render.test.ts`, bestehender AK2-Test: de enthält den
   vollständigen MLBF-Namen und alle Kontaktdaten, en enthält „MLBF“ samt englischer
   Funktionsbezeichnung, beide die MLBF-Website; negativ darf keiner der beiden
   Platzhalter-Sätze mehr vorkommen.
4. **Umfang:** nur die beiden Platzhalter-Absätze; restliche Erklärung (de+en) bleibt
   unverändert.

## Test-Pflege

Grep nach beiden Platzhalter-Sätzen über `frontend/e2e/`, `website/src`, `website/e2e/`: der
alte Text steht nur in `website/src/accessibility.ts` selbst — kein fremder Test assertiert
den Platzhalter, keine Anpassung nötig.
