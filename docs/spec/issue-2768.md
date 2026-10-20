# Datenschutzerklärung: Warteliste + Hinweis auf der Login-Seite

**Stand:** 2026-10-20

Die Datenschutzerklärung beschreibt die Wartelisten-Verarbeitung in beiden Sprachversionen (de unter `/datenschutz/`, en unter `/en/privacy/`). Die Wartelisten-Karte der Login-Seite weist dauerhaft — schon vor dem Eintrag — mit einer Zeile auf die Datenschutzerklärung hin.

Bindende PO-Festhaltung (KI-ANALYSE-Block, 2026-10-20): Rechtsgrundlage **Art. 6 Abs. 1 lit. b DSGVO** (vorvertragliche Maßnahme); Löschung **sofort nach Freischaltung** (mit Konto-Anlage), nicht freigeschaltete Einträge **6 Wochen nach Ende der Warteliste**, zusätzlich **jederzeit auf Anforderung**; Empfänger **keine**.

## Verhalten

| AK  | Fläche                                     | Erwartung                                                                                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | Website `/datenschutz/` und `/en/privacy/` | Abschnitt „Warteliste“ (en: „Waitlist“) mit Pflichtangaben (`facts`): Zweck (Zugang zum Launch), Rechtsgrundlage Art. 6 Abs. 1 lit. b DSGVO (en-Formulierung mit Art. 6 und lit. b bzw. (b)), Löschregelung (sofort nach Freischaltung; 6 Wochen nach Ende der Warteliste; jederzeit auf Anforderung; en: immediately / 6 weeks / request), Empfänger: keine (en: none) |
| AK2 | Login-Seite, Wartelisten-Karte             | Hinweiszeile **dauerhaft sichtbar** (schon im Leerzustand, unter dem Formular — nicht erst nach erfolgreichem Eintrag), mit sichtbarem Volltext-Link „Datenschutzerklärung“ (echtes `<a href>`, same-tab) auf `/datenschutz/` (de) bzw. `/en/privacy/` (en); Texte über `login.waitlist*`-Keys in onboarding.json (de **und** en, Key-Parity)                           |
| AK3 | 375px                                      | Hinweiszeile vollständig sichtbar, Link klickbar → Navigation nach `/datenschutz/`, kein horizontal beschnittener Karteninhalt                                                                                                                                                                                                                                          |
| AK4 | Dokumentation                              | PO-Festhaltung wörtlich als PO-Entscheidung dokumentiert — Nachweis = KI-ANALYSE-Block im Harness-Kommentar; **kein Test**                                                                                                                                                                                                                                              |

Hinweise (KI-UX-Block, bindend für die Umsetzung): Zeile weich umbrechen (kein `white-space: nowrap`), Fließtext ≥ 16px (`--pp-font-size-base`), Farbe `--pp-ink-muted`, Link-Unterstreichung behalten; Link-Ziel sprachabhängig wie der Zurück-Link (`(i18n.resolvedLanguage ?? i18n.language) === 'en' ? '/en/privacy/' : '/datenschutz/'`). Die Speicherlogik in `server/src/logics/waitlist.ts` bleibt unverändert (reine Dokumentation + Hinweis).

## Erwartetes Ergebnis

- Beide Sprachversionen nennen Zweck, Rechtsgrundlage (lit. b), Löschfristen und Empfänger (keine) zur Warteliste.
- Die Login-Karte weist vor der Eingabe mit klickbarem Link auf die Erklärung hin; bei 375px wird nichts abgeschnitten.
