import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Vertrag-Tests — Deploy-Workflow wiederherstellen (#196).
//
// Kontext: Der Deploy-Workflow (.github/workflows/release.yml) wurde in PR #188 geloescht.
// Er muss als neuer .github/workflows/deploy.yml wiederhergestellt werden.
// Die Soll-Schritte ergeben sich aus docs/deployment.md §3.
//
// Testebene: statische YAML-Datei-Checks (node:test via tsx).
// Tests sind ROT, solange deploy.yml nicht existiert (readFileSync wirft) bzw. nicht den
// geforderten Inhalt enthaelt. Sie werden GRUEN, sobald deploy.yml korrekt angelegt ist.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');

const readFile = (...parts: string[]): string => readFileSync(join(REPO_ROOT, ...parts), 'utf8');

const deployYml = (): string => readFile('.github', 'workflows', 'deploy.yml');

describe('AK1 — Deploy-Workflow-Datei existiert', () => {
	it('.github/workflows/deploy.yml ist lesbar (existiert)', () => {
		// readFileSync wirft, wenn die Datei fehlt → Test ist ROT bis deploy.yml existiert
		assert.doesNotThrow(() => deployYml(), 'deploy.yml muss existieren und lesbar sein');
	});
});

describe('AK2 — Trigger: push auf main-Branch', () => {
	it('deploy.yml triggert auf push und beschraenkt auf main', () => {
		const yml = deployYml();
		assert.match(yml, /push:/, 'deploy.yml muss auf `push` triggern');
		assert.match(
			yml,
			/branches:\s*(\[\s*main\s*\]|[\s\S]*?-\s*main)/,
			'deploy.yml muss `branches: [main]` oder `branches:` + `- main` enthalten',
		);
	});
});

describe('AK3 — Concurrency: deploy-main, cancel-in-progress', () => {
	it('deploy.yml setzt concurrency-group deploy-main', () => {
		assert.match(deployYml(), /group:\s*deploy-main/, 'deploy.yml muss `group: deploy-main` enthalten');
	});

	it('deploy.yml setzt cancel-in-progress: true', () => {
		assert.match(deployYml(), /cancel-in-progress:\s*true/, 'deploy.yml muss `cancel-in-progress: true` enthalten');
	});
});

describe('AK4 — Install + Build-Schritte vorhanden', () => {
	it('deploy.yml enthaelt pnpm install --frozen-lockfile', () => {
		assert.match(
			deployYml(),
			/pnpm install --frozen-lockfile/,
			'deploy.yml muss `pnpm install --frozen-lockfile` enthalten',
		);
	});

	it('deploy.yml enthaelt pnpm -r build', () => {
		assert.match(deployYml(), /pnpm -r build/, 'deploy.yml muss `pnpm -r build` enthalten');
	});
});

describe('AK5 — Server-Prod-Deps werden gebuendelt', () => {
	it('deploy.yml buendelt Server-Prod-Deps via pnpm --filter ... --prod deploy', () => {
		assert.match(
			deployYml(),
			/pnpm[\s\S]*?--filter[\s\S]*?server[\s\S]*?--prod[\s\S]*?deploy/,
			'deploy.yml muss `pnpm --filter ./server --prod deploy` (Server-Prod-Deps buendeln) enthalten',
		);
	});

	it('deploy.yml nutzt server/deploy als Zielverzeichnis', () => {
		assert.match(deployYml(), /server\/deploy/, 'deploy.yml muss `server/deploy` als Zielverzeichnis enthalten');
	});
});

describe('AK6 — SSH-Key-Setup', () => {
	it('deploy.yml verwendet das Secret DEPLOY_SSH_KEY', () => {
		assert.match(
			deployYml(),
			/\$\{\{\s*secrets\.DEPLOY_SSH_KEY\s*\}\}/,
			'deploy.yml muss `${{ secrets.DEPLOY_SSH_KEY }}` verwenden',
		);
	});

	it('deploy.yml enthaelt ssh-keyscan', () => {
		assert.match(deployYml(), /ssh-keyscan/, 'deploy.yml muss `ssh-keyscan` (Host-Key) enthalten');
	});
});

describe('AK7 — rsync Frontend zu DEPLOY_WEB_DIR', () => {
	it('deploy.yml synchronisiert frontend/dist via rsync', () => {
		const yml = deployYml();
		assert.match(yml, /rsync/, 'deploy.yml muss `rsync` verwenden');
		assert.match(yml, /frontend\/dist/, 'deploy.yml muss `frontend/dist` synchronisieren');
	});

	it('deploy.yml referenziert DEPLOY_WEB_DIR', () => {
		assert.match(deployYml(), /DEPLOY_WEB_DIR/, 'deploy.yml muss `DEPLOY_WEB_DIR` referenzieren');
	});
});

describe('AK8 — rsync Backend mit DB-Schutz', () => {
	it('deploy.yml synchronisiert server/dist via rsync', () => {
		const yml = deployYml();
		assert.match(yml, /rsync/, 'deploy.yml muss `rsync` verwenden');
		assert.match(yml, /server\/dist/, 'deploy.yml muss `server/dist` synchronisieren');
	});

	it('deploy.yml referenziert DEPLOY_APP_DIR', () => {
		assert.match(deployYml(), /DEPLOY_APP_DIR/, 'deploy.yml muss `DEPLOY_APP_DIR` referenzieren');
	});

	it('deploy.yml schliesst data/ vom rsync aus (DB-Schutz)', () => {
		assert.match(
			deployYml(),
			/--exclude[\s\S]*?data\//,
			'deploy.yml muss `--exclude` + `data/` enthalten (Schutz der DB)',
		);
	});

	it('deploy.yml schliesst .env vom rsync aus (Secret-Schutz)', () => {
		assert.match(
			deployYml(),
			/--exclude[\s\S]*?\.env/,
			'deploy.yml muss `--exclude` + `.env` enthalten (Schutz der Secrets)',
		);
	});
});

describe('AK9 — PM2-Restart', () => {
	it('deploy.yml startet/reloaded den Prozess via pm2 reload priority-pilot', () => {
		assert.match(deployYml(), /pm2 reload priority-pilot/, 'deploy.yml muss `pm2 reload priority-pilot` enthalten');
	});
});

describe('AK10 — Alle benoetigten Vars referenziert', () => {
	it('deploy.yml referenziert DEPLOY_HOST', () => {
		assert.match(deployYml(), /DEPLOY_HOST/, 'deploy.yml muss `DEPLOY_HOST` referenzieren');
	});

	it('deploy.yml referenziert DEPLOY_USER', () => {
		assert.match(deployYml(), /DEPLOY_USER/, 'deploy.yml muss `DEPLOY_USER` referenzieren');
	});
});

// ─── Issue #286 — Patch-Bump nach jedem Deploy ───────────────────────────────
//
// Nach dem Deploy soll die Versionsnummer in der root package.json automatisch
// um einen Patch-Level erhoeht und per App-Token auf main gepusht werden.
// Reihenfolge: erst bauen + deployen, DANN inkrementieren.
// Loop-Schutz: Commit-Message enthaelt `[skip ci]`.
//
// Tests sind ROT bis die Umsetzung (deploy.yml + root package.json) existiert.

const rootPackageJson = (): { version?: string } => {
	const raw = readFile('package.json');
	return JSON.parse(raw) as { version?: string };
};

describe('Patch-Bump AK1 (#286) — root package.json hat ein gültiges version-Feld', () => {
	it('root package.json enthaelt ein version-Feld', () => {
		const pkg = rootPackageJson();
		assert.ok('version' in pkg, 'root package.json muss ein `version`-Feld enthalten');
	});

	it('version entspricht SemVer-Format (X.Y.Z)', () => {
		const { version } = rootPackageJson();
		assert.ok(version, 'version darf nicht leer sein');
		assert.match(version as string, /^\d+\.\d+\.\d+$/, `version muss SemVer-Format X.Y.Z haben, war: ${version}`);
	});
});

describe('Patch-Bump AK2 (#286) — Bump-Schritt steht nach pm2 reload', () => {
	it('deploy.yml enthaelt npm version patch (relativer Bump)', () => {
		assert.match(
			deployYml(),
			/npm version patch/,
			'deploy.yml muss `npm version patch` enthalten (Patch-Bump nach Deploy)',
		);
	});

	it('npm version patch erscheint nach pm2 reload (Reihenfolge korrekt)', () => {
		const yml = deployYml();
		const pm2Index = yml.indexOf('pm2 reload');
		const bumpIndex = yml.indexOf('npm version patch');
		assert.ok(pm2Index !== -1, 'pm2 reload muss in deploy.yml vorhanden sein');
		assert.ok(bumpIndex !== -1, 'npm version patch muss in deploy.yml vorhanden sein');
		assert.ok(
			bumpIndex > pm2Index,
			`npm version patch (pos ${bumpIndex}) muss NACH pm2 reload (pos ${pm2Index}) stehen`,
		);
	});
});

describe('Patch-Bump AK3 (#286) — relativer Bump (kein hartkodierter Versions-Set)', () => {
	it('Bump-Schritt nutzt `npm version patch` (relativ, kein set X.Y.Z)', () => {
		const yml = deployYml();
		assert.match(yml, /npm version patch/, 'deploy.yml muss `npm version patch` verwenden (relativer Bump)');
		// Kein hartkodiertes `npm version 1.2.3` o.Ä. — patch/minor/major sind die erlaubten Schluessel
		assert.doesNotMatch(
			yml,
			/npm version \d+\.\d+\.\d+/,
			'deploy.yml darf KEINE hartkodierte Versionsnummer im npm-version-Befehl setzen',
		);
	});

	it('Bump-Schritt verwendet --no-git-tag-version (kein Tag, nur Bump)', () => {
		assert.match(
			deployYml(),
			/npm version patch[^\n]*--no-git-tag-version|--no-git-tag-version[^\n]*npm version patch/,
			'deploy.yml muss `npm version patch --no-git-tag-version` verwenden (kein Git-Tag, nur Versionsdatei)',
		);
	});
});

describe('Patch-Bump AK4 (#286) — Commit + Push mit Loop-Schutz [skip ci]', () => {
	it('deploy.yml enthaelt git commit mit chore(release)-Message', () => {
		assert.match(
			deployYml(),
			/git commit[\s\S]{0,200}chore\(release\)/,
			'deploy.yml muss `git commit` mit Message `chore(release)` enthalten',
		);
	});

	it('Commit-Message enthaelt [skip ci] als Loop-Schutz', () => {
		assert.match(
			deployYml(),
			/\[skip ci\]/,
			'deploy.yml muss `[skip ci]` in der Bump-Commit-Message haben (Loop-Schutz)',
		);
	});

	it('deploy.yml enthaelt git push nach main', () => {
		assert.match(deployYml(), /git push/, 'deploy.yml muss `git push` (Bump-Commit auf main) enthalten');
	});
});

describe('Patch-Bump AK5 (#286) — App-Token + Git-Identitaet fuer den Push', () => {
	it('deploy.yml verwendet create-github-app-token (App-Token)', () => {
		assert.match(
			deployYml(),
			/create-github-app-token/,
			'deploy.yml muss `actions/create-github-app-token` verwenden (Branch-Protection umgehen)',
		);
	});

	it('deploy.yml referenziert APP_ID und APP_PRIVATE_KEY secrets', () => {
		const yml = deployYml();
		assert.match(yml, /APP_ID/, 'deploy.yml muss `APP_ID` referenzieren');
		assert.match(yml, /APP_PRIVATE_KEY/, 'deploy.yml muss `APP_PRIVATE_KEY` referenzieren');
	});

	it('deploy.yml setzt Git-Identitaet (user.name und user.email) aus App-Slug', () => {
		const yml = deployYml();
		assert.match(
			yml,
			/git config[\s\S]{0,100}user\.name/,
			'deploy.yml muss `git config user.name` setzen (Git-Identitaet des App-Tokens)',
		);
		assert.match(
			yml,
			/git config[\s\S]{0,100}user\.email/,
			'deploy.yml muss `git config user.email` setzen (Git-Identitaet des App-Tokens)',
		);
	});
});

describe('Patch-Bump AK6 (#286) — permissions: contents: write', () => {
	it('deploy.yml deklariert permissions.contents: write', () => {
		assert.match(
			deployYml(),
			/contents:\s*write/,
			'deploy.yml muss `contents: write` deklarieren (Bump-Commit auf main pushen)',
		);
	});
});
