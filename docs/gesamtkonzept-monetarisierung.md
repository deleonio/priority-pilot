# Gesamtkonzept: Pakete und Monetarisierung

Stand: 14.09.2026. Grundlagen sind die Arbeitspapiere „philosophischer-anker-priority-pilot" und „priority-planner-pakete" (Fassung mit der Ergänzung zu kontextuellen Upgrade-Angeboten) sowie eine Code-Prüfung des Repos vom 12./13.09.2026. Das Konzept beschreibt Zielbild und Architektur der Monetarisierungsschicht und zerlegt sie in neun Teilaufgaben, angelegt als Epic #1455 mit Sub-Issues im Muster von Epic #1340.

Die Teilaufgaben wurden am 14.09.2026 gegen den Code nachgeschärft: korrigierte Dateipfade, der Fehlervertrag und der Rollout-Schalter nach vorn in T1 gezogen, T2/T4/T5 aus der seriellen Kette gelöst, T3 in Muster (T3a) und Ausrollen (T3b) geteilt.

## Leitbild: Fürsorge statt Protokoll

priority-pilot soll sich nicht wie ein Buchhaltungstool für Aufgaben anfühlen. Apps dieser Gattung verlieren nach wenigen Wochen Nutzer, weil sie nur spiegeln: Man trägt ein, bekommt eine Visualisierung, sonst nichts. Der Bindungsfaktor ist die Fürsorgefunktion. Die App erkennt, welche Säule zu kurz kommt, und schlägt von sich aus die nächste sinnvolle Aufgabe vor. Das Nutzungsgefühl soll „die App kümmert sich um mich" sein, nicht „ich pflege eine Tabelle".

Leitfrage für jede Feature-Entscheidung:

> Macht das die App zu einem passiveren Protokoll, oder stärkt es die aktive Fürsorge-Funktion?

Für die Monetarisierung folgen daraus vier Regeln:

1. Der regelbasierte Fürsorge-Kern bleibt in jedem Paket erhalten, auch in Free: nächste Aufgabe vorschlagen (`GET /next`, `GET /suggestions`), Balance-Stand je Säule, Punkte und Streaks. Bindung entsteht vor dem Kauf; die Pakete unterscheiden Umfang und Werkzeuge, nicht das Grundgefühl.
2. Die KI-gestützte Beratung (Freitext-Verarbeitung, Säulen-Vorschlag, Lektorat, Aktivitäten-Berater) ist der kostenwirksame Teil der Fürsorge und läuft über monatliche Kontingente.
3. Upgrade-Kommunikation spricht im selben Ton wie die App: Ein Hinweis an der Stelle, an der der Nutzer an eine Grenze stößt, mit dem konkreten Nutzen im Moment des Bedarfs. Kein Banner, kein Druck, keine generelle Werbung.
4. Beim Downgrade gilt sperren statt löschen. Wer weniger zahlt, verliert Daten nie, nur Funktionen.

## Ist-Stand

Ergebnis der Code-Prüfung: Alle Features der Paket-Matrix sind umgesetzt. Die Monetarisierungsschicht fehlt vollständig.

