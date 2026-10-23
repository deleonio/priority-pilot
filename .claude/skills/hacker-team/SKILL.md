---
name: hacker-team
description: "Hacker-Team — monthly adversarial security run: six attacker perspectives (data thief, manipulator, authorization breaker, saboteur, protocol/interface specialist, client/session specialist) boot a local throwaway instance of the system and attack it for real — steal, tamper, escalate, break — then chain the reproduced primitives and report every breach with evidence. Use for 'hacker-team', 'Angriffslauf', 'pentest the app' (German: monatlicher Hacker-/Rot-Team-Lauf)."
---

# Method: Hacker-Team (monthly adversarial security run)

A recurring red-team run. The run prompt supplies the attack environment (how the local
instance boots, how sessions are minted), the goal sources (what counts as a breach) and the
report target; this file carries the method only. The team attacks — it does not fix, does not
commit, does not label, does not comment; the run's GitHub side effects are handled outside.

## Spielregeln (bindend, vor jedem Angriff)

- **Nur die lokale Wegwerf-Instanz** aus dem Lauf-Prompt (localhost). Keine Angriffe gegen
  Produktivsysteme, fremde Hosts oder Netze; gescannt wird nichts außer den genannten lokalen
  Ports.
- **Keine echten Credentials, keine echten Nutzerdaten.** Die Instanz startet ohne echte
  Secrets auf einer In-Memory-DB; Opferdatensätze erzeugt das Team selbst über die API.
  Externe Provider (Google, PayPal, Play, LLM) sind in dieser Umgebung nicht erreichbar — ihre
  Flächen werden nur quelltextlich beurteilt, nie live angegriffen.
- **Zerstörung ist erlaubt** — die Instanz ist Wegwerf. Nach einem Crash: erst den Beweis
  sichern (Log-Auszug, letzte Anfrage), dann die Instanz mit dem Befehl aus dem Lauf-Prompt
  neu starten und weiterarbeiten.
- Der Server-Code wird **gelesen, nie verändert**: Angriffe laufen schwarz/grau von außen
  (HTTP, Browser).

## Perspektiven

Play six attacker perspectives in one moderated session; the moderator (you) collects,
verifies, ranks und komponiert die bestätigten Primitive am Ende zu einer Kette (Haltung). Every
perspective jagt ihr eigenes Ziel — die Sicherheitsziele (Vertraulichkeit, Integrität,
Verfügbarkeit + Zugriffskontrolle) sind die Zielscheiben:

1. Datendieb (Vertraulichkeit) — Fremddaten lesen: Routen mit IDs ohne Eigentümer-Bindung
   (IDOR/BOLA), Export- und Teilen-Endpunkte, Fremddaten in Fehlermeldungen, Logs und
   Listen-Antworten, Durchsickern gelöschter Daten.
2. Manipulator (Integrität) — Fremddaten und Systemzustand verändern: Validierungslücken,
   Mass Assignment (Fremd-Felder wie Rolle/Plan in Payloads), Injection (SQL über Filter und
   Sortierungen, gespeichertes XSS), Manipulation von Plänen, Quoten und Abrechnungszustand.
3. Berechtigungs-Knacker (Zugriffskontrolle) — die Mauern überwinden: Sessions fälschen,
   fixieren oder übernehmen, Cookie-Flags, fehlende Auth-/Rollen-/Plan-Prüfungen an Routen,
   Rechte-Eskalation (member → admin, free → pro), Admin-Flächen, Wartelisten-Gate.
4. Saboteur (Verfügbarkeit) — den Dienst unbrauchbar machen: Prozess-Crashes, blockierende
   Endlosschleifen, unbeschränkte Nutzlasten (Riesen-Strings, tiefe JSON-Nester, Massen-Requests),
   destruktive Sammel-Operationen ohne Sicherung, Race Conditions auf Zähler und Quoten.
5. Schnittstellen-/Protokoll-Spezialist (Spiegel-Fläche) — die maschinenlesbare Zweit-Tür neben
   der REST-Fläche: die nur-lesende und die schreibende Werkzeug-Fläche sowie der Token-Layer, über
   den Clients ohne Browser zugreifen. Jagt, ob *jede* Prüfung der ersten Tür an ihrem Spiegel
   erneut greift: Schreib-Werkzeuge mit nur-lesendem Token, Admin-Werkzeuge mit Member-Token,
   Scope-Wechsel am Token, abgelaufene/widerrufene Tokens, Rollen- und Plan-Prüfung je nach
   Zugangsweg (Browser-Session vs. Token) — die Differenz zwischen den Wegen ist die Lücke.
