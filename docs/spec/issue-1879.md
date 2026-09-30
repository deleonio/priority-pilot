# Spec: App-Sprache für den Fürsorge-Push (#1879)

## Ziel

Der Fürsorge-Push (#1794) kommt in der zuletzt in der App aktiven Sprache des Nutzers. Ohne bekannte oder mit ungültiger Sprache bleibt es bei Deutsch.

## Vertrag

- `User.sprache` (string, nullable, Default `null`); Migration nach Muster `zeitzone` (#1794).
- `PUT /care-config/sprache` mit `{ sprache }` (eigener Account, `careConfigRouter`): Wert muss in `CARE_SPRACHEN` liegen, sonst `400` ohne Persistenz; ohne Session `401`. `GET/PUT /care-config` bleiben unverändert.
- `runCarePush` nutzt `user.sprache`, wenn gültiger `CareSprache`-Wert, sonst `'de'` (ersetzt die Konstante `PUSH_SPRACHE`).
- Frontend: die aktive Sprache (`i18n.resolvedLanguage`) geht beim App-Start und bei jedem `languageChanged` per `PUT /care-config/sprache` an den Server (fire-and-forget, Fehler still). Kein sichtbares UI.

## AK → Testfälle

| AK  | Test                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | `carePush.test.ts` — Sprache `en`/`fr` → Push-Titel = `pushTextFuer('defizit', 1, <sprache>).titel`, verschieden vom deutschen                 |
| AK2 | `care-config.test.ts` — PUT `en` dann `fr` → 200, Spalte `fr`; `carePush.test.ts` deckt den Push in `fr`                                       |
| AK3 | `carePush.test.ts` — `sprache = null` → Deutsch                                                                                                |
| AK4 | `care-config.test.ts` — `'xx'`, `''`, `'de-DE'`, Zahl, fehlendes Feld → 400, Spalte unverändert; `carePush.test.ts` — DB-Wert `'xx'` → Deutsch |
| AK5 | `frontend/e2e/issue-1879-push-sprache.spec.ts` — Sprachwechsel in den Einstellungen → `PUT /care-config/sprache` mit `{ sprache: 'en' }`       |
