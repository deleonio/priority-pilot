# ADR 0014 — Paketgrenzen: Angebote in den Einstellungen statt Dialoge im Fluss

- **Status:** Accepted (2026-09-16)
- **Datum:** 2026-09-16
- **Kontext:** [Gesamtkonzept Monetarisierung](../gesamtkonzept-monetarisierung.md), Issue #1458 (T3a), Issue #1484 (T3b), Issue #1504 (UX-Wochenblick), PR #1488

## Kontext

Mit T3a (#1458) hat jede Bedienstelle, an der eine Paketgrenze verläuft, ein `PlanBadge` bekommen. Das Badge trägt einen (i)-Schalter, der ein `pp:plan-required`-Event feuert; darauf öffnet der globale `PlanOfferDialog` (`App.tsx`). Weil `docs/mobile-ui-rules.md` „Modal in Modal" als Anti-Pattern führt, schließt sich ein offenes Modal vorher selbst — `useClosingOnPlanRequired`, Entscheidung 7.1 zum Review von PR #1488. T3b (#1484) hat dieses Muster auf acht weitere Stellen ausgerollt.

Der UX-Wochenblick #1504 hat drei Folgen davon gemeldet, zwei davon in zwei aufeinanderfolgenden Wochen unverändert:

- In der Schnellerfassung verwirft ein Klick auf den (i)-Schalter den eingetippten Text, weil der Dialog dabei schließt. Das steht als bewusster Preis im Doc-Kommentar von `useClosingOnPlanRequired.ts` — gemeldet wurde also eine Entscheidung, kein Fehler.
- Im Aufgaben-Formular stehen zwei unbeschriftete „Pro"-Badges übereinander (Spracheingabe und Lektorat); vor dem Klick ist nicht erkennbar, welches Bedienelement gemeint ist.
- Der Säulen-Berater antwortet Free-Nutzern mit „Der KI-Dienst ist gerade nicht erreichbar". Ursache ist nicht ein fehlender Guard — `POST /pillars/advisor` hängt hinter `requirePlanFeature('ai_assist')` —, sondern der Rollout-Schalter `MONETIZATION_ENFORCED` (Default aus, `logics/plans.ts`). Die Anfrage läuft durch bis zum LLM, das auf der Inspect-Instanz fehlt.

Dahinter steht eine Frage, die T3a offengelassen hat: Wo gehört die Paketgrenze hin — in den Arbeitsfluss oder in die Einstellungen? Und welche Funktionen rechtfertigen überhaupt eine Grenze?

## Entscheidung

**1. Bezahlt wird, was Serverleistung kostet.** Eine Funktion, die rein lokal im Browser läuft, gehört in jedes Paket. Konkret: Die Spracheingabe (`VoiceField`, Web Speech API, kein Server-Endpunkt) wird Free. Das nimmt #1484 AK1 zurück. Kostenpflichtig bleiben Gruppen, Standort-Erinnerungen, der Aufgaben-Graph, die KI-Assistenz und der MCP-Zugriff.

**2. MCP bekommt zwei Grenzen statt einer.** Lesen ab Max (neues Feature `mcp_read`), Schreiben ab Ultimate (`mcp_readwrite`). Bisher kannte der Katalog nur die Schreibgrenze; lesender Zugriff war in keinem Paket begrenzt und fehlte deshalb auch in der Paket-Tabelle.

**3. Kein Angebots-Dialog mehr.** `PlanOfferDialog`, `useClosingOnPlanRequired` und das `pp:plan-required`-Event entfallen. Damit fallen AK5, AK7 und AK13 aus #1458 sowie Entscheidung 7.1 aus PR #1488 weg. Lehnt der Server eine Aktion mit 403 `plan_required` oder 429 `quota_exhausted` ab, nennt die Fehlermeldung Paket und Weg dorthin, in der Fehlerzeile der jeweiligen Ansicht.

**4. Badges bleiben, der (i)-Schalter geht.** An jeder sichtbaren Funktion bleibt ablesbar, zu welchem Paket sie gehört: mit grünem Häkchen, wenn sie im eigenen Paket enthalten ist, sonst mit dem Paketnamen. Das Badge selbst verlinkt auf den Pakete-Reiter; einen eigenen Info-Schalter gibt es nicht mehr.

**5. Gesperrte Funktionen erklären sich an ihrem Schalter, nicht im Fluss.** Die zugehörige Einstellungsseite bleibt erreichbar, ihre Bedienelemente sind deaktiviert, darüber steht ein Alert mit dem Angebot. So beim KI-Schalter (`SettingsPage`, Karte „KI-Funktionen") und bei den Access-Token (`ApiTokensSection`: Token anlegen ab Max, Schreibrechte ab Ultimate). Im Arbeitsfluss selbst wird eine nicht enthaltene Funktion gar nicht erst angeboten: Ohne KI-Berechtigung gibt es weder Schnellerfassung noch Berater noch Lektorat — dieselbe Regel, die #1080 für die Lektorat-Buttons schon anwendet.

**6. Die Preis-Matrix bleibt eine Tabelle.** Sie wird als `KolTableStateful` mit gesetzten Spaltenbreiten gebaut und scrollt auf schmalen Viewports seitlich, statt in Karten zu zerfallen. Das weicht bewusst von Mobile-Regel 3 ab („Tabellen werden auf Mobile zu Karten oder Definitionslisten umgebaut"): Eine Preis-Matrix vergleicht man spaltenweise, und die Karten-Darstellung zerreißt genau diesen Vergleich. Die Abweichung gilt nur für diese eine Tabelle.

**7. Der eigene LLM-Provider ist der Ausweg aus dem Kontingent.** Free bekommt kein KI-Kontingent. Wer ohne Abo KI nutzen will, hinterlegt einen eigenen Provider; solche Aufrufe kosten uns keine Serverleistung und werden nicht gegen ein Kontingent gebucht. Heute hängen Provider instanzweit an der Datenbank (`models/llmProvider.ts`, bewusst ohne `userId`) — das ist eigener Umfang und hat ein eigenes Ticket.

## Konsequenzen

- **Die drei gemeldeten UX-Funde verschwinden mit ihrer Ursache**, nicht durch eine Korrektur an der Oberfläche: ohne Dialog kein Textverlust, ohne KI-Berechtigung keine KI-Knöpfe und damit kein irreführender 503, mit der Spracheingabe in Free keine doppelten Badges im Aufgaben-Formular.
- **Der Rollout-Schalter verliert an Bedeutung.** Die Sichtbarkeit von Funktionen hängt künftig an der Entitlement-Map aus `GET /auth/me`, nicht am serverseitigen Blocken. `MONETIZATION_ENFORCED` steuert weiterhin, ob der Server Anfragen ablehnt; ob eine Funktion angeboten wird, entscheidet die Oberfläche unabhängig davon.
- **Entdeckbarkeit verschiebt sich von der Störung zur Beschriftung.** Wer eine Funktion nicht hat, stößt nicht mehr im Arbeitsfluss dagegen. Sichtbar bleibt sie über das Badge an verwandten Stellen und über die Paket-Tabelle. Das ist ein bewusster Verzicht auf den Moment des Bedarfs, den das Gesamtkonzept in Regel 3 beschreibt — er hat in der Umsetzung mehr Schaden angerichtet als Nutzen gestiftet.
- **Jede neue Grenzstelle wird billiger.** Es gibt keine Event-Verdrahtung und keine Dialog-Interaktion mehr zu bedenken, nur noch ein Badge und, falls es eine Einstellungsseite gibt, einen deaktivierten Schalter mit Alert.
- **Die Free-Stufe wird deutlich brauchbarer**, und die KI bleibt das einzige laufend kostenwirksame Unterscheidungsmerkmal. Ob Pro damit genug Argumente trägt, ist eine Produktfrage, die beim Launch (T8, #1463) erneut zu prüfen ist.
- **`mcp_read` ist eine Verschärfung gegenüber heute.** Bestehende Token von Free- und Pro-Nutzern verlieren mit der Durchsetzung ihren Lesezugriff. Der Rollout muss das wie einen Downgrade behandeln: sperren statt löschen, mit Hinweis in der Oberfläche.
- **Die Abweichung von Mobile-Regel 3 ist dokumentiert und begrenzt.** Ein Review, das die seitlich scrollende Preis-Matrix meldet, kann auf diesen Abschnitt verwiesen werden; jede weitere Tabelle bleibt an die Regel gebunden.