6. Client-/Session-Spezialist (Browser-Fläche) — die Sitzung selbst angreifen: CSRF (Double-Submit,
   Header-/Kanal-Umgehung), Session-Fixierung und -Übernahme, Cookie-Flags (httpOnly/secure/
   sameSite), Open Redirect auf Rückkehr- und Zahlungs-Flows, Clickjacking/CSP, gespeichertes XSS,
   das einen *fremden* Nutzer erreicht.

## Technik

Zwei Denkwerkzeuge, keine Checkliste — sie schärfen die Angriffe der Perspektiven:

- **Differenz-Test:** dieselbe Anfrage mehrfach mit nur einer geänderten Berechtigung schicken (free
  vs. plus, member vs. admin, Eigentümer vs. Fremder). Das Delta zeigt, welche Prüfung fehlt — nicht
  die einzelne Antwort.
- **Spiegel-Prüfung:** jede Fläche, die eine andere spiegelt (Protokoll↔REST, Member↔Admin,
  Token↔Session), muss dieselbe Prüfung durchsetzen. Den Spiegel angreifen, nicht nur das Original —
  eine Mauer, die nur an einer Tür steht, ist keine Mauer.

## Verfahren

1. Bestand: read the previous report (if the run prompt carries an issue number) and take over
   its open findings with their numbers; list open issues and open pull requests as the dedup
   inventory — a breach that belongs to known open work is a status note, not a new finding.
2. Angriffsgrundlage: verify the local instance per the run prompt; mint at least two sessions
   (attacker and victim accounts) and seed recognizable victim data through the API.
3. Aufklärung: read the attack surface code — routes, middleware, guards — and build the
   attack map: which route is protected by what, where ownership, role and plan are checked.
   The map steers the attacks; it does not replace them.
4. Angriffe: every perspective attacks through HTTP and, where rendering matters, the
   browser. Log every attempt: method, path, headers/body, status, response excerpt. A failed
   attack is a result (`bestanden`), not an embarrassment and not a finding.
5. Konsolidierung: only reproduced breaches become findings; rank by damage an attacker
   actually gains (account boundary crossed > own-account annoyance), drop duplicates, resolve
   carry-over statuses.
6. Kette: aus den bestätigten Primitiven den kürzesten Weg vom niedrigsten Privileg zum größten
   Schaden zusammensetzen (Start → Eskalation → überschrittene Account-Grenze). Trägt die Kette
   weiter als jedes Einzelglied, ist sie Rang 1, mit vollständiger Repro jedes Gliedes. Keine Kette
   erzwingen, wenn die Glieder nicht wirklich aneinander anschließen.
7. Bericht.

## Belege

Every finding carries the full reproduction: the concrete request(s) with the observed
response (status and body excerpt) and the code location of the missing or weak check
(`Datei:Zeile`). What was not reproduced is at most an `unklar` row in the target check —
never a Schwachstelle. The report must survive a skeptical reader who re-runs the attack.

## Ergebnis

Write the report in German (readers are the German-speaking maintainers) in the structure the
run prompt prescribes. Carry-over items keep their status (offen / umgesetzt / weggefallen);
`umgesetzt` is only allowed after re-verification in this run. Provide at most three
Umsetzungs-Kandidaten, each small enough to become one ticket, drafted in the issue-template
structure so a maintainer can paste it directly.

## Haltung

Denken wie ein Angreifer mit Frist, nicht wie ein Prüfer mit Checkliste: Das Team sucht den
kürzesten Weg zum Schaden, nicht die vollständige Abdeckung. Ehrlichkeit schlägt Drama: ein
fehlgeschlagener Angriff wird als gehärtet vermerkt, eine Lücke ohne Repro wird nicht
behauptet. Ein Lauf ohne einzige bestätigte Schwachstelle ist ein gültiges Ergebnis — sag es
klar statt Findings aufzublähen. Das Minimalprinzip gilt auch hier: der Bericht nennt die
Lücke und den kürzesten Fix, keine Security-Vorträge. Der stärkste Beweis ist selten ein
Einzelbefund, sondern die Kette: zwei kleine Nachlässigkeiten, die zusammen eine Account-Grenze
überschreiten, schlagen jede isolierte Auffälligkeit.
