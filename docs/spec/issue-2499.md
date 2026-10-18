# Spec: Anmeldungen der Android-App in der Token-Verwaltung widerrufen (#2499)
(TF1–TF3) und `frontend/e2e/issue-1352-api-tokens.spec.ts` (TF4).

## Ziel

Die Token-Verwaltung (Einstellungen → „Zugriff", `ApiTokensSection`) zeigt unterhalb der
Access-Token-Liste einen eigenen Abschnitt „Angemeldete Geräte" mit allen Anmeldungen der
Android-App (`kind: 'app'`, Serververtrag aus #2494) und erlaubt deren Widerruf — dieselbe
zweistufige Bestätigung in der Zeile wie bei API-Tokens (`revokeId`-Muster). Reine
Frontend-Änderung: der Serververtrag (`GET /api/v1/api-tokens` mit `kind`, `DELETE
/api/v1/api-tokens/:id`) ist unverändert; der Widerruf ist serverseitig ein `revokedAt`-Setzen,
das Frontend ruft nur DELETE auf.

## UI-Vertrag (`frontend/src/components/ApiTokensSection.tsx`)

- Neuer Abschnitt unterhalb des Blocks „Vorhandene Access-Token" (innerhalb desselben
  `KolAccordion`), Überschrift `KolHeading` Level 3 mit Text **„Angemeldete Geräte"**
  (neuer i18n-Key `apiTokens.devicesHeading`), Container mit `data-testid="api-devices-section"`.
- Zeile je `kind === 'app'`-Token als `ul`/`li` wie die Nachbar-Liste
  (`data-testid="api-device-row"`, Liste `data-testid="api-devices-list"`), Inhalt: Token-Name
  plus Meta-Zeile mit denselben i18n-Keys wie die API-Zeilen — `apiTokens.created` („erstellt
  {{date}}") und `apiTokens.lastUsed` („zuletzt genutzt {{date}}") bzw. `apiTokens.notUsed`
  („noch nicht genutzt"), Formatierung über das vorhandene `formatDate`. **Kein** Scope-Schalter,
  kein Feature-Popover, kein PATCH.
- Widerruf wie die Nachbar-Zeile (AK2): Klick auf „Widerrufen“ (Key `apiTokens.deviceRevoke`)
  ersetzt die Aktion in der Zeile durch den `api-tokens__confirm`-Block mit der
  Bestätigungsfrage **„Gerät „{{name}}" wirklich abmelden?"** (neuer Key
  `apiTokens.deviceRevokeQuestion` — die Frage nennt das Gerät, UX-Beratung) plus
  „Abbrechen" (`common:actions.cancel`) und „Endgültig zurückziehen" (`apiTokens.revokeConfirm`,
  `data-testid="api-device-revoke-confirm"`). Eigener State (`deviceRevokeId`), getrennt vom
  `revokeId` der API-Tokens; bestehende `busy`/`error`-Muster werden weiterverwendet.
  - Abbrechen → kein API-Aufruf, Zeile zurück zum „Widerrufen"-Zustand.
  - Bestätigen → `api.deleteApiToken({ id })`, danach verschwindet die Zeile; fällt der Abschnitt
    dadurch auf null Geräte, zeigt er den Leerzustand.
- Leerzustand (AK3): keine `kind === 'app'`-Tokens → Text **„Keine angemeldeten Geräte."**
  (neuer Key `apiTokens.devicesEmpty`) statt leerer `ul` — kein `api-devices-list`-Element.
- API-Token-Liste bleibt unverändert: Filter `token.kind !== 'app'` besteht, App-Tokens tauchen
  dort nicht auf.

## Testfälle (Vertrag)

| TF  | AK  | Ort/Stufe      | Verhalten                                                                                                                                                                     |
| --- | --- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TF1 | AK1 | Vitest Unit    | Liste mit API- und App-Token → Abschnitt „Angemeldete Geräte" zeigt Geräte-Zeile (Name, erstellt/zuletzt genutzt, ohne Scope-Schalter); API-Liste bleibt frei von App-Zeilen. |
| TF2 | AK2 | Vitest Unit    | Widerrufen → Frage nennt Gerät; Abbrechen → kein DELETE; Bestätigen → `deleteApiToken({id})`, Zeile weg, Abschnitt im Leerzustand.                                            |
| TF3 | AK3 | Vitest Unit    | Liste ohne App-Token → Leerzustandstext, keine (leere) Liste.                                                                                                                 |
| TF4 | AK4 | Playwright e2e | 375 px: Widerrufen-Button einer Geräte-Zeile ≥ 44 px hoch, `x + width ≤ 375` (Bounding-Box, nichts geclippt).                                                                 |

- TF4 mockt `GET /api/v1/api-tokens` gezielt per `page.route`: ein `kind: 'app'`-Token entsteht
  nur im nativen Android-Login (Google-ID-Token-Flow) und ist im E2E nicht herstellbar.
- Rote Zustände: TF1–TF3 scheitern an den fehlenden Selektoren/Texten des neuen Abschnitts
  (Assertion, kein Importfehler — `deleteApiToken`/`ApiToken.kind` existieren bereits); TF4
  scheitert an `api-devices-section` not visible.

## Abgrenzung

- Kein Server-Code, keine DTO-Änderung, keine Änderung an Anlegen/Umschalten der API-Tokens.
- Fehler beim Widerruf laufen über das geteilte `error`-Muster (`KolAlert _type="error"`) wie die
  Nachbar-Aktionen; separater Test nicht nötig (gleiches Muster, bereits durch #1352-Tests
  abgesichert).
