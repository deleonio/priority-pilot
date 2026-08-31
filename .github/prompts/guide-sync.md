FOKUS: Handbuch-Sync docs/user-guide.md gegen die Implementation. DIE IMPLEMENTATION IST DIE WAHRHEIT — das Handbuch beschreibt NUR den Ist-Zustand, und zwar aus ENDNUTZER-Sicht. KEINE Abstecher, KEINE Code-Änderungen. Token sparen: kurz, präzise, direkt.

KONTEXT: docs/user-guide.md IST die Hilfe-Seite der App (vite.config.ts liefert sie unter /user-guide.md aus, HelpPage.tsx rendert sie als Markdown). Jede Zeile darin liest ein Endnutzer in der App.

QUELLEN (liest selbst, nicht im Prompt wiederholen):
  - Handbuch: docs/user-guide.md
  - Ist-Zustand UI: frontend/src/** (Komponenten, Dialoge, Buttons, Routen in App.tsx, sichtbare Meldungstexte, Tastaturkürzel)
  - Ist-Zustand Server: server/src/** (Push-Benachrichtigungen, LLM-/Einstellungs-Verhalten, Allowlist-/Fehlermeldungen) + openapi.yml (welche Funktionen es überhaupt gibt)
  - Querbeleg für beobachtbares Verhalten: frontend/e2e/*.spec.ts und docs/spec/user-journeys.md

ABLAUF (STRIKT):
  1. SOFORT starten. docs/user-guide.md vollständig lesen.
  2. JEDE nutzersichtbare Aussage (Ablaufbeschreibungen, Button-/Menü-Bezeichnungen, Meldungstexte, Tastaturkürzel, Randfälle) gegen den Code verifizieren.
  3. NUR bei belegter Abweichung das Handbuch anpassen:
     a) Verhalten hat sich geändert → Beschreibung auf den neuen Ist-Zustand umformulieren.
     b) Beschriebene Funktion existiert nicht mehr → Absatz/Abschnitt STREICHEN.
     c) Implementiertes Nutzer-Feature fehlt im Handbuch → ERGÄNZEN, im Stil und an der passenden Stelle der bestehenden Gliederung.
  4. ALLE Änderungen lokal committen (ein Commit genügt): git add docs/user-guide.md && git commit -m "docs(guide): Ist-Stand-Sync {{SYNC_DATE}}"
     NICHT pushen, KEINEN PR anlegen — das macht der Workflow nach dir.
  5. Report schreiben nach /tmp/guide-sync-report.md (Markdown): je Fund ein Abschnitt (Handbuch-Abschnitt, Befund, Korrektur, Beleg im Code als Datei:Zeile), plus Liste offener Unklarheiten (nicht aus Code Ableitbares: NICHT geändert, nur gelistet).

STIL (das Handbuch ist Endnutzer-Prosa, kein Entwicklerdokument):
  - Deutsch, Du-Form, freundlich-sachlich — wie der bestehende Text.
  - KEINE Datei-/Komponentennamen, KEINE API-Pfade, KEIN Implementierungsjargon.
  - Mobile-First: beschreibe, was der Nutzer sieht und antippt.
  - Bestehende Gliederung/Abschnittsreihenfolge beibehalten, nicht ohne Befund umbauen.
  - Vermenschlicht schreiben (skill:vermenschlichen):
    KEINE Werbesprache, keine Bedeutungsaufblähung, keine "nicht nur … sondern auch"-Konstruktionen,
    keine Fazit-/Herausforderungen-Abschnitte, kein Schema "Fett: Erklärung", keine gehäuften
    Gedankenstriche, schlichte Verben statt steifer Synonyme, keine Synonym-Rotation, keine
    Chatbot-Reste ("Ich hoffe, das hilft"), keine Emojis in sachlichen Texten.

CONSTRAINTS:
  - NUR docs/user-guide.md ändern — kein Code, keine anderen Dokumente.
  - KEINE Spekulation: nur belegbares, im Code sichtbares Verhalten beschreiben.
  - KEINE Soll-/Absichts-/Ankündigungs-Formulierungen — nur Ist.
  - KEINE Änderungs-Historie: kein „wurde geändert“, kein „seit/neu/jetzt“ im Sinne von „früher war es anders“ — das Handbuch beschreibt den aktuellen Zustand, als gäbe es nie einen anderen.
  - PFLICHT-ABSCHNITTE (Vertrag aus server/src/logics/user-guide.test.ts, AK 2.1–2.9): Dashboard, "Aufgaben verwalten", (KI-)Schnellerfassung, Abhängigkeiten, Säulen, Aufgabenwald, Serien, Punkte/Gamification, Kopf-/Header-Aktionen. Diese Themen dürfen NICHT wegfallen und ihre Überschriften-Stichwörter NICHT verschwinden. Genau eine "# "-H1 am Dateianfang bleibt bestehen.

VERDICT (one line):
  - VERDICT: synced
  - VERDICT: updated
  (synced = keine Drift gefunden, kein Commit; updated = Handbuch-Korrekturen committed)

EHRLICHKEITS-REGEL: VERDICT: updated NUR ausgeben, wenn der Commit existiert (git log verifizieren). VERDICT: synced NUR ohne lokale Commits.

ZEITLIMIT: Soft-Deadline = {{SOFT_DEADLINE}}. Vor jedem Schritt: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. Bei OVER: committen was vorliegt, Report schreiben, Turn beenden.
