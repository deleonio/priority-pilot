import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Schutz vor teuren oder STILLEN Ausfaellen.
//
// Aufnahmekriterium dieser Datei: das Versagen ist nicht rueckholbar (Datenverlust,
// Secret-Leak) oder es faellt nicht von selbst auf (gruener Lauf, aber Endlosschleife /
// verfruehte Freigabe). Alles, was beim naechsten Lauf ohnehin sofort und laut kracht —
// fehlender Build-Step, falscher Host, vergessenes Secret — steht hier bewusst NICHT drin.
// Die Assertions greifen jeweils am selben Kommando, nicht irgendwo in der Datei: sonst
// waere ein `--exclude` am falschen rsync-Aufruf ein falsches Gruen.
//
// Testebene: statische Auswertung von YAML/Markdown (node:test via tsx, ci.yml).

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const read = (...parts: string[]): string => readFileSync(join(REPO_ROOT, ...parts), 'utf8');

// Zeilenfortsetzungen aufloesen — ein rsync-Aufruf steht ueber mehrere Zeilen.
const unfold = (text: string): string => text.replace(/\\\n\s*/g, ' ');

describe('Deploy — rsync darf Produktivdaten nicht loeschen', () => {
	const deploy = unfold(read('.github', 'workflows', 'deploy.yml'));
	const rsyncCalls = [...deploy.matchAll(/^\s*(rsync .*)$/gm)].map((m) => m[1].trim());

	it('es gibt ueberhaupt rsync-Aufrufe (sonst pruefen die Invarianten ins Leere)', () => {
		assert.ok(rsyncCalls.length > 0, 'kein rsync in deploy.yml gefunden — Extraktion kaputt?');
	});

	// Die SQLite-DB und die .env des Servers liegen im App-Verzeichnis auf dem Host. Ein
	// `--delete`, das die App-Wurzel trifft, loescht beides — ohne Backup nicht rueckholbar.
	it('kein rsync --delete zielt auf die App-Wurzel (dort liegen DB und .env)', () => {
		for (const call of rsyncCalls) {
			if (!call.includes('--delete')) continue;
			assert.doesNotMatch(
				call,
				/DEPLOY_APP_DIR\s*\}\}\/?"\s*$/,
				`rsync --delete auf die App-Wurzel loescht data/ und .env auf dem Host: ${call}`,
			);
		}
	});

	it('der Backend-rsync schliesst data/ und .env am selben Aufruf aus', () => {
		const backend = rsyncCalls.find((c) => c.includes('server/dist/'));
		assert.ok(backend, 'rsync fuer server/dist/ nicht gefunden');
		assert.match(backend, /--exclude\s+'?data\//, `Backend-rsync ohne --exclude data/ (DB-Schutz): ${backend}`);
		assert.match(backend, /--exclude\s+'?\.env/, `Backend-rsync ohne --exclude .env (Secret-Schutz): ${backend}`);
	});
});

describe('Deploy — der Release-Commit darf sich nicht selbst ausloesen', () => {
	const deploy = unfold(read('.github', 'workflows', 'deploy.yml'));
	const commit = deploy.match(/^\s*(git commit .*)$/m);

	it('Bump-Commit traegt [skip ci] und --no-verify', () => {
		assert.ok(commit, 'git commit in deploy.yml nicht gefunden');
		// Ohne [skip ci] triggert der eigene Push deploy.yml erneut → Endlosschleife.
		assert.match(commit[1], /\[skip ci\]/, `Release-Commit ohne [skip ci] → Deploy-Endlosschleife: ${commit[1]}`);
		// Ohne --no-verify laufen die lefthook pre-commit-Hooks. Deren pnpm-deps-Sync raeumt nach
		// dem vorherigen `--prod deploy`-Schritt die devDependencies inkl. lefthook selbst weg →
		// `sh: lefthook: not found`, Commit und Deploy scheitern.
		assert.match(
			commit[1],
			/--no-verify/,
			`Release-Commit ohne --no-verify zerstoert sein eigenes Tooling: ${commit[1]}`,
		);
	});
});

describe('Unblock — das Fan-in-Gate steht vor der Freigabe', () => {
	// Ein Kandidat darf erst laufen, wenn ALLE seine Blocker geschlossen sind. Wird
	// ai:analyzed vor der blocked_by-Pruefung entfernt, startet die Re-Triage zu frueh —
	// gruener Lauf, aber ein Issue arbeitet gegen einen unfertigen Stand.
	it('die blocked_by-Abfrage steht vor dem Entfernen von ai:analyzed', () => {
		const yml = read('.github', 'workflows', 'claude-issue-unblock.yml');
		const gate = yml.indexOf('dependencies/blocked_by');
		const release = yml.search(/remove-label\s+"?ai:analyzed/);
		assert.ok(gate !== -1, 'blocked_by-Abfrage nicht gefunden');
		assert.ok(release !== -1, 'remove-label ai:analyzed nicht gefunden');
		assert.ok(gate < release, 'Das Fan-in-Gate muss VOR der Freigabe stehen — sonst Freigabe trotz offener Blocker');
	});
});

describe('Fixup — rote CI-Checks werden behandelt, nicht durchgereicht', () => {
	// Loop aus PR #466: Gate setzt ai:needs-changes (CI rot) → Fixup findet keine
	// Review-Findings → setzt ai:needs-review → Gate sieht CI weiter rot → ai:needs-changes → …
	// Drei Durchlaeufe ohne eine einzige Code-Aenderung, jeder kostet einen Agent-Lauf.
	// Bewusst ein Text-Check auf den Prompt: der Prompt IST hier das Verhalten, und der
	// Ausfall ist teuer und still (jeder einzelne Lauf endet gruen).
	it('der Fixup-Prompt weist rote CI-Checks explizit zu und unterscheidet die Faelle', () => {
		const yml = read('.github', 'workflows', '05-claude-pr-fixup.yml');
		const prompt = yml.match(/cat > \/tmp\/claude-prompt\.txt << 'CLAUDE_EOF'\s*\n([\s\S]*?)CLAUDE_EOF/);
		assert.ok(prompt, 'Claude-Prompt-Block nicht gefunden');
		for (const marker of ['CI-CHECKS BEHANDELN', 'FLAKY', 'ECHTER CI-FEHLER', 'UNRELATED CI-FEHLER']) {
			assert.ok(prompt[1].includes(marker), `Prompt ohne "${marker}" — Fixup reicht rote CI-Checks unbehandelt weiter`);
		}
	});
});
