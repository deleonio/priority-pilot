# Spec: Nutzersuche ohne fremde E-Mail-Adressen und mit Treffergrenze (#2539)

Status: rot (Spec-Phase) — Tests in `server/src/express/users-search.test.ts` (Erweiterung zu #1212,
siehe [issue-1212.md](issue-1212.md)).

## Ziel

`GET /users/search` bleibt im DTO `{id, displayName}`, liefert aber im Namens-Pfad nie eine fremde
E-Mail-Adresse, behandelt `%`/`_` im Suchtext literal und begrenzt die Trefferzahl.

## Regeln

1. **Namens-Pfad ohne E-Mail (AK1):** Kein Treffer einer Teilsuche (Suchtext ohne `@`) hat eine
   E-Mail-Adresse als `displayName`. Der Fallback `displayName ?? email` gilt nur bei exakt
   vollständiger E-Mail-Eingabe.
2. **Literale Wildcards (AK2):** `%`, `_` und `\` im Suchtext werden escaped (LIKE mit `ESCAPE`).
   `100%` trifft nur Namen mit „100%“, `ob_a` nur „Bob_a“ (nicht „Bobxa“), `%%%`/`___` treffen nur
   Namen, die diese Zeichen literal enthalten.
3. **Treffergrenze (AK3):** Höchstens 10 Treffer (`SEARCH_LIMIT`, Annahme der Analyse).

## Unverändert

Auth (401), 200 mit `[]` bei <3 Zeichen/ohne Treffer, Exact-E-Mail-Suche (case-insensitiv).
