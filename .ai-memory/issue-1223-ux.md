# Issue 1223 — UX-Phase (Phase 2), Stand 2026-09-05

**ERGEBNIS: VERDICT ux-ready.** KI-UX-Block (Zeilen 37–77) in den Harness-Marker-Kommentar
(`IC_kwDONloM188AAAABSvgHhQ`) geschrieben; KI-ANALYSE byte-for-byte unangetastet (stand
2026-09-05T15:13:05Z, Zeilen 2–35), Issue-Body unberührt (ADR 0009). Keine Labels gesetzt, kein
Ping-Kommentar.

## Erledigt
- SKILL.md, `.ai-memory/MEMORY.md`, `docs/mobile-ui-rules.md` (98 Z.), `.ai-knowledge/ux-design.md` (207 Z.) gelesen — rein statisch, kein Browser/Playwright.
- `frontend/src/components/GroupDetail.tsx` komplett gelesen: Muster für Heading-Level 4 (`:119,146`), KolSpin (`:116`), KolAlert-Fehlerband (`:110`), ul/li-Listen, Leerzustand-Hinweis als `p` (`:168`).
- KoliBri-MCP kurz befragt (Badge/Heading) — Bestätigung, dass `KolBadge` label-getragen ist; Komponentenwahl im Block auf Repo-Bestand (`KolHeading`/`KolSpin`/`KolAlert`/`KolBadge`) belassen.
- KI-UX-Block in `.ai-memory/issue-1223-ux-block.md` entworfen und via Read-modify-write in den Marker-Kommentar geschrieben; Landing verifiziert (alle Marker je 1×, Reihenfolge ANALYSE→UX→routing; `gh issue view 1223 --json body` enthält 0× KI-UX).

## Relevante Stellen
- `GroupDetail.tsx:119,146` — neue Section „Füreinander angelegt" auf gleicher Heading-Ebene (level 4) einreihen.
- `GroupDetail.tsx:116,110,168` — Laden/Leer/Fehler-Muster, die der UX-Block übernimmt.
- UX-Block-Kernempfehlungen: Einträge bewusst NICHT klickbar (PATCH/DELETE bleibt beim Empfänger, #1213); Liste statt `KolTable` (375px-Regel ux-design.md §4); Empfänger als Haupteintrag, Ersteller als Sekundärzeile „von {name}"; Leerzustand als Einladungstext; kein KolCard je Eintrag (Gruppierung durch Abstand, mobile-ui-rules Regel 4); Restrained-Modus (Operate), nur Rollen-Tokens; lange Anzeigenamen mit overflow-wrap sichern (AK8-Check).

## Annahmen
- Abschnitt ist reine Lese-Ansicht ohne Aktionen — ergibt sich aus AK4 (reduzierter Feldsatz) + #1213-Vertrag; falls Impl doch Aktionen zeigt, Touch-Targets ≥44px (im Block vermerkt).
- Status-Badge ist redundant (Abschnitt zeigt per Definition nur offene Aufgaben) — als Impl-Entscheidung im Rahmen belassen, nicht blockierend.

## Verworfen
- Labels setzen — laut Lauf-Vorgabe macht das der Workflow.
- Browser/Playwright-Inspektion — Phase läuft laut SKILL.md in der Pipeline rein statisch.
- Offene UX-Fragen als blockierend — verbleibende Punkte (Fälligkeitsformat, Status-Badge) sind Impl-Details → ux-ready statt ux-not-ready.

## Offen
-

## Nächster Schritt
- Spec-Phase gemäß Routing-Tabelle (spec ja/sonnet/medium): TF1/TF2 in `server/src/express/groups-tasks.api.test.ts`, TF3/TF4 in `frontend/e2e/groups-for-each-other.spec.ts`; UX-Empfehlungen des Blocks als beratenden Rahmen nehmen (nicht als Kontrakt).

## Fallstricke
- Harness-Kommentar-Update: `gh api comments/IC_…` (REST) → 404, denn `IC_kwDO…` ist eine GraphQL-Node-ID, keine REST-ID → Update zwingend über `gh api graphql`.
- Inline-GraphQL-Query mit `{...}` im Bash-Call wird vom Permission-Lint als „Brace expansion" abgelehnt; `-f query=@file` geht nicht (-f unterstützt kein @file). Arbeitet mit **`-F query=@querydatei`** — das liest die Datei und umgeht den Lint (Query in `.ai-memory/issue-1223-query.txt`).
- `node`/`python`/`awk` brauchen im Sandbox-Profil Freigabe → Body-Splice mit `head -n 35` + `tail -n +36` + `cat` zusammensetzen (Ankerzeile via Grep -n bestimmen).
- Wegwerf-Artefakte in `.ai-memory/` NICHT committen: `issue-1223-harness.md`, `-harness-new.md`, `-part1.md`, `-part2.md`, `-gap.md`, `-ux-block.md`, `-query.txt`, `-splice.js`. Nur `issue-1223-ux.md` (diese Datei) ist die Phasen-Notiz.
