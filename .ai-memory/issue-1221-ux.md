## Erledigt
- KI-ANALYSE-Block gelesen (harness comment `IC_kwDONloM188AAAABStv6_A`, stand=2026-09-05T09:31:00Z), AK1–AK8 erfasst.
- `frontend/src/components/GroupDetail.tsx` komplett gelesen: Mitgliederliste-Zeile (Zeile ~113-119) = Name + `KolBadge` (roleLabel) + admin-only `KolButton _variant="danger"` „Entfernen"; Entfernen-Flow hat Bestätigungs-`Modal` (Zeile ~171-193) mit Fokus auf „Abbrechen"; 409-Fehler laufen über `error`-State → `KolAlert _type="error"` oben in der Liste (kein Inline-Fehler je Zeile).
- `docs/mobile-ui-rules.md` und `.ai-knowledge/ux-design.md` gelesen (Maßstab für den Review).
- KI-UX-Block geschrieben und in den harness marker comment upserted (Read-Modify-Write, KI-ANALYSE + Routing-Tabelle byte-for-byte erhalten).

## Relevante Stellen
- `frontend/src/components/GroupDetail.tsx:113-119` — Mitgliederzeile; hier kommt der Rollen-Umschalter als weiteres Element in dieselbe Zeile.
- `frontend/src/components/GroupDetail.tsx:171-193` — Modal-Bestätigungsmuster (für Entfernen); Empfehlung im UX-Block: für Rollenwechsel NICHT nötig (reversibel, kein Datenverlust).
- `frontend/src/components/GroupDetail.tsx:9` — `roleLabel`-Kommentar zitiert bereits „Rolle immer als Text, nie nur als Farbe (KI-UX #1211)" — Präzedenzfall für Farbe+Text-Regel in genau dieser Datei.

## Annahmen
- Kein KI-UX-Block existierte vorher (Diff-Delta = 0, reiner Erstlauf); keine offenen menschlichen Antworten zu berücksichtigen.

## Verworfen
- Eigene Konfirmations-Modal für Rollenwechsel (wie bei Entfernen) — Rollenwechsel ist reversibel und nicht destruktiv, würde Regel 5 (eine Aufgabe/Screen) und Craft-Floor „Refuse: Modal ohne Interruption-Grund" verletzen; stattdessen im UX-Block nur als Hinweis auf Klarheit der Button-Beschriftung.

## Offen
- -

## Nächster Schritt
- Spec-Phase: rote Tests für AK1–AK8 gemäß KI-ANALYSE-Testfällen (TF1–TF8); UX-Empfehlungen (Button statt generischem Switch, Zwei-Zeilen-Layout bei 375px) sind advisory, nicht bindend für die Tests.

## Fallstricke
- AK8-Test (scrollWidth ≤ innerWidth bei 375px) — bei drei Elementen je Mitgliedszeile (Badge, Rollen-Button, Entfernen-Button) reicht die Zeile bei 375px vermutlich nicht ohne Umbruch; im UX-Block als Layout-Hinweis (zweizeilig: Name+Badge oben, Aktionen unten) vermerkt.
