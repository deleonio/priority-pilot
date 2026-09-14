import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Build-Info (Version + Commit-SHA) für Feedback-Frontmatter und Status-Mail. Der Server trägt
 * keine eigene Version — sie steht im Repo-`package.json` (Dev/Tests, eine Ebene über `server/`)
 * bzw. in der deployten `package.json` im APP_DIR (Prod; `deploy.yml` stempelt dort die
 * Commit-SHA und die Root-Version ein). Anker der Aufwärtssuche ist das Modulverzeichnis —
 * deterministisch in jeder Umgebung, unabhängig davon, wo PM2 den Prozess startet (dessen cwd
 * ist nicht gepinnt). Je Feld gewinnt die nächstgelegene `package.json`, die das Feld trägt;
 * jenseits von vier Ebenen bleibt der Wert auf „unbekannt" statt zu werfen — Aufrufer
 * (Feedback-Request, Status-Mail) dürfen daran nicht scheitern.
 */

interface AppInfo {
	version?: string;
	gitSha?: string;
}

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

const readField = (field: keyof AppInfo, from: string): string | undefined => {
	let dir = from;
	for (let depth = 0; depth < 4; depth += 1) {
		try {
			const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as AppInfo;
			const value = pkg[field]?.trim();
			if (value) {
				return value;
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
	return undefined;
};

/** App-Version aus der nächsten `package.json` mit `version`-Feld, sonst „unbekannt". */
export const readAppVersion = (from: string = MODULE_DIR): string => readField('version', from) ?? 'unbekannt';

/** Commit-SHA aus der nächsten `package.json` mit `gitSha`-Stempel (deploy.yml), sonst „unbekannt". */
export const readGitSha = (from: string = MODULE_DIR): string => readField('gitSha', from) ?? 'unbekannt';
