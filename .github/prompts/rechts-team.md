FOCUS: weekly compliance advisory for website, web app, Android app and subscriptions (team-of-perspectives method, see METHOD). Judge whether the legal framework obligations are visibly and correctly served on every surface: DSGVO, Impressum/Transparenz, Verbraucherrechte im Abo, Plattform- und Barrierefreiheits-Pflichten. ONLY analysis + report — NO file changes, NO commit, NO label, NO issue, NO comment (the workflow does the GitHub side effects after you). Your findings are HINTS for human (or legal counsel) review — never declare a surface legally sound. Save tokens: short, precise, direct.

METHOD: read and follow .claude/skills/rechts-team/SKILL.md (four perspectives, procedure, evidence rules, principles). The report skeleton below is binding.

GOAL SOURCES (business intent you judge against — read them fully yourself, fresh state):
  1. docs/adr/0013-zahlungsweg-paypal-abos.md
  2. docs/adr/0014-paket-angebote-ohne-dialog.md
  3. docs/adr/0015-oeffentliche-website-und-app-unter-app.md
  4. docs/adr/0017-store-billing-google-play.md
  5. docs/adr/0018-preismodell-free-plus-pro.md
  6. docs/adr/0019-zugang-launch-warteliste.md
  7. docs/gesamtkonzept-monetarisierung.md
  8. server/src/logics/plans.ts — Preis-Single-Source (keine Kopie, das Original)
  9. docs/matomo.md — cookielose Reichweitenmessung

WORK SOURCES (the shipped legal surface — read fresh):
  10. website/src/terms.ts, website/src/privacy.ts, website/src/withdrawal.ts, website/src/cancellation.ts — die Rechtstexte selbst
  11. website/src/i18n/de.json und en.json — rechtsrelevante Strings (Preise, Paketnamen, Signup-/Checkout-Formulierungen)
  12. frontend/src — wo Rechtsseiten/Links, Konto-Löschung, Datenexport und Paywall verdrahtet sind (zuerst greppen: terms, privacy, impressum, widerruf, loeschen, export)

ORDER:
  1. BESTAND FIRST: if {{RECHTS_ISSUE_NR}} is not 0, read the body of issue {{RECHTS_ISSUE_NR}} (previous report) and list its carry-over items. Then run `gh issue list --state open --limit 200 --json number,title,labels` and keep the titles as the open-work dedup list.
  2. read ALL goal sources, then the work sources. Batch them in ONE tool block (AGENTS.md "Turns bündeln").
  3. LIVE WALKTHROUGH: the app runs at http://localhost:4174 (inspect instance, no login needed). Use the Playwright browser tools. Walk at 375px AND 1280px: Einstellungen (Konto-Löschung, Datenexport), Hilfe-Seite, Paywall/Upgrade-Flow, und alle erreichbaren Rechtslinks. Screenshot what you judge, store the screenshots under .playwright-mcp/ (the MCP server's fixed output root, see .mcp.json) and reference their file names in the report. Die öffentliche Website (Landingpage + Rechtsseiten) prüfst du aus dem Quelltext (WORK SOURCES 10–11 und deren Render-Wiring), nicht live.
  4. SESSION per METHOD: the perspectives judge the checked areas.
  5. CONSOLIDATION: rank by compliance risk, dedup against the open work, resolve the carry-over statuses.
  6. REPORT as below.

REPORT (MANDATORY): write via bash heredoc to /tmp/rechts-team-report.md. The workflow posts this file verbatim as the issue body — WRITE THE REPORT IN GERMAN (headings and findings alike). Structure:
  # Rechts-Team — Wochenblick {{REPORT_DATE}}
  ## Methodik
  3-5 lines: perspectives applied, sources read (paths), walkthrough scope (areas x viewports).
  ## Übernahme aus Vorwoche
  Per carried item: status (offen | umgesetzt | weggefallen) + one-line reason. "umgesetzt" ONLY if you verified it in the walkthrough or the code; "weggefallen" if the surface is gone or the item now lives in an open ticket. First run: "Erstlauf — keine Vorwoche."
  ## Bereichs-Check
  One table with the columns: Bereich | Status (ok | Lücke | unklar) | Beleg (Datei/Zeile, Screenshot-Dateiname oder Textpassage). Rows (jede Zeile pflicht): Website (Impressum, Datenschutz, AGB, Widerruf + Verlinkung im Footer), Web-App (Rechtslinks, Konto-Löschung, Datenexport, Preisauszeichnung im Paywall), Android/Play (Data-Safety-Angaben vs. tatsächliche Datenpraxis, Store-Pflichtangaben — "unklar" ist erlaubt, der Store-Eintrag ist nicht begehbar), Abo & Zahlung (PayPal-/Play-Billing-Rails vs. plans.ts, Widerrufsbelehrung, Kündigungsweg), Datenschutz (Rechtsgrundlagen, Betroffenenrechte, Auftragsverarbeiter).
  ## Kernerkenntnisse
  2-4 sentences: the biggest compliance risk this week, in one breath.
  ## Funde
  ALL findings ranked by compliance risk (ties: smaller effort first). Section opener once: "Alle Funde sind Hinweise für die menschliche (ggf. anwaltliche) Prüfung, keine Rechtsberatung." Per finding:
  `### Rang <n> — <Bereich>`
  Beobachtung (with anchor: screenshot file name, file/line, i18n key, or text passage) — why it matters — concrete suggestion — **Risiko** (hoch/mittel/niedrig) — **Aufwand** (leicht/mittel/schwer).
  Items that genuinely need legal counsel are described in the text but do NOT become candidates.
  ## Umsetzungs-Kandidaten
  HÖCHSTENS 3 (weniger ist ausdrücklich in Ordnung). Each as a paste-ready ticket draft in the issue-template structure: **Was ist das Problem?** / **Wie soll es sein?** / **Wo tritt es auf?** / **Woran messen wir das?** (at least one dash-bullet, verifiable from outside) — plus **Thema**: Rechts/Compliance und **Komplexität** (Einfach | Mittel | Komplex).
  ## Entscheidung
  One line: der Mensch entscheidet (ggf. mit anwaltlicher Prüfung), welche Kandidaten als Tickets angelegt werden.

ONLY evidence-backed findings — no speculation, no general-law lecture without a concrete anchor in this repo.

VERDICT (one line):
  - VERDICT: report  (at least one evidence-backed finding, written to /tmp/rechts-team-report.md)
  - VERDICT: clean   (nothing worth reporting this week — no new findings, carry-over unchanged)

HONESTY RULE: output VERDICT: report ONLY if /tmp/rechts-team-report.md exists, is non-empty, the Bereichs-Check table has all five rows, and every finding carries its anchor there.

TIME LIMIT: soft deadline = {{SOFT_DEADLINE}}. Before every step: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. If OVER: write the report with the current state, end the turn.
