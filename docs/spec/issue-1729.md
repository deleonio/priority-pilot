# Spec #1729 — Persistenter Bestätigungs-Dialog „Säulenverteilung neu berechnen"

## Ziel

Die zweistufige Bestätigung (Absicht → KI-Kosten) der Säulenverteilungs-Neuberechnung in
`AdminUsersSection` läuft in EINEM persistenten `Modal` (Muster `GroupDeleteDialog.tsx:56-67`):
Der Schrittwechsel `intent` → `costs` tauscht nur die Kinder des Modals, ohne die Dialog-Instanz
auszuhängen und neu einzuhängen. Das beseitigt den `InvalidStateError: … not in a Document`, der
entsteht, wenn der Mount-Effekt des Nachfolge-Dialogs `showModal()` vor dem Document-Einhängen
aufruft. `Modal.tsx` selbst wird nicht umgebaut (viele weitere Consumer), nur die Verwendung in
`AdminUsersSection` wechselt auf das persistente Muster.

## Vorbedingungen

- Admin ist angemeldet, Tab „Nutzerverwaltung“ geöffnet (`/app/settings/nutzer`).
- Batch-Lauf läuft nicht (`running === false`).

## Ablauf & erwartetes Ergebnis

1. Klick auf „Säulenverteilung aller Aufgaben neu berechnen“ öffnet den Intent-Dialog
   („Sollen die Säulen-Beiträge …“).
2. Klick auf „Weiter“:
   - Der Kosten-Dialog („KI-Kosten bestätigen“) ist sofort offen und bedienbar, der
     Intent-Inhalt ist weg (AK2).
   - Die Modal-Instanz wird dabei NICHT neu gemountet — derselbe Dialog-DOM-Knoten bleibt
     bestehen (AK1; Unit-Test sichert die DOM-Knoten-Identität über den Schrittwechsel).
   - In der Browser-Konsole tritt kein `pageerror` — insbesondere kein `InvalidStateError` zu
     `showModal` — auf (AK2/AK4; E2E-Negativkontrolle nach Muster `quick-capture.spec.ts`).
3. Bestehendes Verhalten unverändert: Abbrechen im Intent- und im Kosten-Schritt ohne
   API-Aufruf, Batch-Start erst nach beiden Bestätigungen (Antwort 202), Fehlerfall schließt
   beide Schritte — die Bestands-Unit-Tests bleiben unverändert grün (AK3).
4. Die E2E bei 375px bleibt stabil, auch unter `--repeat-each=10` (AK4; der
   Stabilitätsnachweis obliegt der Impl-Phase, die Spec legt die pageerror-Assertion als
   Vertrag an).
