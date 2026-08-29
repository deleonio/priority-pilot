# Issue 1098 — UX (Phase 2), Stand 2026-08-28

## Erledigt
- Issue-Body + KI-ANALYSE-Block geladen (AK1–AK7, TF1–TF7, Ampel 🟡, 3 offene Fragen, Routing ux/spec/impl/review alle ja).
- Regeln gelesen: `docs/mobile-ui-rules.md` (Regel 4 Settings-Liste ohne Speichern-Button, 44px Touch, 375px, Regel 7 Zustände, Regel 8 inputmode/Safe-Area), `.ai-knowledge/ux-design.md` (§1 Zahlen brauchen Kontext, §2 Farbrollen, §3 tabular-nums, §4 KoliBri-First + Ausnahmepflicht).
- KoliBri-MCP verifiziert: `spec/input-text` — `_type` NUR `search|tel|text|url` (kein number), **kein `_error`-Prop** (Fehler nur via `_msg` + `_touched`); `spec/input-range` — `_min/_max/_step` vorhanden; Gruppe `input-number` existiert → KolInputNumber verfügbar.
- Bestandscode gelesen: `frontend/src/components/SettingsPage.tsx` (Tab „Allgemein“ = Index 0, Geo-Switch `:237-248` mit hartem „alle 5 Minuten“-Hint in `:242`, `_disabled`-Vorbild „Schnellerfassung“ `:338`, **`_disabled`-Remount-Trick `:266-272`**, Tabs bleiben gemountet `:290-292`).
- KI-UX-Block in den Issue-Body geschrieben (vor `<!-- ai-phase-routing:START -->`), Body via `gh issue edit --body-file` (Blockvorlage: `.ai-memory/issue-1098-ux-block.md`). VERDICT nur im Lauf-Output, nicht im Body.

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx:242` — starrer „5 Minuten“-Hint des Geo-Switches; muss mit AK5 dynamisch werden.
- `frontend/src/components/SettingsPage.tsx:266-272` — KoliBri-Adapter schlägt `_disabled`-Wechsel nach Mount nicht durch → `key`-Remount-Muster; TF3 braucht dasselbe.
- `frontend/src/components/SettingsPage.tsx:338` — `_disabled={!aiEnabled}` als Repo-Präzedenz für AK3 (disabled statt verstecken).
- `.ai-knowledge/ux-design.md:113` — rohes HTML-Ausnahme braucht Code-Kommentar + PR-Begründung.

## Annahmen
- KolInputNumber ist in der installierten @public-ui-Version (4.3.0) vorhanden (MCP-Gruppe `input-number` bejaht Existenz; Props nicht im Detail gelesen — min/max/step-Namen wie bei input-range angenommen, Spec-Phase muss gegenprüfen).
- AK3 „disabled (readonly, nicht versteckt)“ ist als „deaktiviert, aber sichtbar mit erhaltenen Werten“ gemeint; Empfehlung `_disabled`.

## Verworfen
- KolInputRange als Standard für alle drei Felder — Slider zeigt den Wert nicht selbst (Regel 4) und hat kleine Touch-Ziele; nur als Option für das 1–60-Intervall mit sichtbarem Zahlenwert.
- KolAlert beim Speichern / Sammel-Error — Anti-Pattern „Speichern-Button in Einstellungen“; Inline-`_msg` am verletzenden Feld.
- Blockierende ux-not-ready-Wertung — Analyse-Frage 1 (LocalStorage vs. Server) ist keine UX-Frage; alle UX-Punkte haben sinnvolle Defaults.

## Offen
- Wegwerf-Artefakte untracked in `.ai-memory/`: `issue-1098-body.md`, `issue-1098-check.md`, `issue-1098-compose.py`, `issue-1098-new.md` (Body-Zusammensetzung). `rm` braucht eine Freigabe, die nicht kam (Muster wie #1083/#1095). NICHT committen; `issue-1098-new.md` enthält den gesendeten Body-Stand, `issue-1098-ux-block.md` nur den Block.

## Nächster Schritt
- Spec-Phase (ux=ja, spec=sonnet/medium): KI-UX-Randbedingungen als beratende AK-Ergänzungen — insbesondere AK2 auf `_msg={{_type:'error',_description}}` + `_touched` umschreiben (kein `_error`-Prop!) und den Remount-Fall für TF3 mittesten.

## Fallstricke
- AK2 nennt „KoliBri-Error“ — es gibt dieses Prop in 4.3.0 nicht; wer `_error` schreibt, baut gegen die falsche API (spec/input-text verifiziert).
- KoliBri `_disabled` nach Mount = `key`-Remount nötig (SettingsPage.tsx:266-272), sonst sieht TF3 im Unit-Mock grün aus und fällt live aus.
- E2E TF7: Touch-Target/Viewport-Checks per Bounding-Box, nicht `scrollWidth` (App-Shell clippt mit overflow-x:hidden — Memory 2026-08-24).
- `KolInputText _type="number"` existiert nicht — kein HTML-`<input type="number">` als Ersatz (§4-Ausnahmepflicht).
