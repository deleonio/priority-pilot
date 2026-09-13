# Gesamtkonzept: Pakete und Monetarisierung

Stand: 13.09.2026. Grundlagen sind die Arbeitspapiere „philosophischer-anker-priority-pilot" und „priority-planner-pakete" (Fassung mit der Ergänzung zu kontextuellen Upgrade-Angeboten) sowie eine Code-Prüfung des Repos vom 12./13.09.2026. Das Konzept beschreibt Zielbild und Architektur der Monetarisierungsschicht und zerlegt sie in acht Teilaufgaben (T1 bis T8), die später als Issues im Muster von Epic #1340 angelegt werden (Epic, Sub-Issues, `blocked_by`-Kette).

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

Netto nach 15 % Store-Gebühr, ohne Werbung:

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
- Finaler Preis je Paket noch zu validieren (Vergleichswerte: Habitica ~5 €, Habitify ~2,50 €, Productive ~11 € monatlich). Entscheidung bis T8.
- Das Downgrade-Verhalten ist hier festgelegt (sperren statt löschen) und wird in T7 umgesetzt.

## Entscheidungen und Annahmen

Die folgenden Punkte sind im Konzept als Empfehlung entschieden. Abweichungen sind möglich, brauchen aber eine Begründung im jeweiligen Issue.

| Nr  | Punkt                   | Entscheidung (Empfehlung)                                                                                                                           | Alternative, wann prüfen                                          |
| --- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Zahlungsweg             | Stripe-Web-Abos für die PWA als Start; App-Store-IAP erst mit späterem nativem Wrapper                                                              | endgültige Entscheidung in T6                                     |
| 2   | Übergang Bestandsnutzer | Grandfathering: Bestandsnutzer bleiben bis zum Payment-Start auf einem Übergangs-Tier, danach Free-Default                                          | harte Kante beim Gating-Rollout; Festlegung in T8                 |
| 3   | Säulenanzahl            | Marketing sagt „individuelle Säulen (5er-Default)"; keine sechste Säule einführen                                                                   | sechste Säule nur bei inhaltlichem Bedarf                         |
| 4   | Sprachsteuerung         | bestehende lokale Spracheingabe; Paketgrenze nur im Frontend (bewusste Lücke, siehe Ist-Stand)                                                      | serverseitige Durchsetzung erst mit eigenem STT-Endpunkt          |
| 5   | Fürsorge-Kern           | bleibt vollständig Free (Vorschläge, Balance, Punkte)                                                                                               | keine; Kern des Bindungsversprechens                              |
| 6   | Aufgaben-Mengenlimit    | keins, in allen Paketen (laut Matrix); das Kostenrisiko tragen die KI-Kontingente                                                                   | nur bei Missbrauchsfällen                                         |
| 7   | Badge-System            | dauerhaft sichtbare Badges „Pro/Max/Ultimate (i)“ an allen Funktionen oberhalb von Free; grüner Haken statt (i), wenn der Plan die Funktion abdeckt | Badges nur an Grenzstellen; Festlegung folgt dem Fürsorge-Prinzip |
| 8   | Feature-Katalog         | stabile Feature-Identifiers serverseitig; Entitlement-Map reist in `/auth/me`; Frontend ohne Paketlogik                                             | separater Entitlements-Endpoint, falls Szenarien es brauchen      |

## Architektur

**Plan-Modell.** `users.plan` als Enum `free | pro | max | ultimate` mit Default `free`. Für das Grandfathering braucht es kein eigenes Feld: Der Übergang ist eine einmalige Plan-Setzung per Admin-Migration (T8). Die PAT-Session (`apiTokenAuth.ts`) übernimmt den Plan aus dem Nutzerdatensatz, damit das Gating für HTTP und MCP gleich greift.

**Rechte-Zentrale.** Ein Modul (z. B. `server/src/logics/plans.ts`) ist die einzige Wahrheitsquelle: Paket je Feature, Kontingentwerte, erlaubter MCP-Scope, Preise. Ein öffentlicher `GET /plans` liefert Matrix und Preise aus dieser Quelle für die Preisübersicht und die Angebotstexte; das Frontend konsumiert nur diesen Endpoint und besitzt keine eigene Kopie der Matrix.

**Feature-Katalog und Entitlements.** Jede gegatete Funktion trägt einen stabilen Identifier (etwa `groups`, `voice_input`, `ai_assist`, `graph_write`, `location_reminders`, `mcp_readwrite`); die Rechte-Zentrale ordnet ihm die Pakete zu, bei KI-Funktionen zusätzlich das Kontingent. `/auth/me` liefert neben dem Plan die ausgewertete Entitlement-Map je Feature: erlaubt oder nicht, erforderliches Paket, bei KI der Kontingent-Rest. Ein einziger Request mit der Session beantwortet damit alle UI-Fragen in jedem Szenario; ein separater Batch-Endpoint ist nicht nötig. Das Frontend enthält keine Paketlogik, es rendert Badges, Angebote und Sperrzustände nur aus der Map. Eine reine Server-Korrektur genügt, um eine Funktion app-weit freizugeben oder zu sperren, ohne App-Release. Die Identifiers sind Teil des API-Vertrags (`openapi.yml`); die Zuordnung Bedienelement ↔ Identifier bleibt Code in der UI, die Paketregel dahinter liegt ausschließlich serverseitig. Der 403-/429-Body bleibt die harte Autorität im Aktionsmoment, falls die Map veraltet ist.

