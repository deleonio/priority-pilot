# Issue 1095 — Review/Kreuzverhör (PR #1097), Stand 2026-08-28T17:12Z

**ERGEBNIS: VERDICT reviewed, Ampel 🟢.** Runde 1 = Kreuzverhör (needs-fixup, 3 Findings F1–F3). Runde 2 = **Fixup-Nachweis** (Marker `<!-- ai-review -->` vorhanden, Kommentar-ID 5455350477). Fixup-Commit `f3abecf6` trägt F1–F3 vollständig ab, Delta-Prüfung `5d56af55..f3abecf6` (3 Dateien, +31/−10), keine neuen Findings.

## Erledigt
- MODE-Bestimmung: `<!-- ai-review -->`-Kommentar vorhanden (Issue-Kommentar 5455350477, updatedAt 2026-08-28T16:58:48Z, Review-Typ Kreuzverhör) → Fixup-Verifikation, KEINE erneute Vollprüfung. Line 2 des Sammelkommentars nennt Issue #1095 → nicht „Review ohne Issue" (closingIssuesReferences length = 1).
- Fixup-Commit identifiziert: PR-Commitliste → `f3abecf6` liegt NACH `5d56af55` (memory: review, dem Stand der Runde 1); Diff-Basis also `5d56af55..f3abecf6`, nicht base..head.
- F1 ✓: `confirmUpdate` ruft `updateServiceWorker(true)` jetzt UNBEDINGT zuerst auf, nur die Listener-Registrierung ist über `listenerRegisteredRef` einmalig (UpdatePrompt.tsx:38-48). Neuer Test „mehrfacher Klick wiederholt updateServiceWorker, registriert den Listener aber nur einmal" (UpdatePrompt.test.tsx:291-306): 3 Klicks → `updateServiceWorker` 3×, `addEventListener` 1×.
- F2 ✓: `bestätigtRef`/`reloadtRef` → `listenerRegisteredRef`/`reloadedRef` (ASCII camelCase, korrektes Partizip), Kommentarblock konsistent mitgezogen.
- F3 ✓: nicht fehlbares `expect(page.locator('.update-prompt')).toHaveCount(0)` gestrichen (pwa-update-prompt.spec.ts:350-356) und durch einen Begründungs-Kommentar ersetzt — stärker als die empfohlene „dekorativ markieren"-Variante.
- Neuer Test als sicher verifiziert: `updateServiceWorker.mockReset()` steht im `beforeEach` (UpdatePrompt.test.tsx:73) → `toHaveBeenCalledTimes(3)` kann nicht von Vor-Tests kontaminiert sein.
- Titel-Gate: PR-Titel `fix(frontend): guarantee reload after PWA update confirmation (#1095)` = 67 Zeichen, Conventional Commits, englisch, lowercase → bestanden, KEIN Rename nötig (Runde 1 hatte ihn schon umbenannt).
- Sammelkommentar aktualisiert (PATCH auf 5455350477, updated 2026-08-28T17:12:46Z): F1–F3 von „Offene Findings" in „Behobene Anmerkungen" (Nummern stabil), Review-Typ → Fixup-Nachweis.

## Relevante Stellen
- `frontend/src/components/UpdatePrompt.tsx:38-48` — neue Guard-Reihenfolge: `updateServiceWorker(true)` vor dem `listenerRegisteredRef`-Return; der Guard schützt nur noch die Listener-Registrierung.
- `frontend/src/components/UpdatePrompt.test.tsx:291-306` — F1-nagelnder Mehrfachklick-Test.
- `frontend/src/components/UpdatePrompt.test.tsx:73` — `mockReset()`-Garantie für Count-Assertions.
- `frontend/e2e/pwa-update-prompt.spec.ts:350-356` — E2E endet jetzt am `sessionStorage`-Reload-Zähler + Dashboard-Heading.
- `.ai-memory/issue-1095-review.md` (Runde 1) — vollständige Kreuzverhör-Begründung zu F1–F3, Review-ID 5053249457.

## Annahmen
- CI (verify/e2e 1–4/review) war beim Lauf noch pending (Fixup frisch gepusht; precheck ✓) → Grün-Nachweis per Testtext + Mock-Hygiene statt eigenem Lauf (kein node_modules in der Sandbox).
- Fixup-Commit ist der einzige Code-Commit seit Runde 1 (`memory: fixup` 6b3710ba ist nur Phasen-Notiz).

## Verworfen
- Erneute Vollprüfung des PR — Fixup-Modus verbietet sie; nur Delta + neue Probleme.
- Kritik an der Reihenfolge `updateServiceWorker(true)` vor dem Guard-Return — gewollt und korrekt, sonst würde der Wiederholklick gar nichts tun.
- Eigener F1-Zweig-Test für „Klick ohne SW-Unterstützung" (Optional-chaining-Pfad) — durch AK3-Test und die bedingungslose Call-Abdeckung nicht mehr nötig.

## Offen
-

## Nächster Schritt
- Kein weiterer Review-Lauf nötig; Issue geht mit `reviewed` in den Merge-Gate.

## Fallstricke
- Fixup-Delta nicht gegen `base..head` bilden — die Review-Runde-1-Stand (memory-Commit `5d56af55`) ist die richtige Diff-Basis, sonst sieht man den ganzen PR nochmal.
- Neue Count-Assertions auf modul-Level-`vi.fn()` sind nur dann belastbar, wenn `beforeEach` wirklich `mockReset()` ruft — vor dem Abnicken prüfen (hier: Zeile 73).
- Sammelkommentar-Update per `gh api -X PATCH .../issues/comments/<ID> -F body=@datei` (nicht neu anlegen); `gh pr comment` würde einen Zweitkommentar erzeugen.
