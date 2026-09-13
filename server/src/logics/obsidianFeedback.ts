/**
 * GitHub-Anbindung für das App-Feedback (Issue #1435): legt Feedback-Markdown über die
 * Contents-API im konfigurierten Obsidian-Repo ab — immer auf dem Feedback-Branch, nie auf
 * `main`. Der Router spricht nur über das {@link ObsidianGithubClient}-Interface mit dieser
 * Datei; Tests injizieren dafür einen Stub (Muster `FetchProviderModels` in
 * `routes/llmProviders.ts`), damit kein echtes Netzwerk nötig ist.
 *
 * Der PAT wird ausschließlich hier aus `FEEDBACK_GITHUB_TOKEN` gelesen und niemals in eine
 * Response oder ein Log geschrieben.
 */

const GITHUB_API = 'https://api.github.com';
const UPSTREAM_TIMEOUT_MS = 10_000;

/** Der vom Feedback-Router genutzte Ausschnitt der GitHub-API (injizierbarer Seam). */
export interface ObsidianGithubClient {
	/** Liefert die SHA des Branch-HEAD, oder `null`, wenn der Branch nicht existiert. */
	getBranchSha(repo: string, branch: string): Promise<string | null>;
	/** Legt `branch` vom HEAD von `fromBranch` an. */
	createBranch(repo: string, branch: string, fromBranch: string): Promise<void>;
	/** Legt `path` auf `branch` mit `content` (Klartext) an. */
	commitFile(repo: string, branch: string, path: string, content: string): Promise<void>;
}

/** Gemeinsame Header aller Aufrufe; der Token kommt pro Aufruf frisch aus der Umgebung. */
const authHeaders = (): Record<string, string> => ({
	Authorization: `Bearer ${process.env.FEEDBACK_GITHUB_TOKEN ?? ''}`,
	Accept: 'application/vnd.github+json',
	'X-GitHub-Api-Version': '2022-11-28',
});

/**
 * Führt einen GitHub-Aufruf aus und wirft bei jedem Nicht-Erfolg. Die Fehlermeldung nennt nur
 * Methode, Pfad und Statuscode — der Upstream-Body wird bewusst NICHT übernommen, damit weder
 * Tokenwerte noch Upstream-Details in Logs landen.
 */
const githubRequest = async (method: string, path: string, body?: unknown): Promise<Response> => {
	const response = await fetch(`${GITHUB_API}${path}`, {
		method,
		headers: { ...authHeaders(), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
		body: body === undefined ? undefined : JSON.stringify(body),
		signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
	});
	if (!response.ok && response.status !== 404) {
		throw new Error(`GitHub antwortete auf ${method} ${path} mit HTTP ${response.status}.`);
	}
	return response;
};

/** Echte Implementierung gegen api.github.com — Default der Router-Factory. */
export const githubObsidianClient: ObsidianGithubClient = {
	async getBranchSha(repo: string, branch: string): Promise<string | null> {
		const response = await githubRequest('GET', `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
		if (response.status === 404) return null;
		const payload = (await response.json()) as { object?: { sha?: unknown } };
		const sha = payload.object?.sha;
		if (typeof sha !== 'string' || sha === '') {
			throw new Error(`GitHub lieferte keine SHA für Branch ${branch}.`);
		}
		return sha;
	},

	async createBranch(repo: string, branch: string, fromBranch: string): Promise<void> {
		const response = await githubRequest('GET', `/repos/${repo}/git/ref/heads/${encodeURIComponent(fromBranch)}`);
		if (response.status === 404) {
			throw new Error(`Quell-Branch ${fromBranch} existiert nicht.`);
		}
		const payload = (await response.json()) as { object?: { sha?: unknown } };
		const sha = payload.object?.sha;
		if (typeof sha !== 'string' || sha === '') {
			throw new Error(`GitHub lieferte keine SHA für Branch ${fromBranch}.`);
		}
		await githubRequest('POST', `/repos/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha });
	},

	async commitFile(repo: string, branch: string, path: string, content: string): Promise<void> {
		// `branch` ist Pflicht: ohne das Feld schreibt die Contents-API auf den Default-Branch.
		await githubRequest('PUT', `/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
			message: `feedback: ${path}`,
			content: Buffer.from(content, 'utf8').toString('base64'),
			branch,
		});
	},
};