**Server-Gating.** Eine Guard-Factory prüft über den Feature-Identifier der Route gegen die Rechte-Zentrale und antwortet bei fehlendem Recht mit 403 und strukturiertem Body (`code: plan_required`, `feature`, `requiredPlan`, `currentPlan`). Dieser Body ist der Vertrag für die kontextuellen Angebote im Frontend. Lesezugriffe bleiben offen, damit die Sperr-statt-Löschen-Regel trägt.

**KI-Kontingent.** Eine Tabelle zählt LLM-Aufrufe je Nutzer und Monat (Schlüssel Jahr-Monat). Es zählen die fünf LLM-Routen; das reine Feedback zu Säulen-Vorschlägen (Speicherung ohne LLM-Call) zählt nicht. Bei Erschöpfung antwortet der Server 429 mit `code: quota_exhausted`; erfolgreiche Responses führen den Kontingent-Rest mit, damit das Frontend kurz vor dem Limit warnen kann.

**MCP-Deckel.** Der Plan begrenzt den erlaubten Token-Scope (Max: nur `read`; Ultimate: auch `readwrite`). Geprüft wird beim Anlegen und beim Scope-Umschalten der PATs sowie beim Schreibversuch über `tools/call` mit dem bestehenden lesbaren JSON-RPC-Fehler, ergänzt um einen Pakethinweis.

**Zahlung.** Buchen und Verwalten läuft über einen eigenen Routenbereich (`billing`) hinter einer schmalen Provider-Schnittstelle: Checkout, Webhook-Verarbeitung, Plan-Sync, Abo-Status. Upgrades wirken sofort, Downgrades zum Periodenende. Zahlungsdaten werden nie im eigenen System gespeichert, nur externe Referenzen.

**Downgrade.** Rechte entfallen, Daten bleiben. Die betroffenen Ansichten bleiben lesbar, die Bedienelemente führen auf das kontextuelle Angebot.

**Badges.** Die Frontend-Badge-Komponente rendert aus der Entitlement-Map in `/auth/me`, nicht aus eigener Logik: An jedem Bedienelement, das an einen Feature-Identifier gekoppelt ist, steht das Badge dauerhaft sichtbar; meldet die Map das Feature als erlaubt, zeigt sie einen grünen Haken statt des Info-Schalters. Ein Klick auf (i) öffnet das kontextuelle Angebot derselben Stelle.

**Vertrag und Tests.** Alle neuen Felder, Endpoints und Fehlerbodies werden in `openapi.yml` nachgezogen, die Client-Typen neu generiert. Server-Guards und Kontingent-Logik fallen unter die Coverage-Gates der Server-Logik. Die Frontend-Teile bekommen Vitest-Tests, die Grenzstellen zusätzlich e2e bei 375×812 nach der Mobile-First-Regel, KoliBri black-box.

## Teilaufgaben

Acht Teilaufgaben in fester Reihenfolge; jede baut auf der vorherigen auf (`blocked_by`). Die Felder entsprechen dem Ticket-Formular (`.github/ISSUE_TEMPLATE/ticket.yml`). Beim Anlegen als Issue werden die viertsten Überschriften dieser Sektion zu dritten (`###`) im Issue-Body. Das Anlegen folgt dem Muster von Epic #1340: ein Epic-Issue, die acht Tickets als Sub-Issues verknüpft, die Reihenfolge über `blocked_by`-Kanten.

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8
```

### Teilaufgabe T1: Plan-Datenmodell und Rechte-Zentrale

#### Was ist das Problem?

Am Nutzer gibt es kein Paket-Modell (`users` unterscheidet nur `role` admin/member), und es gibt keine zentrale Definition, welches Paket welches Feature enthält. Alle folgenden Teilaufgaben brauchen beides als Grundlage.

#### Wo tritt es auf?

```
server/src/models/user.ts
server/src/logics/plans.ts (neu)
server/src/express/routes/admin.ts
server/src/express/routes/auth.ts
server/src/express/apiTokenAuth.ts
server/database.ts (Migration)
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

`blocked_by`: T1. Die Sprachsteuerung hat keinen Server-Endpunkt (lokale Spracheingabe) und wird erst in T3 gegatet.

### Teilaufgabe T3: Frontend-Gating, Badges und kontextuelle Upgrade-Angebote

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

`blocked_by`: T2 (403-Vertrag). Die Textbausteine zentral pflegen, damit T4 und T7 sie wiederverwenden. Badges sind rein informativ, sie ersetzen das kontextuelle Angebot nicht und sperren nichts.

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

`blocked_by`: T3 (Angebots- und Warnkomponenten vorhanden). Basis der Werte: rund 18 % des Abopreises als Token-Budget.

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

`blocked_by`: T4. Das Zweistufenmodell (HTTP-Guard plus MCP-Layer) bleibt bestehen; die offenen MCP-Themen #1359, #1370 und #1414 bleiben unberührt.

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

`blocked_by`: T5. Zahlungsdaten werden nie im eigenen System gespeichert, nur externe Referenzen.

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

Die Übergangsregel wird umgesetzt (Empfehlung Grandfathering: Bestandsnutzer bleiben bis zum Payment-Start auf ihrem Übergangs-Tier, gesetzt per Admin-Migration; danach gilt Free als Default). Die kontextuellen Angebote werden scharf geschaltet. Paketmatrix und Preise werden veröffentlicht (Settings-Bereich, Benutzer-Doku). `user-guide.md` und `arc42.md` werden um die Monetarisierungsschicht ergänzt. Die Preisvalidierung wird abgeschlossen (Vergleichswerte Habitica ~5 €, Habitify ~2,50 €, Productive ~11 € monatlich) und die Kontingente nach erster Auswertung justiert.

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
