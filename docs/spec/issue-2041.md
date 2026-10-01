# Server: Zugangs-Mails je Nutzer drosseln

**Stand:** 2026-10-01

## Ziel

Ein Nutzer kann über Einladung und Delegation beliebig viele Zugangs-Mails (#1983) an fremde Adressen auslösen. Der Server begrenzt das je auslösendem Nutzer auf `ACCESS_MAIL_DAILY_LIMIT` (= 10) Mails in einem gleitenden 24-h-Fenster. Der Zähler liegt im Speicher (`server/src/logics/accessMail.ts`), kein neues Datenmodell; ein Neustart setzt ihn zurück.

## Ablauf

1. Eine Zugangs-Mail entsteht nur, wenn die Zieladresse noch kein Konto hatte: `POST /groups/{id}/invitations` (E-Mail), `POST /tasks` und `PATCH /tasks/{id}` mit `recipientEmail`. Alle drei Wege teilen sich **einen** Zähler je Nutzer.
2. Vor dem Versand fragt die Aufrufstelle einen Slot an. Frei: Mail geht raus, der Slot zählt. Voll: **keine** Mail.
3. Die Aktion selbst gelingt unverändert (Einladung 201, Task 201/200, Adresse freigeschaltet mit Herkunft `einladung`/`delegation`).
4. Bei gedrosselter Mail trägt die Antwort `accessMailThrottled: true` (Einladungs-DTO, Task-DTO). Ohne Drosselung fehlt das Feld.
5. Adressen mit bestehendem Konto lösen keine Zugangs-Mail aus, verbrauchen keinen Slot und bekommen nie das Feld.
6. Der Zähler gilt je `user.id` und auch im Testbetrieb.

## Erwartetes Ergebnis

Ab der 11. Zugangs-Mail innerhalb von 24 h löst derselbe Nutzer keine Mail mehr aus; ein anderer Nutzer ist unberührt.
