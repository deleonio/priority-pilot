## Erledigt
- Issue 1051 UX-Review geschrieben und in den Issue-Body eingepflegt (KI-UX:START bis KI-UX:END)
- Design-System-Regeln geprüft: ux-design.md (Ruhe vor Reichtum, KoliBri-Varianten), mobile-ui-rules.md (44px Touch-Targets, 375px Viewport)
- KoliBri-Dokumentation geprüft: KolToolbar mit _items, KolButton _variant (primary nur einmal je Sicht)
- UX-Empfehlung: Alle sechs Toolbar-Buttons auf _variant: 'secondary' vereinheitlichen (Utility-Action, nicht Primär-Action)
- UX-Empfehlung: Mikrofon-Button CSS-Korrektur (Bottom-Anker statt top: 50% am Wrapper)

## Relevante Stellen
- frontend/src/App.tsx:402 — _variant: 'primary' auf 'secondary' ändern
- frontend/src/app.css:1279-1283 — Mic-Button vertikale Positionierung an Inputbox ausrichten
- frontend/src/app.css:1258-1274 — Kalibrier-Logik für Inputbox-Höhe als Custom Property
- .ai-knowledge/ux-design.md — Regel "KolButton (_variant="primary" nur einmal je Sicht)"
- docs/mobile-ui-rules.md — Touch-Targets ≥44px, 375px Viewport-Basis

## Annahmen
- Die Analyse aus dem KI-ANALYSE-Block ist korrekt (Lokalisierung in App.tsx:402 und app.css:1279-1283)
- KoliBri rendert Toolbar-Buttons im Shadow-DOM — Varianten nur über _variant der Items steuerbar
- VoiceField variant="input" wird auch in TaskForm, QuickCaptureModal, PillarAdvisorModal genutzt — CSS-Korrektur global wirksam

## Verworfen
- Keine alternativen Lösungen verworfen — die Analyse lief eine klare Lösung

## Offen
- Keine offenen Punkte aus UX-Sicht

## Nächster Schritt
- Spezifikations-Phase (ticket-spec) warten — UX-Review ist abgeschlossen, das Issue ist bereit für die Spec-Phase

## Fallstricke
- CSS-Korrektur für Mic-Button muss gegen die anderen variant="input"-Call-Sites verifiziert werden, um Kollateralschäden auszuschließen (TaskForm, QuickCaptureModal, PillarAdvisorModal)
- Die Toolbar-Buttons sind alle Utility-Actions — es gibt keine "echte" Primär-Action in der Toolbar, daher ist secondary die korrekte Variante für alle
