<!-- ai-fixup-decisions -->
🎯 Fixup-Status: needs-human
PR #1048 implementiert Issue #— (keines verknüpft; `Closes #8009e9bf-…` ist eine UUID, kein GitHub-Issue). Globaler Such-Button mit Voice-Input in der Header-Toolbar.

## ✅ Behobene Anmerkungen
| # | Finding | Behoben via | Datum |
|---|---------|-------------|-------|
| F1 | SeriesTab-Import entfernt | a02aef59 (App.tsx:29 Import wiederhergestellt) | 2026-08-26 |
| F2 | app.css unformatiert (verify rot) | a02aef59 (prettier --write, Format-Check grün) | 2026-08-26 |
| F3 | VoiceField dupliziert | a02aef59 (SearchModal nutzt `VoiceField variant="input"`, Eigen-CSS/.mic-error-Duplikat/@keyframes pulse gestrichen, tabIndex={-1} #522 AC2c zurück) | 2026-08-26 |
| F4 | Aktiver Filter unsichtbar | a02aef59 (onSearch setzt searchDraft mit) | 2026-08-26 |
| F5 | Redundanz setTaskSearch/applyTaskFilter | a02aef59 (nur applyTaskFilter) | 2026-08-26 |
| F6 | Suche erzwingt Offen-Ansicht | a02aef59 (setTaskViewMode entfernt) | 2026-08-26 |
| F7 | Keine Tests | a02aef59 (e2e/search-modal.spec.ts: Suchfluss, Enter, 375px-Viewport) | 2026-08-26 |

## ⏸️ Entscheidungs-Findings
### F8. Kein verknüpftes Ticket
**Was:** `Closes #8009e9bf-9e02-491c-8c73-6b4bac74f087` referenziert kein GitHub-Issue; Akzeptanzkriterien sind damit nicht prüfbar und Soll-Verhalten (z. B. F6) nicht gegen eine Quelle verifizierbar.
**Wo:** PR-Body (Closes-Zeile)
**Optionen:**
- `F8.1` Passendes GitHub-Issue anlegen und im PR-Body verlinken — schafft eine AK-Quelle für dieses und Folge-Reviews.
- `F8.2` Akzeptanzkriterien aus der Feature-Beschreibung direkt im PR-Body nachliefern — schnell, aber ohne triangulierbare Quelle.
- `F8.3` Akzeptieren (Tech Debt) — Risiko: Folgeworks an der Suche haben weiterhin keinen verifizierbaren Soll-Zustand.
**Empfehlung:** `F8.1` — die UUID im Code-Kommentar (SearchModal.tsx) legt nahe, dass ein externes Ticket existiert; es braucht nur die GitHub-Verknüpfung.

**Auswahl:** Kommentar mit Options-ID antworten
Review-Typ: Fixup-Nachweis
Updated: 2026-08-26
