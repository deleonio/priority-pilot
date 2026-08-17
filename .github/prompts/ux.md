FOKUS: NUR Issue #ISSUE_NR. UX/UI-Review NACH der Spec, VOR der Umsetzung. Du arbeitest im vorhandenen Spec-Branch — KEIN neuer Branch, KEIN neuer PR. KEINE Abstecher. Token sparen: kurz, präzise, direkt.

MASSSTAB: `.ai-knowledge/ux-design.md` (Design-Sprache „Cockpit") ist die verbindliche Referenz. Mobile-First-Regeln stehen in `.ai-knowledge/conventions.md`. Bei Unsicherheit über KoliBri-Komponenten: KoliBri-MCP (`mcp__kolibri-mcp__search` / `mcp__kolibri-mcp__fetch`, z. B. `spec/button`) statt raten.

ABLAUF (STRIKT):
  1. SOFORT starten.
  2. Kontext laden:
     - Issue-Body: gh issue view ISSUE_NR --json body -q .body
     - Spec (falls vorhanden): docs/spec/issue-ISSUE_NR.md
     - Maßstab: .ai-knowledge/ux-design.md
  3. Spec-Branch auschecken (NICHT neu anlegen):
     PR="$(bash .github/scripts/pr-for-issue.sh --repo "$GITHUB_REPOSITORY" --issue ISSUE_NR --draft yes --out first)"
     Kein PR gefunden → kein Code-Anteil, nur Schritt 4 + VERDICT.
     Sonst: HEAD="$(gh pr view "$PR" --json headRefName -q .headRefName)"; git fetch origin && git switch "$HEAD"
  4. UX-ANFORDERUNGEN in den Issue-Body schreiben, zwischen <!-- KI-UX:START --> und <!-- KI-UX:END -->.
     Formuliere PRÜFBAR ("Touch-Ziel ≥ 44px", nicht "gut bedienbar"). Abschnitte:
     - **Interaktion**: User-Flow, Klickziele, Rückmeldung (Lade-, Leer-, Fehlerzustand)
     - **Mobile-First**: Verhalten bei 375px, Bruchpunkte, Touch-Ziele
     - **A11y/BITV**: Tastatur, Fokusreihenfolge, Screenreader/ARIA, Kontrast
     - **KoliBri**: konkrete Komponentenwahl statt rohem HTML
     - **Design-Sprache**: Tokens/Skalen aus ux-design.md, die hier gelten (Farbrolle, Abstand, Typo)
     - **Offene UX-Fragen**: nur, wenn eine Entscheidung wirklich fehlt
  5. VERTRAG ERWEITERN (der eigentliche Hebel — Beratung allein wirkt nicht):
     Je UX-Anforderung, die dauerhaft gelten soll, einen ROTEN e2e-Test in frontend/e2e/ ergänzen.
     - VORAB-Dedup: prüfe die bestehenden Specs, ob die Zusicherung schon existiert. Aufnahmekriterium
       aus .ai-knowledge/tdd-strategy.md gilt unverändert (auswerten / spiegeln / vor stillem Ausfall
       schützen) — Minimalprinzip vor Vollständigkeit.
     - Mobile-Fälle bei page.setViewportSize({ width: 375, height: 812 }) mit der Overflow-Zusicherung
       (element.scrollWidth <= window.innerWidth). Muster: frontend/e2e/login.spec.ts, frontend/e2e/task-tree.spec.ts.
     - Die Tests der Spec-Phase NICHT umschreiben — nur ergänzen (Gewaltenteilung).
  6. FIX IM RAHMEN DES TICKETS:
     Verstöße gegen die Design-Sprache an der vom Ticket berührten UI direkt korrigieren
     (rohes <button>/<input>/<table>/<h1> → KoliBri-Komponente, Hex-Wert → Token, freier Abstand → Skala).
     Alles darüber hinaus gehört NICHT in diesen PR: als Zeile in den KI-UX-Block schreiben ("außerhalb
     des Tickets: …") und liegen lassen.
  7. ABSICHERN & PUSHEN:
     pnpm format && pnpm lint && pnpm --filter frontend test
     (e2e wird hier NICHT ausgeführt — keine Playwright-Browser in dieser Phase; das macht ci.yml.
      Die neuen e2e-Tests sollen rot sein, format/lint/Unit-Tests müssen sauber sein.)
     git commit + git push in den Spec-Branch. KEIN neuer PR, KEIN Merge.

⚠️ LABELS: KEINE Labels setzen! Workflow übernimmt das automatisch.

EHRLICHKEITS-REGEL: Berichte nur, was du wirklich getan hast. Kein Code geändert → sag das. Test nicht
geschrieben → sag das. Ein geschöntes VERDICT ist schlimmer als ein ux-not-ready.

VERDICT: GANZ AM ENDE GENAU EINE Zeile:
  - VERDICT: ux-ready (UX-Anforderungen im Issue, ggf. Tests/Fixes gepusht → bereit zur Umsetzung)
  - VERDICT: ux-not-ready (UX unklar – braucht Klärung vor der Umsetzung)

ZEITLIMIT: Soft-Deadline = SOFT_DEADLINE. Vor jedem Schritt: [ $(date +%s) -ge SOFT_DEADLINE ]. Bei OVER: aktuellen Stand committen/pushen, Rest im Issue-Body vermerken, Turn beenden.
