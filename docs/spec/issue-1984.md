# Issue 1984 — Expertenmodus: Regler und Gewichte hinter eine Einstellung

## Ziel

Im Standardmodus sieht niemand Prozentregler oder Gewichtszahlen: Säulen-Prozentregler im
Aufgabendialog, Gewichtregler im Abhängigkeits-Dialog und die Säulen-Gewichtungspflege sind
hinter einen neuen Expertenmodus-Schalter (Einstellungen, Tab „Allgemein") gesteckt. Wer den
Expertenmodus einschaltet, erhält die heutige Bedienung vollständig zurück.

## Vertrag Präferenz-Modul `frontend/src/lib/expertMode.ts` (neu)

Muster `aiPreferences.ts` (reine read/store-Funktionen plus Hook, Best-Effort bei gesperrtem
Storage):

- `EXPERT_MODE_STORAGE_KEY = 'pp-expert-mode'`
- `readExpertMode(): { expertMode: boolean }` — fehlender, ungültiger (alles außer
  `'true'`/`'false'`) oder gesperrter Storage → Default `false` (Standardmodus)
- `storeExpertMode({ expertMode })` — persistiert Best-Effort
- Hook `useExpertMode()` — liest initial, persistiert bei Änderung

## Ablauf (Standardmodus, kein localStorage-Eintrag)

1. Aufgabendialog öffnen → keine Säulen-Prozentregler (Hauptsäulen-Wahl und Regelvorschlag
   aus #1962 bleiben).
2. Abhängigkeits-Dialog öffnen → kein Gewicht-Regler; Vorgänger allein über die
   Aufgaben-Auswahl (`KolSingleSelect` „Vorgänger-Task") wählen und „Hinzufügen" — der POST
   verwendet das Standardgewicht 1.
3. Säulen-Gewichtungspflege (Einstellungen und Dashboard-Modal) ist nicht erreichbar.

## Ablauf (Expertenmodus)

1. Einstellungen → Tab „Allgemein" → Schalter „Expertenmodus" (`KolInputCheckbox
_variant="switch"`, sichtbares Label, initial aus) einschalten → `pp-expert-mode` = `'true'`.
2. Regler und Gewichte erscheinen sofort (bedingtes Rendern, kein CSS-Hide); beim Ausschalten
   verschwinden sie. Fokus bleibt auf dem Schalter.
3. Zustand überlebt ein Neuladen.

## Erwartete Resultate

- AK1: Standardmodus rendert weder Säulen-Prozentregler (Aufgabendialog) noch Gewichtregler
  (Abhängigkeits-Dialog); die Säulen-Gewichtungspflege ist nicht erreichbar.
- AK2: Abhängigkeit im Standardmodus allein über die Auswahl anlegbar; `api.addDependency`
  erhält `weight: 1`.
- AK3: Schalter blendet Regler/Gewichte ein und aus und persistiert `pp-expert-mode` über ein
  Neuladen; Default ist aus, ungültiger Wert fällt auf aus zurück.
- AK4: Ein im Expertenmodus gesetztes Gewicht ≠ 1 (z. B. 0,5) bleibt gespeichert; der
  Standardmodus blendet es nur aus, nach dem Wiedereinschalten ist es wieder sichtbar.
  (`PlanBadge`/`PlanHint` `graph_weight` bleiben sichtbar.)
- AK5 (375 px): Standardmodus ohne Regler; der Expertenmodus-Schalter ist bedienbar.

## Randbedingungen

- Server und API unverändert; Gewichte und Verteilungen bleiben gespeichert.
- Prioritäts- und Aufwandsregler im Aufgabendialog bleiben unberührt.

## E2E-Abdeckung (Folge des Spec-Laufs, siehe PR „Offene Fragen")

Die harness-seitig vorgesehenen e2e-Flows (AK2-Anlege-Flow, AK3 Toggle+Reload, AK4
Gewichts-Erhalt, AK5 375 px) sind in diesem Spec-Run aus Zeitgründen nicht mitgeliefert —
Vertragsbasis sind die Vitest-Tests; die e2e-Specs entstehen im Impl-Lauf nach dieser Spec.
