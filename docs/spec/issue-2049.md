# Spec: Issue #2049 — Gekündigtes Abo mit Restlaufzeit weiterführen/upgraden

## Ziel

Ein gekündigtes Abo (`status:'cancelled'`, `currentPeriodEnd > now`) gilt als laufendes Abo: Upgrade
(sofort, anteilig verrechnet), Weiterführen (gleiches Paket) und Downgrade sind möglich — ohne zweites
sofort abbuchendes Abo und ohne Fall-zu-Free-Lücke.

## Vorbedingungen

- Nutzer mit Subscription-Row `status:'cancelled'`, `currentPeriodEnd` in der Zukunft.
- 409-Duplikat-Guard gegen OPEN-Rows bleibt unverändert.

## Schritte und erwartetes Ergebnis

1. **Lookup (AK1):** `/change` und `/change/preview` finden das gekündigte Abo mit Restlaufzeit als
   aktuelles Abo; 404 nur, wenn überhaupt kein laufendes Abo existiert.
2. **Upgrade (AK2):** `POST /change` auf Pro liefert eine Zustimmungs-URL; erster Zyklus = neuer Preis
   − Restguthaben (gleiche `upgradeProration`-Rechnung wie beim aktiven Abo, `prorateUpgrade`).
3. **Weiterführen (AK3):** Anlage über `POST /billing/subscriptions` bei vorhandenem gekündigtem
   Laufzeit-Abo läuft mit `start_time = currentPeriodEnd` — erste Abbuchung erst zum Periodenende,
   kein sofortiger Einzug (`firstCycleCents` unverwendet). Buchung mit bestehender OPEN-Row bleibt 409.
4. **Downgrade (AK4):** `POST /change` auf ein niedrigeres Paket legt ebenfalls ein neues Abo mit
   Start am Periodenende an (kein `revise` auf der gekündigten Zeile).
5. **Vorgänger aufräumen (AK5):** Nach `BILLING.SUBSCRIPTION.ACTIVATED` des Nachfolge-Abos wird
   `pendingPlan`/`pendingPlanEffectiveAt` auch der gekündigten Vorgänger-Zeile geleert — der geplante
   Fall auf Free entfällt (auch für `applyDuePendingPlan`).
6. **Vorschau (AK6):** `/change/preview` liefert in allen drei Fällen Betrag (`dueCents`) und
   Startzeitpunkt (`startsAt`, ISO): Upgrade = sofort (jetzt), Weiterführen/Downgrade =
   `currentPeriodEnd`. Die Oberfläche zeigt beides (UI-Tests folgen in der Umsetzung).
7. **Oberfläche (AK7/AK8):** `locallyCancelled` wird nach bestätigtem neuem Abo zurückgesetzt
   (Hinweis verschwindet ohne Neuladen); Zustand bei 375 px voll bedienbar. Frontend-Tests und
   E2E (TF6-UI/TF7/TF8) folgen in der Umsetzungsphase — in dieser Spec-Phase nur serverseitige
   rote Tests.

## Abgrenzung

- Webhook-Guards und Verhalten aktiver Abos bleiben unverändert.
- Keine neue Komponente/kein neuer Mechanismus: Weiterführen ist ein Fall am bestehenden
  `POST /billing/subscriptions`, kein eigener Endpoint.
