import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Build-Info (Version + Commit-SHA) für Feedback-Frontmatter und Status-Mail. Der Server trägt
 * keine eigene Version — sie steht im Repo-`package.json` (Dev/Tests, eine Ebene über `server/`)
 * bzw. in der deployten `package.json` im APP_DIR (Prod; `deploy.yml` stempelt dort die
 * Commit-SHA als `gitSha` ein). Die Datei wird von `process.cwd()` aus bis zu vier Ebenen nach
 * oben gesucht; ist sie nicht lesbar (z. B. schlanker Container), bleibt der Wert auf
 * „unbekannt" statt zu werfen — Aufrufer (Feedback-Request, Status-Mail) dürfen daran nicht
 * scheitern.
 */

interface AppInfo {
	version?: string;
	gitSha?: string;
}

const readAppInfo = (): AppInfo => {
	let dir = process.cwd();
	for (let depth = 0; depth < 4; depth += 1) {
		try {
			const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as AppInfo;
			if (pkg.version?.trim() || pkg.gitSha?.trim()) {
				return pkg;
			}
		} catch {
			// package.json fehlt auf dieser Ebene — weiter nach oben.
		}
		const parent = join(dir, '..');
		if (parent === dir) {
			break;
		}
		dir = parent;
	}
	return {};
};

/** App-Version aus der nächsten `package.json` mit `version`-Feld, sonst „unbekannt". */
export const readAppVersion = (): string => readAppInfo().version?.trim() || 'unbekannt';

/** Commit-SHA aus der nächsten `package.json` mit `gitSha`-Stempel (deploy.yml), sonst „unbekannt". */
export const readGitSha = (): string => readAppInfo().gitSha?.trim() || 'unbekannt';
