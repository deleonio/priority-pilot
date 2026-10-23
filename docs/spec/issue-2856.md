# Spec: Issue 2856 — Tipps-Hinweis „Funktionen, die zu dir passen“ (push-konzept.md §8)

Free-Nutzer mit Opt-in erhalten höchstens alle 30 Tage genau einen Push-Hinweis auf
Plus-/Pro-Funktionen (Ortserinnerungen oder Gruppen-Aufgaben), Tap-Ziel `/settings/pakete`.
Sweep `runTipPush(now, send)` nach Muster `aboPush.ts` / `monthlyRecapPush.ts`, Versand über
`sendDedupedPush` (Budget-Tor + Gruppen-Tag inklusive).

## Vertrag (von den Tests fixiert, Impl-Phase)

- `server/src/logics/tipPush.ts` (neu) exportiert `TIP_PUSH_KIND = 'tip-push'`, `TIP_PUSH_TEXTE`
  (Kinds `ort` und `gruppe`, je de/en mit `{ title, body }`) und
  `runTipPush(now?, send?) => { sends }`.
- Ruhezeit 21–7 Ortszeit: Skip ohne Log-Eintrag (Muster `aboPush`, sonst frisst die Dedupe die
  Nachholung).
- 30-Tage-Fenster-Gate: kein Versand, wenn für `TIP_PUSH_KIND` + userId bereits ein
  NotificationLog-Eintrag mit `sentAt >= now − 30 Tage` existiert; der DedupeKey bekommt einen
  Zeitbezug (nie statisch — sonst wird aus „höchstens alle 30 Tage“ „einmal jemals“).
- Ort-Signal: mindestens 3 Tasks mit `latitude != null` („Aufgaben mit Ort“ = Koordinaten gesetzt,
  Freitext-Adressen zählen nicht).
- Gruppen-Signal: mindestens 3 Tasks mit `createdById = Nutzer` UND (`userId != Nutzer` ODER
  `groupId != null`).
- Beide Signale gleichzeitig → genau ein Push, Ortserinnerungen zuerst.

## Akzeptanzkriterien → Tests

| AK  | Vertrag                                                                                                                                                                 | Test                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| AK1 | Ohne `tipPushEnabled=true`, mit Plan plus/pro oder Konto < 7 Tage → 0 sends, 0 Logs                                                                                     | `server/src/logics/tipPush.test.ts`                                                          |
| AK2 | Free + Opt-in + 3 Orts-Aufgaben → genau 1 Hinweis, `payload.url = /settings/pakete`, Zweitlauf 0                                                                        | dito                                                                                         |
| AK3 | 3 fremd-angelegte Aufgaben → genau 1 Gruppen-Hinweis; Doppel-Signal → genau 1 (Ort-Text)                                                                                | dito                                                                                         |
| AK4 | Nach Zustellung: +29 Tage → 0, +31 Tage → 1 (NotificationLog-Fensterabfrage)                                                                                            | dito                                                                                         |
| AK5 | Registrierung in `VORRANG` (unterste Stufe, nach `monthly-recap`) + `TAGS` → `pp-tipps`; erschöpftes Tagesbudget verdrängt (0 sends, kein Fach-Log, kein Budget-Marker) | `pushBudget.test.ts` (Registrierung) + `tipPush.test.ts` (Verdrängung)                       |
| AK6 | `tipsHint` nennt die Frequenz — de enthält „Höchstens einmal im Monat“, en „At most once a month“; gerendert als `_hint` des Schalters „Tipps und Angebote“             | `frontend/src/components/SettingsPage.test.tsx`                                              |
| AK7 | Rechts-Team-Freigabe (Einwilligungstext, Trennung)                                                                                                                      | Prozess-Kriterium, Kommentar im Issue — kein Code-Test (Livegang-Gate; Schalter-Default aus) |

## Annahmen

- Kind-Name `tip-push` und Textexport `TIP_PUSH_TEXTE.ort|gruppe` sind Vertrag (Analysen nannten
  nur den Tag `pp-tipps`; der Name braucht eine feste Referenz für VORRANG/TAGS-Tests).
- AK6-Wortlaut folgt push-konzept.md §8 („Höchstens einmal im Monat …“); de/en sind aktuell die
  einzigen tipsHint-Sprachdateien.
