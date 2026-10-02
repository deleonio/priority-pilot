# Spec: Fürsorge-Hinweis mehrsprachig (#2063)

## Ziel

Der Fürsorge-Hinweis (`CareHint`) erscheint in der eingestellten App-Sprache. Deutsch bleibt
wortgleich (bestehende Tests/E2E laufen unangetastet), Englisch kommt als vollständig übersetzte
Sprache hinzu; die übrigen acht Locale-Verzeichnisse führen dieselben Schlüssel mit deutschen
Platzhalterwerten (nur für den Schlüssel-Gleichstand in `locales.test.ts`).

## Vorbedingungen

- App-Sprache ist über die Einstellungen umschaltbar (`getByLabel('Sprache')`, Endonym „English“;
  Muster #1879). i18n läuft echt (`vitest.setup.ts` pinnt Unit-Tests auf `de`).
- Server-Daten (Säulename, Titel, Beschreibung aus `GET /scores/care-suggestions`) bleiben
  dynamisch per Interpolation und werden **nicht** übersetzt — sie erscheinen in jeder Sprache
  wortgleich (deutsche Server-Templates).
- Krisenhinweis: TelefonSeelsorge-Nummer (`tel:08001110111`) und Linktext
  „TelefonSeelsorge: 0800 111 0 111“ bleiben in beiden Sprachen wortgleich; nur die Sätze darum
  werden übersetzt (Ton: `docs/fuersorge-tonalitaet.md`, dort existiert eine Englisch-Tabelle).

## Textvertrag

Die deutschen Texte sind die heutigen, hartkodierten Werte (`CareHint.tsx`) und bleiben wortgleich.
Die englischen Texte sind die Vertragsformulierungen dieser Spec (Impl-Phase darf nach
`docs/fuersorge-tonalitaet.md` abweichen → dann Test-Pflege mit Begründung im PR).

| Stelle                       | Deutsch (wortgleich)                                                              | Englisch (Vertrag)                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Label (aria-label, KolAlert) | Fürsorge-Hinweis                                                                  | Care hint                                                                          |
| KI-Kennzeichnung             | KI-Vorschlag                                                                      | AI suggestion                                                                      |
| Rahmung Defizit              | `{{saeuleName}}` kam diese Woche zu kurz. `{{titel}}`?                            | `{{saeuleName}}` could use some care this week. `{{titel}}`?                       |
| Rahmung Überlast             | Du hast zuletzt viel geleistet. Ein Ausgleich darf heute sein: `{{beschreibung}}` | You have given a lot lately. Taking it easier today is allowed: `{{beschreibung}}` |
| Leerzustand                  | Gerade gibt es keinen Vorschlag für dich. Mach in deinem Tempo weiter.            | There is no suggestion for you right now. Keep going at your own pace.             |
| Knopf 1                      | Vorschlag übernehmen                                                              | Accept suggestion                                                                  |
| Knopf 2                      | Nicht jetzt                                                                       | Not now                                                                            |
| Knopf 3                      | Vorschlag ablehnen                                                                | Dismiss suggestion                                                                 |
| Fehlermeldung                | Konnte nicht angelegt werden. Versuch es gleich noch einmal.                      | Could not be created. Please try again in a moment.                                |
| Krisenhinweis (vorm Link)    | Kein Ersatz für ärztlichen Rat. In einer Krise erreichst du die                   | Not a substitute for medical advice. In a crisis, you can reach the                |
| Krisenhinweis (Linktext)     | TelefonSeelsorge: 0800 111 0 111 (wortgleich, `tel:08001110111`)                  | TelefonSeelsorge: 0800 111 0 111 (wortgleich, `tel:08001110111`)                   |
| Krisenhinweis (nach Link)    | (kostenfrei, rund um die Uhr).                                                    | (free, around the clock).                                                          |

## Ablauf / Erwartetes Ergebnis

1. Nutzer mit defizitären Säulen öffnet das Dashboard → Fürsorge-Hinweis erscheint auf Deutsch
   wie heute (AK4: bestehende de-Tests/Specs bleiben grün).
2. Nutzer stellt in den Einstellungen die Sprache auf Englisch → der Hinweis zeigt Label, Knöpfe,
   Rahmungstexte, Leerzustand, Fehlermeldung und KI-Kennzeichnung auf Englisch; Säulenname, Titel
   und Beschreibung aus dem Server bleiben wortgleich (AK2).
3. In beiden Sprachen ist der Krisenhinweis vollständig: Rahmesätze übersetzt, Nummer und
   klickbarer `tel:`-Link wortgleich (AK5).
4. Alle zehn Locale-Verzeichnisse führen dieselben Schlüssel (`locales.test.ts`, AK3 — bestehender
   Test deckt das ab, kein neuer Test).
5. Bei 375 px Viewport läuft der englische Hinweis nicht über den Viewport (AK2, e2e).

## Testabdeckung

- AK1 (keine hartkodierten nutzer-lesbaren Strings): kein eigener Test — String-Match gegen den
  Quelltext wäre ein Change-Detector ohne Zähne; funktional abgesichert durch AK2/AK4.
- AK2 Unit: 4 neue Vitest-Tests in `frontend/src/components/CareHint.test.tsx` (Sprache `en`).
- AK2 E2E + AK5: neu `frontend/e2e/issue-2063-care-hint-i18n.spec.ts` (Sprachwechsel, Krisenhinweis,
  375-px-Bounding-Box).
- AK3: bestehend `frontend/src/i18n/locales.test.ts` (Dedup — kein Duplikat).
- AK4: bestehende Suiten unangetastet (Constraint, kein Test).
