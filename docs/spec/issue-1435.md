# Spec — Issue #1435: Feedback direkt in Obsidian

Quelle: Harness-Marker-Kommentar (KI-ANALYSE + KI-UX), AK1–AK10.

## Ziel

Ein angemeldeter Nutzer sendet über einen vierten Hilfe-Tab „Feedback" Kategorie, Titel und
Beschreibung ab. Der Server legt dafür per GitHub-Contents-API eine Markdown-Datei mit festem
Frontmatter im konfigurierten Ordner auf dem konfigurierten Feedback-Branch von
`deleonio/Obsidian` an (niemals auf `main`) und meldet Erfolg oder einen verständlichen Fehler
zurück.

## Konfiguration (`server/.env.example`)

- `FEEDBACK_GITHUB_TOKEN` — PAT mit Contents-Schreibrecht, Pflicht (fehlt er → 503).
- `FEEDBACK_GITHUB_REPO` — Default `deleonio/Obsidian`.
- `FEEDBACK_GITHUB_BRANCH` — Default `app-feedback`.
- `FEEDBACK_GITHUB_DIR` — Default `Feedback`.

## Injizierbarer Seam (Testkontrakt, Muster `llmProviders.ts` `FetchProviderModels`)

`AppDeps.obsidianGithubClient?: ObsidianGithubClient` — ersetzt in Tests den echten GitHub-Call
(kein Netzwerk). Die Router-Factory `createFeedbackRouter({ obsidianGithubClient })` in
`server/src/express/routes/feedback.ts` (neu) nutzt ihn wie folgt:

```ts
interface ObsidianGithubClient {
	/** Liefert die SHA des Branch-HEAD, oder null, wenn der Branch nicht existiert. */
	getBranchSha(repo: string, branch: string): Promise<string | null>;
	/** Legt `branch` vom HEAD von `fromBranch` (Default-Branch) im Repo an. */
	createBranch(repo: string, branch: string, fromBranch: string): Promise<void>;
	/** Legt `path` auf `branch` mit `content` (Klartext, kein Base64) an. */
	commitFile(repo: string, branch: string, path: string, content: string): Promise<void>;
}
```

Ablauf im Router: Body validieren (AK4) → Token aus `process.env.FEEDBACK_GITHUB_TOKEN` prüfen
(AK5, 503 wenn leer) → `getBranchSha`; liefert er `null`, zuerst `createBranch` (vom
Default-Branch `main`), danach `commitFile` (AK6) → bei vorhandenem Branch direkt `commitFile`.
Wirft eine der drei Methoden, antwortet der Router `502` (AK5) — Fehlertext und Log enthalten
nie den Tokenwert oder den rohen Upstream-Fehlertext.

Dateiname: `<YYYY-MM-DD>-<kategorie>-<titel-slug>-<zufallssuffix>.md` unter
`<FEEDBACK_GITHUB_DIR>/` (AK2). Inhalt: YAML-Frontmatter (`datum`, `kategorie`, `nutzer`,
`appVersion`, `quelle: app-feedback`) + `# <Titel>` + Beschreibungstext (AK3).

## Frontend

Vierter Tab „Feedback" in `HelpPage.tsx` (`HELP_TABS`, Slot `tab-3`): `KolSingleSelect`
(Kategorie), `KolInputText` (Titel), `KolTextarea` (Beschreibung), `KolButton` (Senden). Erfolg
→ `KolAlert _type="success"` + Felder geleert (AK8). Fehler → `KolAlert _type="error"`,
Eingaben bleiben erhalten, erneutes Senden möglich (AK9). Bei 375px Viewportbreite kein Element
über die Viewportbreite hinaus (AK10, Bounding-Box-Assertion statt `scrollWidth`).

## Nicht im Scope

Vault-Sync nach Obsidian, Merge des Feedback-Branch nach `main`.