| Feature                                | Paket laut Matrix       | Umsetzung heute                                           | Belege                                                                                                                                                 |
| -------------------------------------- | ----------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kategorien                             | Free                    | vorhanden                                                 | `server/src/models/category.ts`, `server/src/express/routes/categories.ts`                                                                             |
| Checklisten, Deadlines, Aufwand        | Free                    | vorhanden                                                 | `server/src/models/task.ts`, `server/src/logics/autoDeleteAfterDeadline.ts`                                                                            |
| Belohnungssystem (Punkte)              | Free                    | vorhanden (Epic #1340, #1360–#1363)                       | `server/src/models/scoreEntry.ts`, `server/src/logics/{score,streak,milestones}.ts`                                                                    |
| Balance-Analyse                        | Free (Basis)            | vorhanden; 5 Defaultsäulen (Petzold), nutzerdefinierbar   | `server/src/models/pillarData.ts`, `server/src/models/taskPillar.ts`, `server/src/express/routes/scores.ts`                                            |
| Proaktive Vorschläge                   | Free (nicht in Matrix)  | vorhanden                                                 | `GET /next`, `GET /suggestions` in `server/src/express/index.ts`                                                                                       |
| Gruppen                                | Pro                     | vorhanden                                                 | `server/src/models/group*.ts`, `server/src/express/routes/groups.ts`, `server/src/express/routes/inviteLinks.ts`                                       |
| Sprachsteuerung                        | Pro                     | vorhanden als lokale Spracheingabe (kein Server-Endpunkt) | `frontend/src/components/VoiceField.tsx`, `frontend/src/lib/useVoiceInput.ts`                                                                          |
| KI-Assistenz                           | Pro/Max/Ultimate        | vorhanden, unbegrenzt                                     | `server/src/express/routes/{parseTasks,suggestPillars,pillarAdvisor,lektorat}.ts`, `server/src/llm/llm.ts`                                             |
| Aufgaben-Graph (gewichtete Relationen) | Max                     | vorhanden                                                 | `server/src/models/dependency.ts` (`weight`), `server/src/logics/graph.ts`, `GET /graph`                                                               |
| Standortbasierte Erinnerungen          | Max                     | vorhanden                                                 | `server/src/logics/geo-background-job.ts`, `server/src/express/routes/{geoConfig,geocodeSearch,reverseGeocode,placeFavorites}.ts`, `GET /tasks/nearby` |
| MCP-Zugriff                            | Max lesend, Ultimate rw | vorhanden; Scope frei wählbar                             | `server/src/mcp/{server,tools}.ts`, `server/src/models/apiToken.ts` (`scope`), `server/src/express/routes/apiTokens.ts`                                |

Was fehlt, ist die komplette Monetarisierungsschicht:

- Plan-Modell am Nutzer (`users` kennt nur `role` admin/member)
- Serverseitiges Feature-Gating
- Frontend-Plan-Kontext und kontextuelle Upgrade-Angebote
- KI-Kontingente (es gibt kein Metering; die LLM-Provider sind instanzweit konfiguriert, genau ein Call pro Anfrage)
- MCP-Plan-Deckel (der PAT-Scope ist unabhängig vom Paket wählbar)
- Zahlung und Abo-Lifecycle
- Downgrade-Verhalten
- öffentliche Preisdarstellung

Randnotizen für die Umsetzung:

- Die Spracheingabe läuft lokal im Browser; es gibt keinen Server-Endpunkt dafür. Die Paketgrenze lässt sich dort nur im Frontend durchsetzen. Das ist akzeptiert, weil sie ein Komfort-Feature ist.
- Die einzigen Limitierungsmuster im Code sind der Nominatim-Rate-Limiter (`geocodeRateLimit.ts`, 1 Anfrage/s) und die Push-Dedupe über `notification_logs`. Ein Kontingent-Zähler ist Neubau und kann sich an diesen Mustern orientieren.
- Der API-Vertrag liegt zentral in `openapi.yml`. Neue Felder und Fehlerbodies (403, 429) müssen dort eingetragen und die Client-Typen neu generiert werden.

## Zielsystem

### Paket-Matrix

| Feature                                                               | Free  | Pro (7,99 €/Monat) | Max (14,99 €/Monat) | Ultimate (24,99 €/Monat) |
| --------------------------------------------------------------------- | ----- | ------------------ | ------------------- | ------------------------ |
| Aufgaben-Mengenlimit                                                  | Keins | Keins              | Keins               | Keins                    |
| Kategorien                                                            | ✅    | ✅                 | ✅                  | ✅                       |
| Checklisten, Deadlines, Aufwandsschätzung                             | ✅    | ✅                 | ✅                  | ✅                       |
| Belohnungssystem (Punkte)                                             | ✅    | ✅                 | ✅                  | ✅                       |
| Balance-Analyse (individuelle Säulen, Basis)                          | ✅    | ✅                 | ✅                  | ✅                       |
| Gruppen                                                               | ❌    | ✅                 | ✅                  | ✅                       |
| Sprachsteuerung                                                       | ❌    | ✅                 | ✅                  | ✅                       |
| KI-Assistenz (Kontingent/Monat)                                       | ❌    | ~60 Anfragen       | ~110 Anfragen       | ~200 Anfragen            |
| Aufgaben-Graph (gewichtete Relationen)                                | ❌    | ❌                 | ✅                  | ✅                       |
| Standortbasierte Erinnerungen                                         | ❌    | ❌                 | ✅                  | ✅                       |
| MCP-Zugriff (alles lesend oder alles schreibend, keine Unterfeatures) | ❌    | ❌                 | Nur lesend          | Lesend & schreibend      |

### Preise und Zeitraumstaffelung

| Paket    | Monatlich | Quartalsweise (−10 %)     | Jährlich (−20 %)           |
| -------- | --------- | ------------------------- | -------------------------- |
| Pro      | 7,99 €    | 21,57 € (≈ 7,19 €/Monat)  | 76,70 € (≈ 6,39 €/Monat)   |
| Max      | 14,99 €   | 40,47 € (≈ 13,49 €/Monat) | 143,90 € (≈ 11,99 €/Monat) |
| Ultimate | 24,99 €   | 67,47 € (≈ 22,49 €/Monat) | 239,90 € (≈ 19,99 €/Monat) |

### Umsatzskizze

Netto nach 15 % Store-Gebühr, ohne Werbung. Der Start läuft über Web-Abos, dort liegt der Abzug bei rund 5 bis 6 % (Stripe-Transaktionsgebühr plus 0,7 % Stripe Billing, siehe Gebührentabelle in [ADR 0013](adr/0013-zahlungsweg-stripe-web-abos.md)). Die Zahlen unten sind damit um etwa ein Zehntel zu niedrig; sie bleiben als konservative Untergrenze stehen.

| Szenario      | Installs/Jahr | Bei 2 % Conversion | Bei 5 % Conversion |
| ------------- | ------------- | ------------------ | ------------------ |
| Pessimistisch | 300           | ca. 720 €          | ca. 1.800 €        |
| Realistisch   | 1.500         | ca. 3.600 €        | ca. 9.000 €        |
| Optimistisch  | 5.000         | ca. 12.000 €       | ca. 30.000 €       |

Annahmen: Nutzerverteilung etwa 60 % Pro, 30 % Max, 10 % Ultimate. Reine Modellrechnung ohne Prognoseanspruch; sie dient der Einordnung der Größenordnung. Die 15 % Store-Gebühr greift erst bei Vertrieb über App-Stores. Bei einem Start über Web-Abos fällt der Abzug deutlich niedriger aus; die Rechnung bleibt als konservative Größenordnung stehen.

### Konversionsprinzip: kontextuelle Upgrade-Angebote

Der Upgrade-Hinweis erscheint genau an der Stelle, an der der Nutzer an eine Paketgrenze stößt, nicht in einer generellen Preisliste oder Werbung. Grenzstellen sind: Gruppen-Aktion ohne Pro, Relation anlegen oder Standort-Feld ohne Max, KI-Aufruf ohne Kontingent, Schreib-Token ohne Ultimate. Das Framing folgt der Fürsorgefunktion: Der Hinweis nennt den konkreten Nutzen an dieser Stelle (etwa „Das würde dir hier helfen: Abhängigkeiten zeigen, was deine Aufgabe blockiert"), nicht den Preis allein. Eine Preisübersicht gibt es nur als Sekundärbereich in den Einstellungen. Die Erwartung aus dem Arbeitspapier: Der Wert wird im Moment des Bedarfs sichtbar, das erhöht die Konversion stärker als klassische Preis-Kommunikation.

### Badge-System: sichtbare Paketkennzeichnung

Die kontextuellen Angebote sind reaktiv, sie erscheinen erst im Grenzmoment. Ergänzend bekommt jede Funktion, die oberhalb von Free liegt, ein dauerhaft sichtbares Badge direkt am Bedienelement: „Pro (i)“, „Max (i)“ oder „Ultimate (i)“. Das Badge steht immer sichtbar, nicht erst beim Versuch. Betroffen sind der Gruppenbereich, die Spracheingabe, die KI-Bedienelemente (Schnellerfassung, Lektorat, Berater), der Relationen-Editor, die Standort-Felder und der MCP-Scope-Umschalter in den Token-Einstellungen. Free-Funktionen tragen kein Badge.

Hat der Nutzer ein Paket, das die Funktion abdeckt, steht statt des Info-Schalters ein grüner Haken. Beide Zustände haben eine Aufgabe: Das (i) öffnet an jeder Stelle das kontextuelle Angebot, auch ohne Grenzkontakt, damit Nutzer früh erfahren, wo und wofür sie upgraden können. Der grüne Haken zeigt Inhabern sichtbar, welche Funktionen sie genießen; er ist Wertschätzung, kein Verkaufsdruck.

Technisch: Die Badges rendern aus der Entitlement-Map in `/auth/me` (Feature-Identifier, erlaubt oder nicht, erforderliches Paket); Paketlogik liegt nur serverseitig. Der Client kennt die Kopplung Bedienelement ↔ Identifier, aber nicht die Regel dahinter; eine Server-Korrektur in der Rechte-Zentrale ändert alle Badges ohne App-Release. Die Badges sind rein informativ und ersetzen das kontextuelle Angebot nicht, sie verlinken es. KoliBri-First: Badge aus der KoliBri-Bibliothek, der Info-Schalter hält die Touch-Target-Regeln (44 px) ein. Prüfen in Umsetzung und e2e bei 375×812, ob die Badges in engen Toolbar- und Formularzeilen umbrechen, statt das Layout zu sprengen.

### Offene Punkte

- Exakte KI-Kontingente (Basis: rund 18 % des Abopreises als Token-Budget). Die Werte stehen konfigurierbar in der Rechte-Zentrale; die Feinjustierung folgt nach Auswertung im Betrieb (T4, T8).
- Der finale Preis je Paket ist in T6 (#1461) entschieden: Es gilt die Preistabelle oben. Die Vergleichswerte (Habitica ~5 €, Habitify ~2,50 €, Productive ~11 € monatlich) lagen der Entscheidung vor. Die Preise sind Endpreise ohne Umsatzsteuer, siehe [ADR 0013](adr/0013-zahlungsweg-stripe-web-abos.md).
- Das Downgrade-Verhalten ist hier festgelegt (sperren statt löschen) und wird in T7 umgesetzt.

## Entscheidungen und Annahmen

Die folgenden Punkte sind im Konzept als Empfehlung entschieden. Abweichungen sind möglich, brauchen aber eine Begründung im jeweiligen Issue.

| Nr  | Punkt                   | Entscheidung (Empfehlung)                                                                                                                           | Alternative, wann prüfen                                                                              |
| --- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Zahlungsweg             | Entschieden in T6: Stripe-Web-Abos, Zahlungsart PayPal, kein Wero, Kleinunternehmerregelung — [ADR 0013](adr/0013-zahlungsweg-stripe-web-abos.md)   | App-Store-IAP erst mit späterem nativem Wrapper, dann neu zu entscheiden                              |
| 2   | Übergang Bestandsnutzer | Grandfathering: Bestandsnutzer bleiben bis zum Payment-Start auf einem Übergangs-Tier, danach Free-Default                                          | harte Kante beim Gating-Rollout; Festlegung in T8                                                     |
| 3   | Säulenanzahl            | Marketing sagt „individuelle Säulen (5er-Default)"; keine sechste Säule einführen                                                                   | sechste Säule nur bei inhaltlichem Bedarf                                                             |
| 4   | Sprachsteuerung         | bestehende lokale Spracheingabe; Paketgrenze nur im Frontend (bewusste Lücke, siehe Ist-Stand)                                                      | serverseitige Durchsetzung erst mit eigenem STT-Endpunkt                                              |
| 5   | Fürsorge-Kern           | bleibt vollständig Free (Vorschläge, Balance, Punkte)                                                                                               | keine; Kern des Bindungsversprechens                                                                  |
| 6   | Aufgaben-Mengenlimit    | keins, in allen Paketen (laut Matrix); das Kostenrisiko tragen die KI-Kontingente                                                                   | nur bei Missbrauchsfällen                                                                             |
| 7   | Badge-System            | dauerhaft sichtbare Badges „Pro/Max/Ultimate (i)“ an allen Funktionen oberhalb von Free; grüner Haken statt (i), wenn der Plan die Funktion abdeckt | Badges nur an Grenzstellen; Festlegung folgt dem Fürsorge-Prinzip                                     |
| 8   | Feature-Katalog         | stabile Feature-Identifiers serverseitig; Entitlement-Map reist in `/auth/me`; Frontend ohne Paketlogik                                             | separater Entitlements-Endpoint, falls Szenarien es brauchen                                          |
| 9   | Rollout                 | Env-Schalter `MONETIZATION_ENFORCED`, Default aus; gemessen ab T1, durchgesetzt erst in T8 nach der Übergangs-Setzung                               | harte Kante beim T2-Merge — verworfen, entzöge Bestandsnutzern Funktionen für die Dauer von T3 bis T8 |
| 10  | Preishoheit             | `plans.ts` für die Anzeige, der Zahlungsanbieter für die Abrechnung; Zuordnung Paket mal Zeitraum zu Price-ID in `plans.ts`, Abgleich per Test      | Preise nur beim Anbieter führen, falls die Anzeige sie dort liest                                     |

## Architektur

**Plan-Modell.** `users.plan` als Enum `free | pro | max | ultimate` mit Default `free`. Für das Grandfathering braucht es kein eigenes Feld: Der Übergang ist eine einmalige Plan-Setzung per Admin-Migration (T8). Die PAT-Session (`apiTokenAuth.ts`) übernimmt den Plan aus dem Nutzerdatensatz, damit das Gating für HTTP und MCP gleich greift — `apiTokenAuth.ts` baut `req.session.user` selbst zusammen, `plan` muss dort ausdrücklich mit hinein. Die Spaltenmigration folgt `migrateUsersRoleColumn` in `server/src/logics/migrate.ts` (PRAGMA-Abfrage, `ALTER TABLE ... ADD COLUMN` mit Default), aufgerufen aus `server/src/index.ts` vor `sequelize.sync()`.

**Rollout-Schalter.** Das Deployment läuft Merge nach Build nach rsync nach PM2. Ohne Schutz entzöge der T2-Merge jedem Bestandsnutzer sofort Gruppen, Graph-Schreiben und Standort, und zwar bis T8 das Grandfathering nachliefert. Ein Env-Schalter `MONETIZATION_ENFORCED` (Default aus) entscheidet deshalb, ob die Rechte durchgesetzt werden; ausgewertet wird er in der Rechte-Zentrale, damit Guards, Kontingent und MCP-Deckel dieselbe Quelle lesen. Gemessen und gezählt wird von Anfang an, durchgesetzt erst in T8 — und dort erst, nachdem die Übergangs-Setzung über alle Bestandskonten gelaufen ist. Nach dem Launch bleibt der Schalter der Weg zurück, ohne Deploy.

**Rechte-Zentrale.** Ein Modul (z. B. `server/src/logics/plans.ts`) ist die einzige Wahrheitsquelle: Paket je Feature, Kontingentwerte, erlaubter MCP-Scope, Preise. Ein öffentlicher `GET /plans` liefert Matrix und Preise aus dieser Quelle für die Preisübersicht und die Angebotstexte; das Frontend konsumiert nur diesen Endpoint und besitzt keine eigene Kopie der Matrix.

**Feature-Katalog und Entitlements.** Jede gegatete Funktion trägt einen stabilen Identifier (etwa `groups`, `voice_input`, `ai_assist`, `graph_write`, `location_reminders`, `mcp_readwrite`); die Rechte-Zentrale ordnet ihm die Pakete zu, bei KI-Funktionen zusätzlich das Kontingent. `/auth/me` liefert neben dem Plan die ausgewertete Entitlement-Map je Feature: erlaubt oder nicht, erforderliches Paket, bei KI der Kontingent-Rest. Ein einziger Request mit der Session beantwortet damit alle UI-Fragen in jedem Szenario; ein separater Batch-Endpoint ist nicht nötig. Das Frontend enthält keine Paketlogik, es rendert Badges, Angebote und Sperrzustände nur aus der Map. Eine reine Server-Korrektur genügt, um eine Funktion app-weit freizugeben oder zu sperren, ohne App-Release. Die Identifiers sind Teil des API-Vertrags (`openapi.yml`); die Zuordnung Bedienelement ↔ Identifier bleibt Code in der UI, die Paketregel dahinter liegt ausschließlich serverseitig. Der 403-/429-Body bleibt die harte Autorität im Aktionsmoment, falls die Map veraltet ist.

**Fehlervertrag.** Der zentrale Vertrag ist `{ message }` (`server/src/express/http-error.ts`, abgesichert durch `error-contract.test.ts`, #1130). Die Paketfelder kommen als optionale Felder am bestehenden `Error`-Schema dazu, nicht als zweites Fehlerformat; dazu ein `sendPlanError()` neben `sendError()`. Beide Codes (`plan_required` für 403, `quota_exhausted` für 429) und das Feld für den Kontingent-Rest werden in T1 verabschiedet, obwohl sie erst T2 und T4 befüllen — sonst zieht T3 sie später nach und fasst dieselben Komponenten ein zweites Mal an.

**Server-Gating.** Eine Guard-Factory prüft über den Feature-Identifier der Route gegen die Rechte-Zentrale und antwortet bei fehlendem Recht mit 403 und dem strukturierten Body (`code: plan_required`, `feature`, `requiredPlan`, `currentPlan`). Dieser Body ist der Vertrag für die kontextuellen Angebote im Frontend. Lesezugriffe bleiben offen, damit die Sperr-statt-Löschen-Regel trägt. Gegen Drift schützt kein Einzelfall-Test, sondern ein Abdeckungstest nach dem Muster von `api-auth-protection.test.ts`, der prüft, dass jede gegatete Schreibroute einen Guard trägt.

**MCP-Loopback.** `server/src/mcp/tools.ts` ruft die gespiegelte HTTP-Route mit demselben Bearer-Header auf (in `apiTokenAuth.ts` als AK6 dokumentiert). Sobald die Guards greifen, bekommt dieser Loopback einen plan-403 und reicht ihn roh durch. Betroffen sind `task_link`, `task_unlink`, `task_links` (Max) sowie `group_list`, `group_members_list` (Pro). Der plan-403 muss dort in denselben lesbaren JSON-RPC-Fehler wandern, den der Scope-Guard heute liefert.

**KI-Kontingent.** Eine Tabelle zählt LLM-Aufrufe je Nutzer und Monat (Schlüssel Jahr-Monat, Unique-Index auf Nutzer und Monat). Es zählen die fünf LLM-Routen; das reine Feedback zu Säulen-Vorschlägen (Speicherung ohne LLM-Call) zählt nicht. Bei Erschöpfung antwortet der Server 429 mit `code: quota_exhausted`; erfolgreiche Responses führen den Kontingent-Rest mit, damit das Frontend kurz vor dem Limit warnen kann. Gezählt wird reservierend vor dem Call mit Rückbuchung bei Provider-Fehler — nachträgliches Zählen ließe parallele Aufrufe am Deckel vorbei — und als ein `UPDATE ... SET count = count + 1`, nicht als Read-Modify-Write in JavaScript. Der Zähler hängt als Route-Middleware neben dem Plan-Guard, nicht in den fünf Handlern: `requestModelJson` (`server/src/llm/llm.ts:434`) ist zwar der gemeinsame Call, an dem alle fünf Parser vorbeilaufen, kennt aber weder Request noch Nutzer — die Router-Naht führt an ihm vorbei, weil `lektorat.ts` ihn direkt importiert, während die übrigen vier Routen ihren Parser per Dependency Injection bekommen und im Test ersetzt werden.

**MCP-Deckel.** Der Plan begrenzt den erlaubten Token-Scope (Max: nur `read`; Ultimate: auch `readwrite`). Geprüft wird beim Anlegen und beim Scope-Umschalten der PATs sowie beim Schreibversuch über `tools/call` mit dem bestehenden lesbaren JSON-RPC-Fehler, ergänzt um einen Pakethinweis.

**Zahlung.** Buchen und Verwalten läuft über einen eigenen Routenbereich (`billing`) hinter einer schmalen Provider-Schnittstelle: Checkout, Webhook-Verarbeitung, Plan-Sync, Abo-Status. Upgrades wirken sofort, Downgrades zum Periodenende. Zahlungsdaten werden nie im eigenen System gespeichert, nur externe Referenzen. Die Webhook-Route braucht den unveränderten Rohbody für die Signaturprüfung und muss deshalb mit `express.raw({ type: 'application/json' })` vor dem globalen `express.json()` in `server/src/express/index.ts` gemountet werden; damit liegt sie zugleich vor CSRF-Prüfung und `requireAuth`, die der Provider ohnehin nicht bedienen kann. Preise stehen doppelt — in `plans.ts` und als Price-IDs beim Provider. Maßgeblich ist `plans.ts` für die Anzeige und der Provider für die Abrechnung; die Zuordnung Paket mal Zeitraum zu Price-ID liegt in `plans.ts`, ein Test vergleicht beide Seiten.

**Downgrade.** Rechte entfallen, Daten bleiben. Die betroffenen Ansichten bleiben lesbar, die Bedienelemente führen auf das kontextuelle Angebot. Bei sauber gebauter Vorkette folgt das von selbst: Ein Downgrade ändert nur den Plan-Wert, und Sperrzustände wie Angebote rendern ausschließlich aus der Entitlement-Map.

**Badges.** Die Frontend-Badge-Komponente rendert aus der Entitlement-Map in `/auth/me`, nicht aus eigener Logik: An jedem Bedienelement, das an einen Feature-Identifier gekoppelt ist, steht das Badge dauerhaft sichtbar; meldet die Map das Feature als erlaubt, zeigt sie einen grünen Haken statt des Info-Schalters. Ein Klick auf (i) öffnet das kontextuelle Angebot derselben Stelle.

**Fehlerweg im Frontend.** Jeder `ResponseError` läuft durch `toApiError` in `frontend/src/lib/apiError.ts`; dort steckt mit dem Session-401-Weg (`SESSION_EXPIRED_EVENT` auf `window`, globaler Dialog) auch das fertige Muster für „Statuscode führt zu globalem Dialog". 403 und 429 folgen ihm, statt die rund 80 Aufrufstellen in `frontend/src/api.ts` anzufassen. Zwei Nebenwirkungen sind zu beachten: Der `onResponse`-Hook in `api.ts` verwirft bei jedem 403 den CSRF-Token und muss den Paket-Code ausnehmen, und der localStorage-Spiegel der Entitlement-Map gehört pro User-Id abgelegt und beim Logout gelöscht — sonst sieht das nächste Konto auf demselben Gerät fremde Badges. Neu geholt wird die Map bei App-Fokus und bei der Rückkehr aus dem Checkout.

**Vertrag und Tests.** Alle neuen Felder, Endpoints und Fehlerbodies werden in `openapi.yml` nachgezogen, die Client-Typen neu generiert. Server-Guards und Kontingent-Logik fallen unter die Coverage-Gates der Server-Logik. Die Frontend-Teile bekommen Vitest-Tests, die Grenzstellen zusätzlich e2e bei 375×812 nach der Mobile-First-Regel, KoliBri black-box.

## Teilaufgaben

Neun Teilaufgaben. T1 legt Plan-Modell, Rechte-Zentrale und die Verträge fest, auf denen alles Weitere aufsetzt; danach laufen T2, T4 und T5 parallel, weil sie fachlich alle nur an T1 hängen. T3a wartet nur auf T2 und T4, nicht auf T5, das als eigener Strang von T1 direkt zu T6 läuft. Das Frontend folgt erst, wenn die drei Server-Verträge stehen — sonst würden dieselben rund vierzehn Komponenten dreimal angefasst, einmal für die Badges, einmal für die Kontingent-Warnung und einmal für die Sperrzustände nach dem Downgrade.

```
T1 → { T2, T4 } → T3a → T3b → T6 → T7 → T8
T1 → T5 → T6
```

Die Felder entsprechen dem Ticket-Formular (`.github/ISSUE_TEMPLATE/ticket.yml`). Angelegt sind die Teilaufgaben als Epic #1455 mit Sub-Issues nach dem Muster von Epic #1340: #1456 (T1), #1457 (T2), #1459 (T4), #1460 (T5), #1458 (T3a), #1484 (T3b), #1461 (T6), #1462 (T7), #1463 (T8). Die Abschnitte hier sind die Fassung, aus der die Issues entstanden sind; maßgeblich für die Umsetzung ist das jeweilige Issue.

### Teilaufgabe T1: Plan-Datenmodell und Rechte-Zentrale

#### Was ist das Problem?

Am Nutzer gibt es kein Paket-Modell (`users` unterscheidet nur `role` admin/member), und es gibt keine zentrale Definition, welches Paket welches Feature enthält. Alle folgenden Teilaufgaben brauchen beides als Grundlage.

#### Wo tritt es auf?

```
server/src/models/user.ts
server/src/logics/plans.ts (neu)
server/src/logics/migrate.ts (Spaltenmigration)
server/src/index.ts (Migrationsaufruf vor sequelize.sync())
server/src/express/http-error.ts (Fehlervertrag)
server/src/express/routes/admin.ts
server/src/express/routes/auth.ts
server/src/express/apiTokenAuth.ts
openapi.yml
```

#### Wie soll es sein?

`users.plan` als Enum `free | pro | max | ultimate` mit Default `free`; Migration ohne Datenverlust. Ein Modul `plans.ts` ist die einzige Wahrheitsquelle: Es führt einen Feature-Katalog mit stabilen Identifiern (etwa `groups`, `voice_input`, `ai_assist`, `graph_write`, `location_reminders`, `mcp_readwrite`), ordnet jedem Identifier die Pakete zu, bei KI-Funktionen zusätzlich das Kontingent, und hält die Preise. Ein öffentlicher `GET /plans` liefert Matrix und Preise aus dieser Quelle. `/auth/me` und die PAT-Session liefern den Plan und die ausgewertete Entitlement-Map je Feature (erlaubt oder nicht, erforderliches Paket, Kontingent-Rest). `PATCH /admin/users/:id/plan` hinter `requireRole('admin')` setzt den Plan manuell (Tests, Support, Grandfathering). `openapi.yml` erweitern — die Identifiers sind API-Vertrag —, Client-Typen generieren.

#### Thema

Infrastructure

#### Komplexität

Mittel

#### Woran messen wir das?

- `users.plan` existiert mit Default `free`; die Migration läuft auf einer Bestands-DB ohne Verluste
- Der Feature-Katalog deckt alle Features der Paket-Matrix ab; die Zuordnung Identifier zu Paket liegt genau einmal im Code
- `/auth/me` und PAT-Requests tragen Plan und Entitlement-Map je Feature
- `GET /plans` ist öffentlich und liefert Matrix und Preise aus `plans.ts`
- `PATCH /admin/users/:id/plan` ist nur als admin erreichbar; ungültige Werte werden mit 400 abgelehnt
- Server-Tests für Rechte-Matrix, Entitlement-Auswertung, Migration und Admin-Endpoint

#### Hinweise

Start der Kette, keine Abhängigkeit. Kontingentwerte zunächst ~60/110/200 (Pro/Max/Ultimate), Free 0; die Feinjustierung erfolgt später ohne Schema-Änderung.

Mit T1 werden zugleich die Verträge verabschiedet, auf denen T2 bis T7 aufsetzen: die Erweiterung des Fehlervertrags um die Paketfelder samt `sendPlanError()`, die Codes `plan_required` und `quota_exhausted`, das Feld für den Kontingent-Rest, der Rollout-Schalter `MONETIZATION_ENFORCED` und der Hinweis, dass `voice_input` ein reines Anzeige-Entitlement ohne Server-Endpunkt ist. Die Migration folgt `migrateUsersRoleColumn` in `server/src/logics/migrate.ts`; `plan` muss außerdem in das `req.session.user` aus `apiTokenAuth.ts`, sonst greift das Gating für Bearer-Requests nicht. Danach können T2, T4 und T5 parallel laufen.

### Teilaufgabe T2: Serverseitiges Feature-Gating

#### Was ist das Problem?

Jede Route ist für jeden angemeldeten Nutzer offen. Die Paketgrenzen der Matrix (Gruppen ab Pro, Graph-Schreiben und Standort ab Max) werden serverseitig nicht durchgesetzt; ein Client-Gating allein wäre Umgehung ausgesetzt.

#### Wo tritt es auf?

```
server/src/express/routes/groups.ts
server/src/express/routes/inviteLinks.ts
server/src/express/routes/tasks.ts (Dependency-Endpunkte, /tasks/nearby)
server/src/express/routes/geoConfig.ts
server/src/express/routes/geocodeSearch.ts
server/src/express/routes/reverseGeocode.ts
server/src/express/routes/placeFavorites.ts
server/src/logics/geo-background-job.ts
openapi.yml
```

#### Wie soll es sein?

Eine Guard-Factory aus der Rechte-Zentrale (T1) schützt die Schreibrouten der Gruppen (Pro) sowie die Dependency-Endpunkte und die Geo-/Standort-Endpunkte (Max). Bei fehlendem Recht antwortet der Server 403 mit strukturiertem Body (`code: plan_required`, `feature`, `requiredPlan`, `currentPlan`); dieser Body ist der Vertrag für T3. Lesende Endpunkte (`GET /graph`, `GET /forest`, Gruppen-Ansichten) bleiben offen, damit Daten sichtbar bleiben. Das Adressfeld am Task bleibt ohne Max speicherbar (Freitext ohne Autocomplete und Erinnerung).

#### Thema

Security

#### Komplexität

Komplex

#### Woran messen wir das?

- Der Guard prüft `req.user.plan` gegen die Rechte-Matrix; die Rechte stehen nur in `plans.ts`, nicht in den Routen
- Gruppen-Schreibrouten erfordern Pro; Dependency-Endpunkte und Geo-Endpunkte erfordern Max
- Der 403-Body ist strukturiert und in `openapi.yml` beschrieben
- Lesezugriffe sind ungegatet; nach simuliertem Downgrade bleiben die Daten sichtbar
- Tests je Routengruppe über die Paketkombinationen (Free/Pro/Max/Ultimate, jeweils 403 oder 200)

#### Hinweise

`blocked_by`: T1. Die Sprachsteuerung hat keinen Server-Endpunkt (lokale Spracheingabe) und wird erst im Frontend gegatet.

Zwei Punkte kommen gegenüber der ersten Fassung dazu: Der Guard wertet den Rollout-Schalter aus (aus heißt durchlassen), und der plan-403 aus dem MCP-Loopback in `server/src/mcp/tools.ts` wird in den lesbaren JSON-RPC-Fehler übersetzt. Die Rechtetests laufen tabellengetrieben, dazu der Abdeckungstest gegen Drift.

### Teilaufgaben T3a und T3b: Frontend-Gating, Badges und kontextuelle Upgrade-Angebote

Der ursprüngliche Zuschnitt umfasste vierzehn Komponenten, drei neue Module, ein neues UX-Muster und e2e — zu viel für einen prüfbaren Durchgang. Geteilt in T3a (#1458: Plan-Kontext, Badge, Angebots-Dialog, Settings-Bereich „Pakete" und drei Referenzstellen, je eine pro Fehlerweg — Gruppen für Pro/403, Relation anlegen für Max/403, KI-Schnellerfassung für Kontingent/429) und T3b (#1484: Ausrollen auf die acht übrigen Komponenten nach Muster-Treue). Der folgende Abschnitt beschreibt beide gemeinsam.

#### Was ist das Problem?

Das Frontend kennt den Plan nicht. Nutzer ohne passendes Paket sehen Bedienelemente, deren Aktionen serverseitig mit 403 scheitern, ohne Erklärung. Nirgends ist sichtbar, welche Funktion zu welchem Paket gehört: Es gibt weder eine Kennzeichnung am Bedienelement noch eine Stelle, die an der Paketgrenze den Wert des höheren Pakets zeigt.

#### Wo tritt es auf?

```
frontend/src/lib/usePlan.ts (neu), PlanBadge.tsx (neu) und eine Upgrade-Angebots-Komponente (neu)
frontend/src/components/GroupsSection.tsx
frontend/src/components/GroupDetail.tsx
frontend/src/components/GroupFormDialog.tsx
frontend/src/components/DependencyModal.tsx
frontend/src/components/AddressAutocomplete.tsx
frontend/src/components/PlaceFavoritesSection.tsx
frontend/src/components/NearbyCard.tsx
frontend/src/components/VoiceField.tsx
frontend/src/components/QuickCaptureModal.tsx
frontend/src/components/TaskForm.tsx (Lektorat-Buttons)
frontend/src/components/ApiTokensSection.tsx (MCP-Scope-Umschalter)
frontend/src/components/SettingsPage.tsx
frontend/src/api.ts
```

#### Wie soll es sein?

Ein Plan-Kontext (aus `/auth/me` inklusive Entitlement-Map, localStorage-Spiegel nach dem Muster der Nachbar-Switches in `frontend/src/lib/push.ts`) hält Plan und Feature-Freigaben vor. An jedem Bedienelement, das an einen Feature-Identifier gekoppelt ist, rendert die Badge-Komponente aus der Entitlement-Map: „Pro (i)“, „Max (i)“ oder „Ultimate (i)“ dauerhaft sichtbar, bei erlaubtem Feature ein grüner Haken statt des Info-Schalters. Ein Klick auf (i) öffnet das kontextuelle Angebot dieser Stelle. An jeder Grenzstelle (Gruppen-Aktion, Relation anlegen, Standort-Feld und Nähe, Spracheingabe-Start, KI-Aufruf ohne Kontingent) zeigt die App vor dem Absenden das kontextuelle Angebot: konkreter Nutzen an dieser Stelle im Fürsorge-Ton, Ziel-Paket, Preis. Kommt trotzdem ein 403 oder 429 mit strukturiertem Body zurück, wandelt die zentrale Fehlerbehandlung ihn in dasselbe Angebot. Die Spracheingabe wird rein clientseitig gesperrt. In den Einstellungen entsteht der Sekundärbereich „Pakete“ mit Matrix und Preisen aus `GET /plans`. Keine Banner, keine sonstige Preiswerbung.

#### Thema

UX/UI

#### Komplexität

Komplex

#### Woran messen wir das?

- Plan-Kontext über `/auth/me` (inklusive Entitlement-Map) mit localStorage-Spiegel; kein Flackern beim Seitenwechsel (Muster `push.ts`)
- Alle Funktionen oberhalb von Free tragen das Badge dauerhaft sichtbar; Zustand und Ausprägung kommen aus der Entitlement-Map, es gibt keine Paketlogik im Frontend
- Deckt der Plan das Feature ab, steht der grüne Haken statt des (i); ein Klick auf (i) öffnet das kontextuelle Angebot
- Die UI koppelt Bedienelemente nur an Feature-Identifier; eine serverseitige Korrektur der Paketregel ändert Badges, Angebote und Sperrzustände ohne Frontend-Änderung
- Alle Grenzstellen zeigen das kontextuelle Angebot vor dem Absenden; 403/429-Body-Auswertung an einer zentralen Stelle
- Die Angebotstexte nennen Nutzen und Paket, nicht nur den Preis
- Der Settings-Bereich „Pakete“ rendert Matrix und Preise aus `GET /plans`
- Die Spracheingabe ist ohne Pro im Frontend gesperrt
- Vitest-Tests je Grenzstelle und für beide Badge-Zustände; e2e bei 375×812 (dort auch Badge-Umbruch in engen Zeilen); KoliBri black-box

#### Hinweise

`blocked_by`: T3a auf T2 (403-Vertrag) und T4 (429-Vertrag, Kontingent-Rest), T3b auf T3a. Die Textbausteine zentral pflegen, damit T3b, T6 und T7 sie wiederverwenden. Badges sind rein informativ, sie ersetzen das kontextuelle Angebot nicht und sperren nichts.

Die Kontingent-Warnung und die Restanzeige gehören in T3a und nicht in einen eigenen Frontend-Durchgang — sie betreffen dieselben Komponenten. Die 403-/429-Auswertung sitzt in `toApiError` nach dem Muster des Session-401-Wegs; der CSRF-Hook in `api.ts` muss den Paket-Code ausnehmen, und der localStorage-Spiegel gehört pro User-Id abgelegt und beim Logout gelöscht.

### Teilaufgabe T4: KI-Kontingent-Metering

#### Was ist das Problem?

Die fünf LLM-Routen sind unbegrenzt nutzbar; es gibt keinen Zähler. Die Kontingente der Matrix (Free 0, rund 60/110/200 je Monat) sind nicht durchsetzbar, und die Kosten je Nutzer sind nicht messbar.

#### Wo tritt es auf?

```
server/src/express/routes/parseTasks.ts
server/src/express/routes/suggestPillars.ts
server/src/express/routes/pillarAdvisor.ts
server/src/express/routes/lektorat.ts
server/src/models/aiUsage.ts (neu)
openapi.yml
frontend/src (429-Behandlung, Restanzeige)
```

#### Wie soll es sein?

Jeder Aufruf der fünf LLM-Routen (parse-text, parse-search, suggest-pillars, advisor, lektorat) erhöht einen Zähler je Nutzer und Monat (Schlüssel Jahr-Monat). Fehlgeschlagene LLM-Calls (5xx, 503) zählen nicht. Bei Überschreitung antwortet der Server 429 mit `code: quota_exhausted` und strukturierter Paketinfo; erfolgreiche Responses führen den Kontingent-Rest mit. Das Frontend warnt kurz vor dem Limit (letzte 10 %) und zeigt bei Erschöpfung das kontextuelle Angebot aus T3. Free hat das Kontingent 0: KI-Bedienelemente führen direkt auf das Angebot. Die Werte stehen in der Rechte-Zentrale.

#### Thema

Logik

#### Komplexität

Mittel

#### Woran messen wir das?

- Der Zähler gilt je Nutzer und Monat; der Monatswechsel beginnt einen neuen Schlüssel
- Kontingente kommen aus `plans.ts` (Free 0, Pro 60, Max 110, Ultimate 200; konfigurierbar)
- Der 429-Body ist strukturiert und in `openapi.yml` beschrieben; Erfolg-Responses tragen den Kontingent-Rest
- Das Frontend warnt unter 10 % Rest und zeigt bei Erschöpfung das Angebot
- Tests für Zählung, Grenzwert, Monatswechsel und Fehlerfall

#### Hinweise

`blocked_by`: T1 (Fehlervertrag, Kontingentwerte, Rollout-Schalter). Der Serverteil hängt fachlich nicht an T3; die Warnung und die Restanzeige baut T3a in einem Durchgang mit den Badges. Gezählt wird reservierend mit Rückbuchung, atomar und als Route-Middleware neben dem Plan-Guard — nicht in den fünf Handlern verteilt.

Basis der Werte: rund 18 % des Abopreises als Token-Budget.

### Teilaufgabe T5: MCP-Plan-Deckel

#### Was ist das Problem?

PATs erhalten heute unabhängig vom Paket den Scope `readwrite`. Die Paketregel am MCP-Zugang (Max nur lesend, Ultimate lesend und schreibend) greift nicht.

#### Wo tritt es auf?

```
server/src/express/routes/apiTokens.ts
server/src/express/apiTokenAuth.ts
server/src/mcp/server.ts
```

#### Wie soll es sein?

Der Plan begrenzt den erlaubten Scope: Unter Max ist `readwrite` nicht wählbar; Anlegen und der Scope-Umschalter (PATCH) verweigern mit Pakethinweis. Ultimate bleibt wie heute. Ein bestehendes `readwrite`-Token eines Max-Accounts verhält sich bei der Nutzung wie `read`: Der bestehende Scope-Guard und der MCP-Layer antworten mit dem lesbaren Fehler, ergänzt um den Pakethinweis. `tools/list` bleibt ungefiltert; die Prüfung erfolgt wie bisher bei `tools/call`.

#### Thema

Security

#### Komplexität

Mittel

#### Woran messen wir das?

- Anlegen und Umschalten eines `readwrite`-Tokens unter Max wird verweigert, mit strukturierter Paketinfo
- Ultimate ist unverändert (`read` und `readwrite` möglich)
- Ein Schreibversuch über `tools/call` mit Max und `readwrite`-Token erhält den lesbaren JSON-RPC-Fehler mit Pakethinweis
- HTTP-Schreibzugriffe mit einem solchen Token bleiben vom Scope-Guard geblockt
- Tests für die Kombinationen Plan × Scope

#### Hinweise

`blocked_by`: T1. Diese Teilaufgabe hängt nur am Plan-Modell und am Fehlervertrag, nicht am Kontingent, und kann parallel zu T2 und T4 laufen. Sie deckelt den Scope; der zweite MCP-Fall, in dem ein Plan-Guard über den Loopback zuschlägt, wird in T2 gelöst.

Das Zweistufenmodell (HTTP-Guard plus MCP-Layer) bleibt bestehen; die offenen MCP-Themen #1359, #1370 und #1414 bleiben unberührt.

### Teilaufgabe T6: Zahlungsweg und Abo-Lifecycle

#### Was ist das Problem?

Es gibt keine Zahlungs- und Abo-Infrastruktur. Niemand kann ein Paket buchen, wechseln oder kündigen; der Plan ist nur manuell durch Admins setzbar.

#### Wo tritt es auf?

```
server/src/express/routes/billing.ts (neu)
server/src/models/subscription.ts (neu: provider, externalId, Paket, Zeitraum, Status, aktuelle Periode)
frontend/src/components/SettingsPage.tsx (Bereich Pakete: Buchen und Verwalten)
server/.env (Provider-Keys)
openapi.yml
```

#### Wie soll es sein?

Zuerst wird die Entscheidung Zahlungsweg festgehalten (Empfehlung: Stripe-Web-Abos; die 15-%-Store-Annahme der Umsatzskizze greift erst mit einem späteren nativen Wrapper). Dann: Buchungsflow aus dem Settings-Bereich (Checkout beziehungsweise IAP), Webhooks oder Store-Server-Notifications synchronisieren den Plan aus der Rechte-Zentrale. Upgrades wirken sofort, Downgrades zum Periodenende. Die Zeitraumstaffeln sind monatlich, quartalsweise (−10 %) und jährlich (−20 %). Ein Zahlungsausfall führt zu einer Kulanzfrist statt sofortigem Entzug; danach greift der Downgrade-Pfad aus T7. Der Abo-Status steht in `/auth/me`.

#### Thema

Infrastructure

#### Komplexität

Komplex

#### Woran messen wir das?

- Die Zahlungsweg-Entscheidung ist dokumentiert (ADR oder Abschnitt in diesem Konzept) und begründet
- Buchen, Upgrade, Downgrade und Kündigen sind aus der App möglich
- Die Webhook-Verarbeitung prüft Signaturen; Ereignisse ändern den Plan reproduzierbar (idempotent)
- Die Zeitraumstaffeln sind abbildbar; die Preise kommen aus der Rechte-Zentrale
- Zahlungsausfall führt zur Kulanzfrist; der Abo-Status steht in `/auth/me`
- Tests für Webhook-Signatur, Ereignis je Paketwechsel und Idempotenz

#### Hinweise

`blocked_by`: T5 und T3b. Zahlungsdaten werden nie im eigenen System gespeichert, nur externe Referenzen.

Der Webhook braucht den Rohbody und muss deshalb vor `express.json()`, vor der CSRF-Prüfung und vor `requireAuth` gemountet werden. Die Preishoheit ist vor der Umsetzung zu klären (Entscheidung Nr. 10), und die Rückkehr aus dem Checkout holt die Entitlement-Map neu.

Zahlungsweg, Zahlungsart, Rechnungsstellung und Umsatzsteuer sind in [ADR 0013](adr/0013-zahlungsweg-stripe-web-abos.md) entschieden. T6 ist in drei aufeinander folgende Teile geschnitten: Abo-Datenmodell samt Preis- und Zeitraumzuordnung und Abo-Status in `/auth/me`; danach die Stripe-Anbindung mit Checkout-Route und Webhook; zuletzt der Buchungsflow im Frontend. Die Kulanzfrist bei Zahlungsausfall beträgt 14 Tage, Stripes Wiederholungsfenster wird darauf konfiguriert.

### Teilaufgabe T7: Downgrade und Kündigung

#### Was ist das Problem?

Das Verhalten nach einer Rückstufung ist nicht definiert: Was geschieht mit Gruppen, Relationen, Standortdaten und Tokens, wenn ein Paket endet?

#### Wo tritt es auf?

```
server/src/logics/plans.ts
server/src/express/routes/apiTokens.ts
frontend/src (gesperrte Ansichten an allen Grenzstellen)
```

#### Wie soll es sein?

Sperren statt löschen, überall: Relationen, Gruppen, Adressen und Favoriten bleiben sichtbar und werden beim erneuten Upgrade wieder nutzbar; Bearbeitung und Nutzung sind gesperrt und führen auf das kontextuelle Angebot. Das KI-Kontingent resettet zum Folgemonat. Auslaufende `readwrite`-Tokens folgen der Max-Regel aus T5. Es gibt keinen Lösch-Pfad für Downgrades.

#### Thema

Logik

#### Komplexität

Mittel

#### Woran messen wir das?

- Nach Rückstufung auf Free bleiben Graph, Gruppen und Standortdaten lesbar; Schreibzugriffe sind gesperrt
- Ein erneutes Upgrade stellt die Funktionen ohne Datenverlust wieder her
- Das KI-Kontingent resettet zum Folgemonat; die Token-Regel folgt T5
- Alle gesperrten Stellen zeigen das bekannte kontextuelle Angebot
- Ein Test deckt den vollen Zyklus Upgrade, Downgrade, Upgrade ab

#### Hinweise

`blocked_by`: T6. Damit ist der offene Punkt „Downgrade-Verhalten" aus der Paketübersicht erledigt.

Bei sauberer Vorkette ist das überwiegend eine Prüf- und Nachweis-Aufgabe: Ein Downgrade ändert nur den Plan-Wert, alles Weitere folgt aus der Entitlement-Map. Jede Stelle, an der das nicht zutrifft, gehört im PR benannt.

### Teilaufgabe T8: Launch

#### Was ist das Problem?

Bis zum Launch laufen alle Nutzer mit allen Features; die Paket-Matrix ist nirgends öffentlich, und der Übergang auf die Free-Defaults ist nicht vorbereitet.

#### Wo tritt es auf?

```
docs/user-guide.md
docs/arc42.md
docs/gesamtkonzept-monetarisierung.md (Status-Update)
frontend/src/components/SettingsPage.tsx (Bereich Pakete, final)
Server-Skript oder Admin-Migration für die Übergangs-Setzung
```

#### Wie soll es sein?

Die Übergangsregel wird umgesetzt (Empfehlung Grandfathering: Bestandsnutzer bleiben bis zum Payment-Start auf ihrem Übergangs-Tier, gesetzt per Admin-Migration; danach gilt Free als Default). Die Reihenfolge entscheidet: erst die Übergangs-Setzung über alle Bestandskonten laufen lassen und das Ergebnis prüfen, dann `MONETIZATION_ENFORCED` einschalten. Umgekehrt verlieren Bestandsnutzer für die Dauer zwischen beiden Schritten ihre Funktionen. Die kontextuellen Angebote werden scharf geschaltet. Paketmatrix und Preise werden veröffentlicht (Settings-Bereich, Benutzer-Doku). `user-guide.md` und `arc42.md` werden um die Monetarisierungsschicht ergänzt. Die Preisvalidierung wird abgeschlossen (Vergleichswerte Habitica ~5 €, Habitify ~2,50 €, Productive ~11 € monatlich) und die Kontingente nach erster Auswertung justiert.

#### Thema

Documentation

#### Komplexität

Einfach

#### Woran messen wir das?

- Die Übergangsregel ist dokumentiert und gesetzt; Bestandsnutzer verlieren am Stichtag keine Daten
- Paketmatrix und Preise sind öffentlich einsehbar
- `user-guide.md` und `arc42.md` beschreiben Plan-Modell, Gating und Kontingente
- Die Kontingent- und Preisentscheidungen sind festgehalten

#### Hinweise

`blocked_by`: T7. Abschluss der Kette; das Epic wird geschlossen.

## Ausblick: KI-Guard gegen Einkaufslisten-Einträge (optional)

Der Guard ist die Leitbild-Regel angewendet auf die Datenaufnahme: priority-pilot ist keine Todo-Listen-App. Ein optionaler LLM-Guard beim Anlegen und Bearbeiten von Aufgaben prüft, ob ein Eintrag in eine reine Verwaltung gehört („Käse kaufen“) statt in das Balance-Modell. Er schützt damit nicht nur das Selbstverständnis der App, sondern die Datenqualität, auf der Säulen-Bilanz, proaktive Vorschläge und Graph beruhen.

Verhalten: nicht blockierend. Der Guard meldet sich im Fürsorge-Ton und nennt eine konkrete Alternative — etwa das Eintrag als Serie abbilden, einer Kategorie zuordnen, auf eine Säule beziehen oder umformulieren. Der Nutzer entscheidet; der Eintrag wird ohne Zustimmung nie verändert oder abgelehnt. Der Schalter liegt beim Nutzer (Muster der bestehenden KI-Voreinstellungen, `frontend/src/lib/aiPreferences.ts`); Empfehlung ist Opt-in mit Standard aus, damit die Prüfung nie ungefragt ins Schreiben eingreift.

Einordnung: Der Guard ist ein LLM-Call und zählt aufs KI-Kontingent; er läuft daher nur mit KI-Assistenz (Pro aufwärts) und sollte, wo möglich, in einen bestehenden Call integriert werden (Freitext-Verarbeitung oder Lektorat) statt als zweiter Aufruf. Fehlentscheidungen sind zu erwarten — einfache, aber legitime Aufgaben (kurze Erinnerung an einen Anruf) dürfen nicht angegangen werden; deshalb Warnung statt Sperrung und ein Feedback-Weg wie beim Säulen-Vorschlag.

Status: nicht Teil der T1–T8-Kette. Er ist als eigenes Ticket nach dem Launch vorgesehen, sobald das Kontingent-Metering (T4) Betriebswerte über die tatsächlichen Call-Kosten liefert.

## Nicht-Ziele

- Kein nativer Store-Wrapper (Capacitor) und keine Store-Veröffentlichung in diesem Konzept; T6 entscheidet nur den Weg.
- Kein Umbau der LLM-Provider-Verwaltung; sie bleibt Betreiber-Infrastruktur (instanzweit).
- Keine produktseitigen Neuentwicklungen über die Paket-Features hinaus; der optionale KI-Guard (siehe Ausblick) und ein Fürsorge-Ausbau mit stärkeren proaktiven Vorschlägen wären eigene spätere Tickets.
- Keine generelle Preiswerbung, Banner oder Nagscreens; die einzigen Instrumente sind die kontextuellen Angebote und die Badge-Kennzeichnung am Bedienelement.
- Keine Aufgaben-Mengenlimits in irgendeinem Paket.
