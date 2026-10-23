import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests für container-result.sh — die Marker-Extraktion aus beiden Fundorten (#2590).
 *
 * AK5: Marker nur im Log, nur im Harness-Kommentar, in beiden (Ausgabe gewinnt),
 * in keinem (beide Felder leer, Exit 0), plus ein result, das weder closed noch
 * followup ist (Payload vorhanden, der jq-Schritt des Steps liest result leer).
 *
 * Das Skript braucht keine gh-Emulation — reine Datei-Inputs. Läuft über
 * `pnpm test:scripts`.
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'container-result.sh');

let dir: string;

const run = (args: string[]): ReturnType<typeof spawnSync> =>
	spawnSync('bash', [script, ...args], { encoding: 'utf8' });

const marker = (payload: string) =>
	`<!-- ai-container-result:START -->\n\`\`\`json\n${payload}\n\`\`\`\n<!-- ai-container-result:END -->\n`;

const write = (name: string, content: string) => {
	const path = join(dir, name);
	writeFileSync(path, content);
	return path;
};

const fields = (stdout: string) => ({
	payload: (/^payload=(.*)$/m.exec(stdout)?.[1] ?? null) as string | null,
	source: (/^source=(.*)$/m.exec(stdout)?.[1] ?? null) as string | null,
});

before(() => {
	dir = mkdtempSync(join(tmpdir(), 'container-result-'));
});

after(() => rmSync(dir, { recursive: true, force: true }));

describe('container-result.sh — Argumentfehler', () => {
	it('exitet mit 2, wenn der Unterbefehl fehlt', () => {
		const res = run([]);
		assert.equal(res.status, 2);
		assert.match(res.stderr, /extract/);
	});

	it('exitet mit 2, wenn --log am Ende ohne Wert steht', () => {
		const res = run(['extract', '--log']);
		assert.equal(res.status, 2);
		assert.match(res.stderr, /--log/);
	});
});

describe('container-result.sh — Fundorte', () => {
	it('findet den Marker nur im Log → payload + source=log', () => {
		const log = write('nur-log.md', marker('{"result":"closed","reason":"alle Sub-Issues erledigt"}'));
		const res = run(['extract', '--log', log, '--body-file', join(dir, 'fehlt.md')]);
		assert.equal(res.status, 0);
		assert.deepEqual(fields(res.stdout), {
			payload: '{"result":"closed","reason":"alle Sub-Issues erledigt"}',
			source: 'log',
		});
	});

	it('findet den Marker nur im Harness-Kommentar → payload + source=comment', () => {
		const log = write('ohne-marker.md', 'Normale Analyse-Ausgabe ohne Marker.\n');
		const body = write('nur-kommentar.md', marker('{"result":"followup","tickets":[]}'));
		const res = run(['extract', '--log', log, '--body-file', body]);
		assert.equal(res.status, 0);
		assert.deepEqual(fields(res.stdout), {
			payload: '{"result":"followup","tickets":[]}',
			source: 'comment',
		});
	});

	it('findet den Marker in beiden → Ausgabe gewinnt (source=log)', () => {
		const log = write('beide-log.md', marker('{"result":"closed","reason":"aus der Ausgabe"}'));
		const body = write('beide-kommentar.md', marker('{"result":"followup","tickets":[]}'));
		const res = run(['extract', '--log', log, '--body-file', body]);
		assert.equal(res.status, 0);
		assert.deepEqual(fields(res.stdout), {
			payload: '{"result":"closed","reason":"aus der Ausgabe"}',
			source: 'log',
		});
	});

	it('findet keinen Marker → beide Felder leer, Exit 0 (fail-open)', () => {
		const log = write('leer-log.md', 'kein Marker\n');
		const body = write('leer-kommentar.md', '<!-- ai-harness -->\nAnalyse ohne Container-Marker\n');
		const res = run(['extract', '--log', log, '--body-file', body]);
		assert.equal(res.status, 0);
		assert.deepEqual(fields(res.stdout), { payload: '', source: '' });
	});
});

describe('container-result.sh — result unlesbar', () => {
	it('liefert den Payload; der jq-Schritt des Steps liest result leer', () => {
		const log = write('unlesbar.md', marker('{"foo":"bar"}'));
		const res = run(['extract', '--log', log, '--body-file', join(dir, 'fehlt.md')]);
		assert.equal(res.status, 0);
		const { payload, source } = fields(res.stdout);
		assert.equal(source, 'log');
		// Was der Step damit macht (jq -r '.result // empty') → result bleibt leer:
		const parsed = JSON.parse(payload ?? '') as { result?: string };
		assert.equal(parsed.result, undefined);
	});
});
