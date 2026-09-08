FOKUS: Architektur-Doku docs/arc42.md gegen die Implementation. DIE IMPLEMENTATION IST DIE WAHRHEIT — die Doku beschreibt NUR den Ist-Zustand, und zwar aus ENTWICKLER-Sicht. KEINE Abstecher, KEINE Code-Änderungen. Token sparen: kurz, präzise, direkt.

KONTEXT: docs/arc42.md ist die Architekturübersicht des Monorepos nach der arc42-Struktur. Existiert die Datei (noch) nicht, ERSTELLST DU SIE COMPLETE in diesem Lauf — Erst-Erstellung und Sync sind derselbe Auftrag.

LEITLINIE (arc42-Prinzip): SO VIEL WIE NÖTIG, SO WENIG WIE MÖGLICH. Jeder Abschnitt hält nur langfristig relevante Architektur-Information — Transitorisches, Erledigtes, Redundantes ist Ballast und fliegt raus. Ein Datensatz, eine Wahrheit.

STRUKTUR-VERTRAG (unveränderlich, der Workflow prüft darauf): genau eine „# “-H1 am Dateianfang plus die zwölf nummerierten Abschnitte „## 1.“ bis „## 12.“:
  1. Einführung und Ziele · 2. Rahmenbedingungen · 3. Kontextabgrenzung · 4. Lösungsstrategie ·
  5. Bausteinsicht · 6. Laufzeitsicht · 7. Verteilungssicht · 8. Querschnittliche Konzepte ·
  9. Architekturentscheidungen (ADR) · 10. Qualitätsanforderungen · 11. Risiken und technische Schulden · 12. Glossar

METHODE (arc42-Skills — verbindlich, NICHT neu erfinden):
  - Aufbau, Inhalte und Qualitätskriterien jedes Abschnitts folgen den Skills unter .claude/skills/arc42-*:
    je Abschnitt arc42-section-01 … arc42-section-12 (Templates, Q42-Qualitätsziele mit messbaren Szenarien, Checklisten),
    Diagramm-Regeln aus arc42-mermaid; nach den Änderungen Querschnitts-Konsistenz via arc42-lint prüfen (manuelle
    Regeln, das Python-Skript existiert hier nicht) und Findings selbst beheben.
  - Detail-Level: ESSENTIAL (LEAN-Untergrenze: Q42-Qualitätsziele sind Pflicht, Skills-Regel).
  - HEADLESS-Übersteuerung: Die Skills stellen Rückfragen („Ask first“) und iterieren mit dem Nutzer. Stelle KEINE
    Fragen und warte NICHT — beantworte alles aus dem Code (die Implementation ist die Wahrheit). Was sich nicht aus
    dem Code belegen lässt (z. B. messbare Zahlen für Qualitätsszenarien, Stakeholder-Sign-off), kommt unter
    „Offene Unklarheiten“ in den Report, NICHT in den Text.
  - Toolkit-Konventionen, die hier nicht greifen (z. B. RISK-xx-Felder in §9-ADR-Verweisen — docs/adr/ hat eigenes
    Format), als Hinweis im Report führen statt sie zu erfinden.
  - Die Abschnitts-Templates der Skills gelten pro Abschnitts-Datei mit „# “-Titel — hier auf EINE Datei übertragen:
    Abschnittstitel als „## N. <deutscher Titel>“ (STRUKTUR-VERTRAG), Untergliederungen eine Ebene tiefer, Text deutsch.
  - Bei Konflikt gewinnen ABLAUF/CONSTRAINTS dieses Prompts; die Skills liefern die Methode je Abschnitt.

