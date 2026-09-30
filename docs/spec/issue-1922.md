# Spec #1922 — Feedback beim Löschen des Kontos entfernen

Ziel: `DELETE /auth/me` entfernt auch die Feedback-Dateien des Kontos aus dem Obsidian-Vault (Art. 17 DSGVO).

## Vertrag

- `ObsidianGithubClient` erhält `listFeedbackFiles(repo, branch, dir)` → `{ path, sha, content }[]` und `deleteFile(repo, branch, path, sha)`.
- `deleteAccount(userId, { feedbackClient = githubObsidianClient } = {})` ruft nach erfolgreicher Transaktion die Löschung auf.
- Treffer nur bei exakt gleicher Frontmatter-Zeile `nutzer: <JSON-quotierte E-Mail>` (kein Substring).
- Ohne `FEEDBACK_GITHUB_TOKEN` kein Aufruf. Fehler des Clients: Konto bleibt gelöscht (`'deleted'` / 204), genau ein `console.error` ohne E-Mail und Token.
- Datenschutzerklärung, Abschnitt „Feedback“: nennt das Entfernen beim Löschen des Kontos, ohne „nicht automatisch“.

## Abdeckung

| AK            | Test                                      |
| ------------- | ----------------------------------------- |
| AK1, AK2, AK3 | `server/src/logics/deleteAccount.test.ts` |
| AK4           | `website/src/render.test.ts` (#1922)      |
