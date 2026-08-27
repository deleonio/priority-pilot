## Erledigt
- SKILL.md, ux-design.md (207 Z.), mobile-ui-rules.md (98 Z.) gelesen.
- Issue-Body 1066 geladen: KI-ANALYSE-Block stand=2026-08-27T19:08:49Z, Ampel 🟢, 11 AKs, bindende Entscheidung Coordinates-only.
- Repo-Verankerung gelesen: `frontend/src/components/GeoBadge.tsx` (span role="img", aria-label `Standort: <address>`, bewusst KEIN KolBadge), `frontend/src/components/Dashboard.tsx:156/171/199` (KolCard _level=0, „Nächste Aufgabe" trägt --pp-signal + KolButton primary, Leerzustände als plain <p>), `frontend/src/components/EmptyState.tsx`, `frontend/src/lib/useGeolocation.ts` (Präferenz-Default AUS, STORAGE_KEY `pp-geolocation-enabled`, 5-Min-Intervall, permissionDenied/pending-Flags).
- KoliBri-MCP befragt (`search kol-alert`): nur 1 Treffer (sample dialog/with-alert), keine Spec-Doku — Komponentenwahl daher aus ux-design.md §4-Tabelle abgeleitet, nicht aus MCP.
- KI-UX-Block in Issue-Body geschrieben (nach `<!-- KI-ANALYSE:END -->`, vor ai-phase-routing), `gh issue edit --body-file` OK. Verdict: ux-ready.

## Relevante Stellen
- `frontend/src/components/Dashboard.tsx:156` — KolCard _label/_level=0-Muster, dem die neue Card „In der Nähe" folgt.
- `frontend/src/components/Dashboard.tsx:171-220` — „Nächste Aufgabe" ist die EINE Signalfarbe/Primäraktion; „In der Nähe" muss darunter bleiben.
- `frontend/src/components/GeoBadge.tsx` — aria-label hängt heute am `address`-Freitext; bei Coordinates-only droht ein lat/lon-Zahlenfried im Screenreader.
- `frontend/src/lib/useGeolocation.ts` — `permissionDenied` vs. Präferenz-AUS sind zwei unterscheidbare Zustände (AK4 vs. AK8).

## Annahmen
- KI-UX-Block-Platzierung nach dem KI-ANALYSE-Block ist akzeptabel (kein vergleichbares Issue mit existierendem Block gefunden; #1050 hat keinen).
- KoliBri-Komponenteneigenschaften (KolCard _label/_level, KolSpin _label, KolAlert _type) korrekt aus ux-design.md §4 übernommen.

## Verworfen
- KoliBri-MCP-Spec-Doku als Grundlage — search liefert für `alert`/`kol-alert` keine Docs, nur Samples; Zeitverlust nicht gerechtfertigt.
- Umkreis-Cap als UX-Forderung — Triage hat ohne Cap entschieden (AK2 Top-10 nach Distanz); UX empfiehlt nur Distanz-Kontext im Eintrag.

## Offen
- -

## Nächster Schritt
- Spec-Phase: KI-UX-Empfehlungen als advisory aufnehmen (Platzierung Card nach „Was ist jetzt dran?", keine Adresse in Card-Einträgen, unterscheidbare AK4/AK8-Hinweise, GeoBadge-aria-label-Neufassung, AK10-Inline-Hinweis im TaskForm).

## Fallstricke
- Issue-Body per `--body-file` ersetzt ALLES — neuen Block in Kopie des Original-Bodies einfügen, nicht separat patchen.
- Body-Datei ins gitignore-te Verzeichnis (`/tmp`-Write wird abgelehnt, Heredoc scheitert am Bash-Tool-Parser).
- Der Verdict-Token muss NAKT in der letzten Zeile stehen (Memory 2026-08-25: Prosaglut bricht den Parser).
