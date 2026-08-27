FOKUS: Spec-Sync docs/spec/ gegen die Implementation. EIN Sammel-PR über alle Dateien mit ai:needs-review. DIE IMPLEMENTATION IST DIE WAHRHEIT — die Spec beschreibt NUR den Ist-Zustand. KEINE Abstecher, KEINE Code-Änderungen. Token sparen: kurz, präzise, direkt.

LEITLINIE (arc42-Prinzip): SO VIEL WIE NÖTIG, SO WENIG WIE MÖGLICH. Specs halten nur langfristig relevantes, von außen sichtbares Verhalten fest — alles andere (Transitorisches, Erledigtes, Redundantes) ist Ballast und fliegt raus. Ein Datensatz, eine Wahrheit.

QUELLEN (liest selbst, nicht im Prompt wiederholen):
  - Specs: alle Dateien unter docs/spec/ (user-journeys.md + issue-*.md)
  - Ist-Zustand: frontend/src/** (UI-Verhalten, Dialoge, Meldungstexte), server/src/** + openapi.yml (API, Validierung, Fehlermeldungen)

ABLAUF (STRIKT):
  1. SOFORT starten. Alle Dateien unter docs/spec/ vollständig lesen.
  2. DATEI-TRIAGE (billig zuerst): JEDE Datei auf langfristigen Spec-Wert prüfen. GANZE DATEI ENTFERNEN, wenn
     a) sie per Art kein Spec-Wert ist (manuelle Test-Protokolle, Validierungs-Platzhalter, Soll-/Arbeits-Stände zu abgeschlossenen Tickets), oder
     b) ihr Inhalt vollständig in anderen Spec-Dateien abgebildet ist → Redundanz an EINER Stelle halten (dort konsolidieren, Rest löschen).
  3. JEDE verhaltensrelevante Aussage (Journey-Schritte, erwartete Ergebnisse, Randfall-Tabellen, Meldungstexte) der verbleibenden Dateien gegen den Code verifizieren. ZIEL: ALLE Dateien schaffen.
  4. NUR bei belegtem Befund die Spec anpassen — jede Operation gilt für Textpassagen UND, wo zutreffend, ganze Dateien:
     a) AKTUALISIEREN: Passage (oder ganze Datei) auf den neuen Ist-Zustand umformulieren.
     b) ENTFERNEN: Passage ohne langfristigen Spec-Wert streichen — insb. transitorische Soll-Aussagen („X soll entfernt werden“, Ankündigungen, Absichten, Ticket-Historie). Ganze Dateien: siehe DATEI-TRIAGE.
     c) ERGÄNZEN: implementiertes Verhalten, das in KEINER Spec steht → neue Journey in der passenden Datei; nur bei eigenständig abgrenzbarem Verhaltenbereich eine NEUE DATEI (Format wie user-journeys.md: Ziel/Vorbedingung/Schritte/Erwartetes Ergebnis; implementierungsagnostisch, nur von außen beobachtbares Verhalten).
  5. Je geänderter/neuer Datei: „**Stand:**“-Datum auf {{SYNC_DATE}} setzen. KEINE Versionszeilen — existierende „**Version:**“-Zeilen und „## Versionierung“-Abschnitte ENTFERNEN: Änderungshistorie erzählt git/PR, die Spec beschreibt nur den Ist-Zustand.
  6. ALLE Änderungen lokal committen (ein Commit genügt): git add docs/spec && git commit -m "docs(spec): Ist-Stand-Sync {{SYNC_DATE}}"
     NICHT pushen, KEINE PRs anlegen — das macht der Workflow nach dir (Sammel-PR mit ai:needs-review).
  7. Report schreiben nach /tmp/spec-sync-report.md (Markdown), STRENG nach Datei gegliedert — der Workflow baut daraus die PR-Beschreibung:
     - Pro betroffener Datei ein Abschnitt mit Überschrift „## <dateiname>“ (exakt der Dateiname, z. B. „## user-journeys.md“): darunter je Fund (Abschnitt, Befund, Korrektur — auch entfernte Dateien mit Begründung).
     - Am Ende ein Abschnitt „## Nicht verifiziert“: Dateien, die du nicht mehr geschafft hast (leer lassen, wenn alle geschafft).
     - Danach ein Abschnitt „## Offene Unklarheiten“: nicht aus Code Ableitbares — NICHT geändert, nur gelistet.

CONSTRAINTS:
  - NUR innerhalb docs/spec/ Dateien ändern oder LÖSCHEN — kein Code, keine anderen Dateien.
  - Konsolidieren/Umbenennen nur bei belegter Redundanz, sonst keine Umstrukturierung.
  - KEINE Spekulation: nur belegbares, im Code sichtbares Verhalten spezifizieren.
  - KEINE Soll-/Absichts-Formulierungen in der Spec — nur Ist.
  - KEINE Änderungs-Historie im Text: kein „wurde geändert/entfernt/ergänzt“, kein „seit #X“, kein „gilt nicht mehr“, kein „früher“ — nur Aussagen über den aktuellen Ist-Zustand, als gäbe es nie einen anderen.

VERDICT: GANZ AM ENDE GENAU EINE Zeile, NUR der Token — kein Text dahinter (der Workflow parst die Zeile maschinell):
  - VERDICT: synced
  - VERDICT: updated
  (synced = keine Drift gefunden, kein Commit; updated = Spec-Korrekturen committed)

EHRLICHKEITS-REGEL: VERDICT: updated NUR ausgeben, wenn der Commit existiert (git log verifizieren). VERDICT: synced NUR ohne lokale Commits.

ZEITLIMIT: Soft-Deadline = {{SOFT_DEADLINE}}. Vor jedem Schritt: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. Bei OVER: committen was vorliegt, Report schreiben, Turn beenden.
