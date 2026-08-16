# Issue 731: Memory-Artefakt Verifikation

## Ziel

Verifizieren ob die seit PR #690 (2026-08-16) implementierte Memory-Persistenz via Workflow-Artefakten tatsächlich funktioniert.

## Vorbedingung

- Repo hat Phase-01 bis Phase-05 Runs seit dem Merge (2026-08-16 02:29 UTC)
- `gh` CLI ist authentifiziert

## Schritte

### 1. Artefakte listen (AK1)

```bash
gh api repos/{owner}/{repo}/actions/artifacts?per_page=100 | jq '.artifacts | map(select(.name | startswith("claude-memory-issue-"))) | .[] | {name, size_in_bytes, created_at, expired}'
```

### 2. Fall: Artefakte vorhanden (AK2)

- Neuesten Folgelauf (Phase 02/03/04/05) prüfen:
  ```bash
  gh run list --workflow=phase-0{2,3,4,5} --limit 5 --json databaseId | jq '.[0].databaseId' | xargs gh run view --log
  ```
- Nach "Memory-Restore" suchen: Meldung "vorhanden", keine "⚠️ Memory-Restore leer"-Warnings
- Stichprobe: Artefakt downloaden
  ```bash
  gh run download <run-id> -n claude-memory-issue-* -D /tmp/memory-check
  ```
- Prüfen: `issue-{N}-{PHASE}.md`-Dateien enthalten alle 4 Abschnitte (Erledigt/Offen/Nächster Schritt/Fallstricke)

### 3. Fall: Keine Artefakte (AK3)

- Phase-Runs seit Merge listen:
  ```bash
  gh run list --workflow=phase-0{1,2,3,4,5} --created="2026-08-16T02:29:00Z..now" --json databaseId,workflowName,displayTitle
  ```
- Memory-Upload-Step-Logs dieser Runs prüfen auf Ursache:
  - `if-no-files-found: ignore` greift weil headless Claude nichts schreibt?
  - Direktive/Berechtigungs-Problem in `memory-write.md`?
  - Upload-Step-Logik falsch?
- Ursache minimal fixen (nicht umbauen)
- Nachweis über nächsten echten Pipeline-Lauf

## Erwartetes Ergebnis

- **AK1**: Liste zeigt `claude-memory-issue-*` Artefakte oder begründetes Null-Ergebnis
- **AK2**: Folgelauf zeigt "Memory-Restore vorhanden" ohne Leer-Warnings; Stichprobe zeigt korrekte Struktur
- **AK3**: Bei Null-Fund nach Merge: Ursache identifiziert, minimal fix führt zu Artefakt im nächsten Lauf
