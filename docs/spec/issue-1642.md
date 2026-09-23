# Issue #1642 — Säulen-Neuberechnung als Server-Hintergrundlauf

## Ziel

`POST /tasks/reassign-pillars` (und das Admin-Pendant `POST /admin/tasks/reassign-pillars`) starten
den Lauf serverseitig und antworten, **bevor** alle Aufgaben verarbeitet sind. Der Server verarbeitet
im Hintergrund bis zum Ende (oder bis das KI-Kontingent ausgeht), ohne dass der Client weitere
Portionen anfordern muss. Das Frontend (`useReassignRun`) pollt nur noch den Status, statt die
Portionsschleife selbst zu treiben — Schließen/Navigieren bricht den Lauf nicht mehr ab.

## Vertrag (Status-DTO, Erweiterung von `OwnReassignPillarsStatus`)

`GET /tasks/reassign-pillars/status` (und `GET /admin/tasks/reassign-pillars/status`) liefert
zusätzlich zu `startedAt`/`total`/`pending`:

- `running: boolean` — `true`, solange ein Hintergrundlauf dieses Kontos (bzw. des Admin-Batches)
  unterwegs ist.
- Während `running: true`: `processed: number` — in diesem Lauf bereits abgeschlossene Aufgaben
  (`updated + failed + skipped`), als Fortschrittsangabe neben `total`.
- Nach Lauf-Ende (`running: false`, sofern der Prozess seit dem letzten Start nicht neu gestartet
  wurde): `result` mit `updated`, `failed`, `skipped`, `quotaExhausted` und optional
  `failureReasons` — das bisherige synchrone POST-Ergebnis, jetzt am Status statt an der Response.

## Vertrag (POST)

`POST /tasks/reassign-pillars` bzw. `.../admin/tasks/reassign-pillars` validiert wie bisher
(Query-Parameter, Kontingent-Vorprüfung, Sperre) und antwortet **sofort** nach dem erfolgreichen
Start, ohne auf das Ende des Laufs zu warten (Response-Body meldet lediglich den Start — Details
kommen über den Status-Endpunkt). Die Sperre (`reassignLock`) wird weiterhin beim Start belegt,
aber jetzt erst im Hintergrundlauf selbst — bei dessen Ende, Fehler oder Kontingent-Erschöpfung —
wieder freigegeben, nicht mehr beim Antworten der Anfrage. Ein zweiter Start während eines laufenden
Hintergrundlaufs bleibt mit 409 gesperrt.

## Akzeptanzkriterien → Tests

- **AK1/AK2** (`server/src/express/routes/reassign-own-pillars.test.ts`, Describe „Hintergrundlauf
  (#1642)"): POST antwortet, während ein Klassifikator-Aufruf noch blockiert (`gate`); GET status
  meldet in der Zwischenzeit `running: true` mit Fortschritt, nach Freigabe `running: false` mit
  vollständigem `result`.
- **AK3**: bereits durch den bestehenden Test „weist einen zweiten, gleichzeitigen Lauf desselben
  Kontos mit 409 ab" abgedeckt (Sperre hält bis zur Freigabe des Gates); neu ergänzt: nach Lauf-Ende
  ist ein erneuter Start wieder möglich.
- **AK4**: Kontingent-Erschöpfung (seed `AiUsage`) beendet den Hintergrundlauf; Status zeigt danach
  `running: false` mit Teilfortschritt in `result` (`quotaExhausted: true`).
- **AK5** (`server/src/express/routes/reassign-pillars.test.ts`): Admin-Pendant zu AK1/AK2, analoge
  Assertions auf `/admin/tasks/reassign-pillars` + `/status`.
- **AK6** (`frontend/src/lib/useReassignRun.test.ts`, neu): Unmount während `running` löst keinen
  weiteren Start-Aufruf aus; Mount mit bereits laufendem Hintergrundlauf pollt den Status automatisch
  bis `running: false`, ohne dass ein Start nötig ist.
- **AK7** (`frontend/e2e/pillar-recalc.spec.ts`, neuer Test): Modal schließen während des Laufs und
  wieder öffnen zeigt Fortschritt/Ergebnis ohne Klick, kein Start-/Fortsetzen-/Neustart-Button
  während `running`.
- **AK8**: bewusst kein eigener Test (siehe „Test-Pflege-Bedarf" unten) — die Laufanzeige nutzt
  dieselbe Markup-/CSS-Struktur wie im bestehenden #1614-Flow, ein reiner Layout-Test dagegen wäre
  heute schon grün.

## Test-Pflege-Bedarf (nicht in dieser Spec-Runde geändert)

Die bestehenden E2E-Tests in `pillar-recalc.spec.ts` („Fortschritt, Fehlergründe und Fortsetzen")
modellieren den bisherigen, client-getriebenen Portions-Mock (`installFakeServer`, Assertion
„in Portionen, nicht in einem Request" über mehrere POST-Aufrufe). Sobald AK6 umgesetzt ist, sendet
der Client nur noch **einen** Start-POST je Lauf — die Portionszählung dieser bestehenden Tests
widerspricht dann dem neuen Vertrag und muss in der Implementierungsphase auf das
Hintergrundlauf-Mock (`running`/`processed`) umgestellt werden.
