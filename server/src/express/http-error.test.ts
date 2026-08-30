/**
 * Zentraler Fehlervertrag (Issue #1130) — rote Spec-Tests.
 *
 * AK1–AK3: `sendError`, `handleWriteError` und `parseId` existieren genau einmal in
 *   `server/src/express/http-error.ts`; die Routen importieren sie, statt lokale Kopien
 *   zu pflegen (TF1 — Dubletten-Wächter über den Quelltext).
 * AK4: Verhalten der drei Helfer mit Mock-`res` bzw. direkten Assertions (TF2).
 * AK5: `error-contract.test.ts` bleibt der unveränderte Verhaltensnachweis für den
 *   HTTP-Vertrag — hier kein Duplikat-Test (siehe docs/spec/issue-1130.md).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ValidationError as SequelizeValidationError } from 'sequelize';

// ── Modul (noch nicht vorhanden → legitimer erster roter Zustand) ──────────────────────────
import { sendError, handleWriteError, parseId } from './http-error.js';

const ROUTE_FILES = [
	'routes/tasks.ts',
	'routes/series.ts',
	'routes/pillars.ts',
	'routes/push.ts',
	'routes/geoConfig.ts',
	'routes/llmProviders.ts',
	'routes/lektorat.ts',
	'routes/suggestPillars.ts',
	'routes/pillarAdvisor.ts',
];

const INLINE_500_FILES = ['routes/scores.ts', 'index.ts', 'routes/llmProviders.ts'];

const srcRoot = fileURLToPath(new URL('./', import.meta.url));

/** Rekursiv alle Quelldateien unter server/src (ohne node_modules/Build-Artefakte). */
const listSources = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		return entry.isDirectory() && entry.name !== 'node_modules' ? listSources(path) : entry.isFile() ? [path] : [];
	});

const read = (rel: string): string => readFileSync(join(srcRoot, rel), 'utf8');

/** Mock-Response mit Status-/JSON-Spies. */
const mockRes = () => {
	const calls: { status?: number; body?: unknown } = {};
	return {
		calls,
		status(code: number) {
			calls.status = code;
			return this;
		},
		json(body: unknown) {
			calls.body = body;
			return this;
		},
	};
};

describe('Issue #1130 — Dubletten-Wächter (AK1–AK3, TF1)', () => {
	it('definiert sendError/handleWriteError/parseId nirgends lokal in server/src', () => {
		const offenders: string[] = [];
		for (const file of listSources(srcRoot)) {
			const source = readFileSync(file, 'utf8');
			for (const name of ['sendError', 'handleWriteError', 'parseId']) {
				// Muster bewusst zusammengesetzt, damit diese Datei sich nicht selbst trifft.
				if (new RegExp(`const ${name} *=`).test(source)) offenders.push(`${file}: const ${name}`);
			}
		}
		assert.deepEqual(offenders, []);
	});

	it('alle neun Routendateien importieren sendError aus ./http-error.js', () => {
		const missing = ROUTE_FILES.filter(
			(file) => !new RegExp(`import \\{[^}]*sendError[^}]*\\} from '(\\.\\./)+http-error\\.js'`).test(read(file)),
		);
		assert.deepEqual(missing, []);
	});

	it('tasks/series/llmProviders nutzen den gemeinsamen parseId bzw. handleWriteError', () => {
		for (const file of ['routes/tasks.ts', 'routes/series.ts', 'routes/llmProviders.ts']) {
			assert.match(read(file), /from '(?:(?:\.\.)\/)+http-error\.js'/);
		}
		const missingHandleWriteError = ['routes/tasks.ts', 'routes/series.ts'].filter(
			(file) =>
				!new RegExp(`import \\{[^}]*handleWriteError[^}]*\\} from '(\\.\\./)+http-error\\.js'`).test(read(file)),
		);
		assert.deepEqual(missingHandleWriteError, []);
		const missingParseId = ['routes/tasks.ts', 'routes/series.ts', 'routes/llmProviders.ts'].filter(
			(file) => !new RegExp(`import \\{[^}]*parseId[^}]*\\} from '(\\.\\./)+http-error\\.js'`).test(read(file)),
		);
		assert.deepEqual(missingParseId, []);
	});

	it('keine Inline-500-Responses mehr in scores.ts, express/index.ts und llmProviders.ts', () => {
		const offenders = INLINE_500_FILES.filter((file) =>
			read(file).includes("res.status(500).json({ message: 'Interner Serverfehler.' })"),
		);
		assert.deepEqual(offenders, []);
	});
});

describe('Issue #1130 — sendError (AK4, TF2)', () => {
	it('setzt Statuscode und Body { message }', () => {
		const res = mockRes();
		sendError(res as never, 422, 'Ungültige Eingabe.');
		assert.equal(res.calls.status, 422);
		assert.deepEqual(res.calls.body, { message: 'Ungültige Eingabe.' });
	});
});

describe('Issue #1130 — handleWriteError (AK4, TF2)', () => {
	it("mappt SequelizeValidationError auf 400 mit '; '-verbundener Sammelmeldung", () => {
		const res = mockRes();
		const error = new SequelizeValidationError([
			{ message: 'Validation len on title failed' },
			{ message: 'Validation notEmpty on title failed' },
		] as never);
		handleWriteError(res as never, error);
		assert.equal(res.calls.status, 400);
		assert.deepEqual(res.calls.body, {
			message: 'Validation len on title failed; Validation notEmpty on title failed',
		});
	});

	it('mappt jeden anderen Fehler auf 500 "Interner Serverfehler."', () => {
		const res = mockRes();
		handleWriteError(res as never, new Error('Datenbank weg'));
		assert.equal(res.calls.status, 500);
		assert.deepEqual(res.calls.body, { message: 'Interner Serverfehler.' });
	});
});

describe('Issue #1130 — parseId (AK4, TF2)', () => {
	it('akzeptiert positive Ganzzahlen — auch als Pfad-Array', () => {
		assert.equal(parseId('7'), 7);
		assert.equal(parseId(['7']), 7);
		assert.equal(parseId('12'), 12);
	});

	it('lehnt 0, negative Zahlen, Brüche und Nicht-Zahlen ab', () => {
		for (const raw of ['0', '-1', '2.5', 'abc', '', ['0'], ['-1']]) {
			assert.equal(parseId(raw as never), null, `parseId(${JSON.stringify(raw)}) sollte null liefern`);
		}
	});
});
