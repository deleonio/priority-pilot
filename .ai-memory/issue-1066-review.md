# Issue 1066 — Review-Phase (2026-08-28, Runde 4: ABGESCHLOSSEN — reviewed)

## Erledigt
- MODE Fixup-Nachweis (Marker in Sammelkommentar 5447797272 vorhanden). Delta = nur Commit `da56d88b`:
  - **N1 behoben verifiziert**: `timedOut`-State + Effect komplett aus `frontend/src/components/NearbyCard.tsx` entfernt (grep 0 Treffer, `useEffect`/`useState` weiterhin legitim genutzt — verbleibender Effect lädt nearby-Tasks). Keine toten Imports.
  - E2E-Mock-Änderung `frontend/e2e/issue-1066-nearby-card.spec.ts` (GEO_INIT): `localStorage.setItem` wird überschrieben und ignoriert Schreibversuche auf `pp-geolocation-enabled` — behebt die CI-Race-Condition an der Wurzel (frühe useGeolocation-Instanz schrieb Präferenz zurück, bevor NearbyCard initial las). Test-only, sauber kommentiert, plausible AK4-Semantik (Card erlebt Denial via eigenen Fetch).
  - Keine neuen Findings im Delta (Gegenprobe: NearbyCard.tsx komplett gelesen, Zeilen 1–80; Render-Zweige unverändert korrekt).
- CI auf `da56d88b`: run completed **success**, e2e (1)/(2) pass (`gh pr checks 1071`).
- TITLE GATE: `feat(frontend): add nearby card with geo-distance task list` — Conventional Commits konform, kein Rename.
- Sammelkommentar 5447797272 per PATCH auf **reviewed** aktualisiert (N1 in „Behobene Anmerkungen" via `da56d88b`, Offene Findings leer, Review-Typ: Fixup-Nachweis). Body-Datei `.ai-memory/issue-1066-review-body.md` (gitignored-Pfad) danach gelöscht.
- Verdict: reviewed (`/tmp/claude-verdict`).

## Relevante Stellen
- `frontend/src/components/NearbyCard.tsx` — N1-Fix-Ort; Render-Zweige denied/preference-off/empty/Liste unverändert seit Runde 3.
- `frontend/e2e/issue-1066-nearby-card.spec.ts:32-49` — GEO_INIT pinnt `pp-geolocation-enabled` gegen Mock-Schreiberei.
- Kommentar 5447797272 — Sammelkommentar (einziger `<!-- ai-review -->`, aktualisiert 2026-08-28T04:52:18Z).

## Annahmen
- Commit-Message-Angabe „grün bei 4x/8x/12x CPU-Throttling" nicht selbst reproduziert — CI-success auf da56d88b als Beleg akzeptiert.

## Verworfen
- Neue Kreuzverprüfung des Gesamtdiffs — MODE Fixup-Nachweis verbietet es; nur Delta + N1-Abgleich.

## Offen
- - (Review abgeschlossen; ggf. Review-Threads zu F1–F5/N1 resolven liegt beim Workflow/bei Fixup-Phase-Notiz, nicht Review.)

## Nächster Schritt
- Keiner für diese Phase. Workflow übernimmt Verdict `reviewed` → Merge-Pipeline.

## Fallstricke
- Fixup-Delta enthält Main-Merge-Rauschen (workflows/ADR/Skills) — diff auf PR-eigene Dateien stutzen.
- GitHub-Job-Logs brauchen `--allow-escape-sequences` + ANSI-Strip per sed, sonst „terminal escape sequences"-Fehler.
- `-F body=@file` bei `gh api … -X PATCH` liest Dateiinhalt als String — funktioniert zuverlässig für Kommentar-Bodies (ohne gh-Newline-Leichen).
