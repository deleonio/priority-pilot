# Issue 1118 — Implement (Phase 4), Stand 2026-08-29 (Fortsetzungs-Lauf)

**ERGEBNIS: Implementierung abgeschlossen. 15/15 Unit grün, 6/7 E2E grün; AK2 bleibt bewusst rot
(Test-Pflege-Bedarf, dokumentiert im PR-Body, Separation of Duties). Gate-Volllauf gelaufen
(s. unten). PR #1120 review-ready gemacht.**

## Erledigt
- Fortsetzungs-Lauf: Branch `ai/harness/1118` ausgecheckt (lokale untracked Duplikate der
  Phase-Notes waren byte-identisch zum Branch → entfernt, dann sauberes `git switch`).
- **AK2-Entscheidung gefällt — KEIN Produktions-Fix möglich, Test-Pflege-Bedarf bestätigt:**
  - Diagnose-Spec (throwaway, wieder gelöscht) gegen echtes Chromium: Host-Attribute = 
    `[_label, class, data-themed, style]`; `getAttribute('_level')` = null, aber Property
    `'_level' in card` = true mit Wert `3`; Shadow-DOM rendert korrekt
    `<h3 class="kol-headline kol-headline--h3 kol-card__header …">` (Verhalten also richtig).
  - Experiment `_level={"3"}` (String statt Number) in Dashboard.tsx: Attribut bleibt null →
    React weist `_level` in jedem Typ als DOM-Property zu (Property existiert am upgegradeten
    Element), KoliBri reflektiert es nie als Attribut. Patch zurückgenommen.
  - Manuell gesetztes `_level`-Attribut überlebt zwar (300 ms Probe), aber ein ref-`setAttribute`
    im Produktivcode wäre Test-Gaming — verworfen.
- Gate-Volllauf gestartet (format → prettier --check → lint → knip → test → e2e-Spec #1118);
  Ergebnisse im PR-Body dokumentiert (session.test.ts/Redis ggf. pre-existing rot, s. Memory
  2026-08-29).
- PR #1120: Body erweitert (AK2-Beweisführung + Gate-Ergebnisse), `gh pr ready 1120`.

## Relevante Stellen
- `frontend/src/components/Dashboard.tsx:155-340` — Umbauort (Sektion-Wrapper + je 1 KolCard
  `_level={3}`); keine weiteren Änderungen im Fortsetzungs-Lauf.
- `frontend/src/app.css:496-525` — Card-Host-Regeln; `:707-731` — ≥48rem stretch + height 100%.
- `frontend/e2e/issue-1118-dashboard-section-cards.spec.ts:135` — der bewusst rote AK2-Assert
  (`getAttribute('_level')`); Messkonvention (Zeile 27-29 im Header) ist der fehlerhafte Teil.
- `frontend/e2e/issue-1118-dashboard-section-cards.spec.ts:200` — AK5 zweispaltige Zeile (grün).

## Annahmen
- AK2-Test bleibt rot und wird über den Test-Pflege-Bedarf-Block im PR-Body getragen (Regeln des
  Lauf-Prompts: Test nicht ändern, file:line + Begründung dokumentieren). Vorschlag im PR-Body:
  Assert auf Shadow-DOM-Heading (`h3.kol-card__header`) oder `_level`-Property umstellen.

## Verworfen
- `_level` als String übergeben — Attribut bleibt null (Experiment, s. Erledigt).
- ref-Callback mit `setAttribute('_level','3')` im Produktivcode — Test-Gaming, kein echtes
  Verhalten; KoliBri könnte das Attribut künftig selbst strippen.
- Sektion selbst als `kol-card`-Host (statt Wrapper+Card) — hält AK7 nicht (ältere Entscheidung).

## Offen
- AK2-Testpflege liegt beim Menschen/Review (PR-Body-Absatz „Test-Pflege-Bedarf").

## Nächster Schritt
- Review-Phase (Label-Workflow setzt `ai:needs-review`): auf Kreuzverhör-Runde vorbereitet;
  bekannte Diskussionspunkte: AK2-Assert-Stil, #930-Interaktion (Host transparent → Signalfläche
  im Card-Inhalt).

## Fallstricke
- KoliBri reflektiert `_label` als Host-Attribut, `_level` NICHT (DOM-Property) — Attribut-Asserts
  auf `_level` sind im echten Browser immer falsch-negativ; jsdom-Unit-Tests sehen das rohe
  React-Attribut und werden grün (Täuschung).
- Grid-Margin-Reset `section.dashboard > *` (Spezifität 0,1,1) — nicht absenken, sonst AK5 rot
  (später notierte Einzel-Margins gewinnen wieder).
- `height: 100%` auf Card-Hosts NUR ≥48rem (AK6 mobil).
- „Keine Säulen vorhanden" muss Text bleiben (AK1/AK4 Card-in-Card-Count).
