# Spec — Issue #1391: Aufgaben-Ersteller per Push und Toast benachrichtigen

Vertrag für `notifyTaskCompleted` (neues Modul `server/src/logics/taskCompletedNotification.ts`),
den Aufruf im `PATCH /tasks/:id`-Handler und die neue Frontend-Komponente `PushToast`. Quelle:
KI-ANALYSE- und KI-UX-Block im Harness-Kommentar von Issue #1391 (AK1–AK6).

## Ziel

Setzt Konto B den Status einer von Konto A für B angelegten Aufgabe erstmals auf `Done`, erhält A
genau eine Web-Push-Nachricht mit Aufgabentitel und Bs Anzeigenamen. Ist bei A mindestens ein
App-Fenster geöffnet, zeigt es zusätzlich einen schließbaren In-App-Hinweis mit demselben Text.
Selbst-Anlagen (`createdById == null` oder `createdById === userId`) lösen nichts aus. Der Versand
läuft — wie `notifyTaskCreated` (#1224) und `notifyReachedMilestones` (#1363) — nach dem Commit,
dedupliziert über eine eigene `NotificationLog`-`kind`, und darf den PATCH nicht beeinflussen.

## Vertrag `notifyTaskCompleted`

```
notifyTaskCompleted(task: {id, title, createdById}, completer: {displayName} | null, send?: PushSender): Promise<void>
```

- Eigene `kind` `'task-completed'`, `dedupeKey` = Task-Id.
- Versand über `sendPushToUser(task.createdById, payload, send)`; Payload nennt `task.title` und
  `completer.displayName`.
- `NotificationLog.create` nur bei `sent > 0` (Vorbild #1224/#1363 — kein Versand an 0
  Subscriptions sperrt den Task sonst dauerhaft).
- Aufrufer entscheidet über den Aufruf selbst, ob es sich um einen echten Fremd-Abschluss handelt
  (Selbst-Anlage ruft die Funktion gar nicht auf) — analog zu `notifyTaskCreated`.

## Server-Verdrahtung (`PATCH /tasks/:id`)

- Aufruf **nach** dem Transaktions-Commit, in eigenem `try/catch` (Versandfehler bleiben folgenlos
  für die Antwort — Vorbild #1363-Block in `tasks.ts`).
- Bedingung: echter Übergang auf `Done` (`!warVorherDone && attrs.status === 'Done'`), **und**
  `task.createdById != null`, **und** `task.createdById !== task.userId`. Bei einer gleichzeitigen
  Übergabe (`recipientId !== null`) entfällt der Aufruf (kein eigener „Done"-Verdienst).

## Frontend: `PushToast`

- Neue Komponente `frontend/src/components/PushToast.tsx`, gemountet neben `<UpdatePrompt />`
  (`frontend/src/App.tsx:1121`).
- Hört auf `navigator.serviceWorker`-`message`-Events mit `data.type === 'push'`; zeigt bei
  `data.payload.title`/`data.payload.body` einen schließbaren Hinweis (`KolAlert`, `_variant="card"`,
  `_type="success"`, `_hasCloser`, `_alert={true}` — KI-UX-Block).
- Schließen ausschließlich über die eingebaute Schaltfläche; kein Auto-Dismiss-Timer.
- Der Service Worker (`frontend/public/push-sw.js`) sendet die Payload zusätzlich zur System-
  Notification per `client.postMessage({ type: 'push', payload })` an alle offenen Fenster-Clients.
- DOM-Kontrakt (für Tests): äußerer Container `data-testid="push-toast"`, Schließen-Schaltfläche
  `data-testid="push-toast-close"`. Nach dem Schließen verschwindet der Container komplett (kein
  `display:none`-Rest im DOM), damit AK2 „danach verschwunden" eindeutig prüfbar ist.

## Precondition / Steps / Expected result

**AK1 — Push an den Ersteller**
Vorbedingung: A legt eine Aufgabe für B an (gemeinsame Gruppe), A hat Push-Subscriptions.
Schritt: B setzt per `PATCH /tasks/:id` `status: 'Done'`.
Erwartung: je Abo von A genau ein Versand; Payload nennt Aufgabentitel und Bs Anzeigenamen.

**AK2 — In-App-Hinweis bei offenem Fenster**
Vorbedingung: App-Fenster bei A geöffnet, Service Worker sendet eine `message`-Event-Payload.
Schritt: `postMessage({type: 'push', payload: {title, body}})` auf `navigator.serviceWorker`.
Erwartung: Hinweis mit Titel und Text sichtbar; Klick auf Schließen entfernt ihn.

**AK3 — Selbst-Anlage / kein Ersteller**
Vorbedingung: B erledigt eine selbst angelegte Aufgabe (`createdById === userId` oder `null`).
Erwartung: kein Versand, keine `NotificationLog`-Zeile.

**AK4 — Dedupe je Aufgabe**
Vorbedingung: Aufgabe bereits einmal auf `Done` gesetzt (Nachricht bereits verschickt).
Schritt: erneutes `Done`-Patchen, sowie Wiedereröffnen (`Open`) und erneutes Erledigen.
Erwartung: weiterhin genau ein Versand, genau eine `NotificationLog`-Zeile.

**AK5 — Push-Fehler bricht den PATCH nicht**
Vorbedingung: injizierter `PushSender` wirft.
Erwartung: PATCH bleibt `200`, aktualisierter Task in der Antwort, keine `NotificationLog`-Zeile.

**AK6 — Mobile-First (375px)**
Vorbedingung: Hinweis sichtbar bei 375px-Viewport.
Erwartung: Bounding-Box vollständig im Viewport, Schließen-Schaltfläche ≥ 44×44px, Hauptnavigation
nicht dauerhaft verdeckt.

## Testfälle

- TF1 (AK1), TF3 (AK3), TF4 (AK4), TF5 (AK5): API-Tests in
  `server/src/express/tasks-completed-notification.test.ts` (Vorbild `tasks-created-notification.test.ts`).
- TF2 (AK2): Vitest-Unit in `frontend/src/components/PushToast.test.tsx` (Service-Worker-`message`-
  Stub, Vorbild `UpdatePrompt.test.tsx`).
- TF6 (AK6): E2E in `frontend/e2e/issue-1391-completion-toast.spec.ts` (Stil `pwa-update-prompt.spec.ts`
  — echtes `navigator.serviceWorker.dispatchEvent`, kein Stellvertreter-Proxy nötig, da `PushToast`
  unbedingt gemountet ist und nicht an einen SW-Lebenszyklus hängt).
