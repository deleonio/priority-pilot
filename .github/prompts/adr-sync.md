FOKUS: ADR-Konsolidierung in docs/adr/ — aufsteigend, NEUERE ENTSCHEIDUNG SCHLÄGT ÄLTERE. KEINE Abstecher, KEINE Code-Änderungen. Token sparen: kurz, präzise, direkt.

ZWECK: superseded ADRs zu Stubs kürzen — der Arbeitsbaum zeigt nur die aktuelle Wahrheit
(Archiv = Git-Historie).

QUELLEN (liest selbst, nicht im Prompt wiederholen):
  - Alle ADRs aufsteigend: docs/adr/0001*.md bis zur höchsten Nummer
  - Supersession-Ketten: Status-Zeilen + Querverweise der ADRs untereinander
  - Index: ADR-Liste in AGENTS.md (nur lesen — NICHT ändern, der Workflow-Pflege-Teil des
    Knowledge-Graph-Skills gehört nicht zu diesem Lauf)

ABLAUF (STRIKT):
  1. SOFORT starten. Alle ADR-Dateien aufsteigend lesen und die Supersession-Kette notieren:
     Wer ersetzt wen (Status: Superseded … durch ADR NNNN)?
  2. JEDES als Superseded markierte ADR prüfen: Ist es bereits ein Stub (Nachfolger-Verweis
     vorhanden UND unter ~40 Zeilen)? Wenn NEIN → STUBBEN (Format unten).
  3. Stubs sind die EINZIGE Kürzung. Aktive ADRs werden inhaltlich NICHT angetastet — auch
     nicht, wenn ihre Beispiele alt klingen. Der Sync konsolidiert mechanisch, er trifft
     keine Entscheidungen.
  4. Widersprüche zwischen AKTIVEN ADRs (beide ohne Superseded-Status): NICHT auflösen,
     NICHT ändern — als Konflikt im Report listen (ADR-Nummern, je ein Zitat mit Abschnitt,
     ein Lösevorschlag). VERDICT conflict, wenn mindestens einer existiert.
  5. Änderungen lokal committen (ein Commit genügt):
     git add docs/adr && git commit -m "docs(adr): Konsolidierungs-Sync {{SYNC_DATE}}"
     NICHT pushen, KEINEN PR anlegen — das macht der Workflow nach dir.
  6. Report nach /tmp/adr-sync-report.md (Markdown): je geändertem ADR ein Abschnitt
     (Datei, Befund, Maßnahme, Beleg-Zeile), danach die Konfliktliste (oder „keine“).

STUB-FORMAT (verbindlich — Status-Zeile ASCII-sauber, maschinenlesbar):
  ```markdown
  # ADR NNNN — <Titel unverändert, Links/Anker bleiben stabil>

  - **Status:** Superseded (YYYY-MM-DD) durch [ADR NNNN](<dateiname>.md)
  - **Datum:** YYYY-MM-DD

  <Ein Absatz Kern: WAS damals entschieden wurde (ohne Begründungs-Detail)>.

  Ersetzt, weil <ein Satz: was das Nachfolge-ADR anders entscheidet>.
  Volltext dieser Entscheidung: `git show <letzter-voller-SHA>:<dateipfad>`
  (SHA via `git rev-list -1 HEAD -- <dateipfad>` vor dem Stubben ermitteln).
  ```

CONSTRAINTS:
  - NUR docs/adr/*.md ändern — kein Code, keine anderen Dokumente, kein AGENTS.md.
  - Titel (H1) jedes ADR unverändert lassen: Dateiübergreifende Links und Anker brechen sonst.
  - Keine Entscheidungen erfinden, aufheben oder umdeuten — Supersession nur dort, wo der
    Status es bereits besagt. Zweifel ohne klaren Status → Konfliktliste, keine Änderung.
  - Die Status-Zeile bleibt ASCII (keine Umlaute/typografischen Anführungszeichen).

VERDICT (one line):
  - VERDICT: synced
  - VERDICT: updated
  - VERDICT: conflict
  (synced = nichts zu ändern, keine Konflikte; updated = Stubs/Konsolidierung committed;
   conflict = mindestens ein Konflikt AKTIVER ADRs im Report — Commits können daneben stehen)

EHRLICHKEITS-REGEL: VERDICT: updated NUR ausgeben, wenn der Commit existiert (git log verifizieren). VERDICT: synced NUR ohne lokale Commits. VERDICT: conflict NUR mit mindestens einem gelisteten Konflikt aktiver ADRs.

ZEITLIMIT: Soft-Deadline = {{SOFT_DEADLINE}}. Vor jedem Schritt: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. Bei OVER: committen was vorliegt, Report schreiben, Turn beenden.