QUELLEN (liest selbst, nicht im Prompt wiederholen):
  - Ist-Zustand Frontend: frontend/src/** (App-Struktur, Komponenten, Libs, State-Muster)
  - Ist-Zustand Server: server/src/** (Module, Express-Routen, Logiken, Persistenz) + openapi.yml (API-Oberfläche)
  - Monorepo-Bausteine: package.json/pnpm-workspace.yaml (Workspaces, Skripte, Tech-Stack)
  - Entscheidungen: docs/adr/** (für §9 NUR Verweiste — ADR-Inhalte NICHT duplizieren)
  - Verteilung/Betrieb: docs/deployment.md und .github/workflows/** (CI/CD-Bausteine)
  - Breite Reads (Doku-Aussagen gegen den Code verifizieren) → `recherche`-Subagent-Rolle (ADR 0008); je Datei nur die Funde zurück in den Kontext.

ABLAUF (STRIKT):
  1. SOFORT starten. docs/arc42.md lesen, FEHLT die Datei: Struktur-Vertrag als Gerüst anlegen und aus dem Code füllen.
  2. JEDE architekturrelevante Aussage (Bausteine, Schnittstellen, Abläufe, Technologien, Qualitätsziele, Risiken) gegen den Code verifizieren; fehlende Abschnitte aus dem Ist-Stand ergänzen.
  3. NUR bei belegtem Befund anpassen:
     a) AKTUALISIEREN: Passage auf den neuen Ist-Zustand umformulieren.
     b) ENTFERNEN: Aussage ohne langfristigen Architektur-Wert streichen — beschriebene Bausteine/Schnittstellen, die es nicht mehr gibt, komplett raus.
     c) ERGÄNZEN: im Code sichtbare Architektur (Bausteine, Schnittstellen, Muster), die in KEINEM Abschnitt steht, im passenden Abschnitt ergänzen.
  4. ALLE Änderungen lokal committen (ein Commit genügt): git add docs/arc42.md && git commit -m "docs(arc42): Ist-Stand-Sync {{SYNC_DATE}}"
     NICHT pushen, KEINEN PR anlegen — das macht der Workflow nach dir.
  5. Report schreiben nach /tmp/arc42-sync-report.md (Markdown): je Abschnitt ein Abschnitt (arc42-Abschnitt, Befund, Korrektur, Beleg im Code als Datei:Zeile), plus Liste offener Unklarheiten (nicht aus Code Ableitbares: NICHT geändert, nur gelistet).

STIL (die Doku ist Entwickler-Prosa):
  - Deutsch, sachlich — wie die bestehende Doku in docs/.
  - Diagramme NUR als Mermaid.js inline in Markdown — nie PlantUML, nie ASCII-Art für Diagramme (Baustein-/Laufzeit-/Kontextsicht).
  - KEINE Soll-/Absichts-/Ankündigungs-Formulierungen — nur Ist.
  - KEINE Änderungs-Historie: kein „wurde geändert“, kein „seit/neu/jetzt“ im Sinne von „früher war es anders“ — die Doku beschreibt den aktuellen Zustand, als gäbe es nie einen anderen.
  - §9 listet NUR Verweise auf docs/adr/ (Nummer + Titel + Status) — der Langtext lebt allein im ADR.
  - Vermenschlicht schreiben (skill:vermenschlichen):
    KEINE Werbesprache, keine Bedeutungsaufblähung, keine "nicht nur … sondern auch"-Konstruktionen,
    keine Fazit-/Herausforderungen-Abschnitte, kein Schema "Fett: Erklärung", keine gehäuften
    Gedankenstriche, schlichte Verben statt steifer Synonyme, keine Synonym-Rotation, keine
    Chatbot-Reste ("Ich hoffe, das hilft"), keine Emojis in sachlichen Texten.

CONSTRAINTS:
  - NUR docs/arc42.md ändern — kein Code, keine anderen Dokumente, KEINE ADR-Dateien.
  - KEINE Spekulation: nur belegbare, im Code sichtbare Architektur beschreiben.
  - STRUKTUR-VERTRAG einhalten: genau eine H1, die zwölf nummerierten „## “-Abschnitte bleiben vollständig und in Nummernfolge — auch bei Erst-Erstellung.

VERDICT (one line):
  - VERDICT: synced
  - VERDICT: updated
  (synced = keine Drift gefunden, kein Commit; updated = Doku-Korrekturen committed)

EHRLICHKEITS-REGEL: VERDICT: updated NUR ausgeben, wenn der Commit existiert (git log verifizieren). VERDICT: synced NUR ohne lokale Commits.

ZEITLIMIT: Soft-Deadline = {{SOFT_DEADLINE}}. Vor jedem Schritt: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. Bei OVER: committen was vorliegt, Report schreiben, Turn beenden.
