# Spec #2523 — Fürsorge-Texte und Begründungen mit Säulennamen in App-Sprache

## Ziel

`GET /scores/care-suggestions` (`saeuleName`) und `GET /next` (`reasons.balance.pillars`) lösen die
Sprache serverseitig aus `User.sprache` des eingeloggten Nutzers auf — nicht mehr allein am
`Accept-Language`-Header — und übersetzen unveränderte Seed-Säulennamen mit
`pillarTextIn(sprache, name)`. Heute tragen beide Endpunkte deutsche DB-Namen, wenn Browser-Sprache
und App-Sprache auseinanderfallen; künftig folgt der Name der App-Sprache.

## Voraussetzungen

- Eingeloggter Nutzer mit den fünf gesäten Standard-Säulen (deutsche Seed-Namen: Körper, Mentale
  Gesundheit, Beziehungen, Wirksamkeit, Sinn).
- App-Sprache via `PUT /care-config/sprache` (`de` | `en`); `User.sprache = null` verhält sich wie
  bisher `de` (`spracheVon`-Default).
- `pillarTextIn` übersetzt nur unveränderte Seed-Namen (de→en); eine umbenannte Säule bleibt, wie
  sie ist. Sprachraum bleibt `CARE_SPRACHEN`.

## Sprache-Auflösung (beide Endpunkte, einheitlich)

1. `?sprache=` — expliziter Override (z. B. Tests), unverändert zuerst.
2. `User.sprache` des eingeloggten Nutzers (Default `de` bei `null`).
3. `Accept-Language` — rutscht hinter `User.sprache`.
4. Ohne eingeloggten Nutzer (Pass-Through) bleibt das bisherige Header-Verhalten.

Die Namensübersetzung nutzt dieselbe Auflösung wie die Vorlagen-Texte der Route.

## Schritte und erwartetes Ergebnis

1. **AK1** — Nutzer mit App-Sprache `en`, Request ohne `Accept-Language` (auch: mit
   `Accept-Language: de`): `GET /scores/care-suggestions` liefert für unveränderte Seed-Säulen
   `saeuleName` englisch (`'Body'` statt `'Körper'`).
2. **AK2** — Nutzer mit App-Sprache `en`, Request ohne Header: `GET /next` liefert
   `reasons.balance.pillars` ohne deutsche Seed-Namen (`['Body']` statt `['Körper']`).
3. **Kohärenz (Randbedingung der Analyse)** — Nutzer mit App-Sprache `de` (Default) und
   `Accept-Language: en`: beide Endpunkte liefern die Säulennamen deutsch — die Middleware übersetzt
   die Namen nicht mehr gegen die App-Sprache. Andere Endpunkte (z. B. `GET /pillars`) bleiben
   unberührt; `translateMessages` läuft weiterhin.
4. **AK3** — Umbenannte Säule (DB-Name ≠ Seed-Name, z. B. `'Mein Körper'`), App-Sprache `en`:
   `saeuleName` und `reasons.balance.pillars` tragen den Namen wortgleich.
5. **AK4** — Fürsorge-Hinweis und Begründung für eine Nicht-Deutsch-Sprache: abgedeckt durch die
   Tests zu AK1 und AK2 (Sprache jeweils über `User.sprache` gesetzt, Request ohne en-Header);
   kein eigener Testfall (Dedup).

## Abgrenzung

- Kein Frontend-Change: die Rahmensätze (`care.deficit`, `dashboard:reasons.balance`) sind bereits
  lokalisiert und bekommen die Namen vom Server geliefert.
- Umbenennen/Löschen von Säulen bleibt gesperrt (#1573) — der umbenannte Zustand entsteht nur aus
  Alt-Beständen; Tests setzen ihn modellseitig (Legacy-Insert-Muster).
- `messagesEn.test.ts` (Middleware-Einheit) bleibt unverändert: die Middleware selbst arbeitet
  weiter, nur ihre Wirkung auf die beiden Endpunkte ändert sich.
