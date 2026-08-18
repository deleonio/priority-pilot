import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTarget, isValidationTarget, validateSource } from './validate-actions.ts';

/**
 * Fixtures gegen `validateSource` — reine Inline-YAML-Strings, kein Dateisystem.
 *
 * Der Kern ist die dokumentierte Ausnahme in `isKnownSchemaGap`: sie darf GENAU den
 * `concurrency.queue`-Befund schlucken und sonst nichts. Jeder Fall unten fixiert eine
 * Kante dieser Grenze; ohne sie fällt eine Erweiterung des Filters still auf „alles grün".
 *
 * Läuft über `pnpm test:scripts` (node:test + tsx, wie die Server-Suite).
 */

const workflow = (body: string): string =>
	`on: push\n${body}jobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo\n`;

describe('classifyTarget', () => {
	it('erkennt Composite-Actions am Dateinamen, alles andere ist ein Workflow', () => {
		assert.equal(classifyTarget('.github/actions/setup/action.yml'), 'action');
		assert.equal(classifyTarget('.github/actions/setup/action.yaml'), 'action');
		assert.equal(classifyTarget('.github/workflows/ci.yml'), 'workflow');
	});
});

describe('isValidationTarget', () => {
	it('lässt Workflows und Composite-Actions durch', () => {
		assert.equal(isValidationTarget('.github/workflows/ci.yml'), true);
		assert.equal(isValidationTarget('.github/actions/setup-claude/action.yml'), true);
	});

	it('filtert fremde YAML-Dateien und Nicht-YAML aus lefthooks weiter Auswahl', () => {
		assert.equal(isValidationTarget('openapi.yml'), false);
		assert.equal(isValidationTarget('.github/dependabot.yml'), false);
		// Unterhalb von .github/actions zählt nur die action.yml selbst, nicht deren Beiwerk.
		assert.equal(isValidationTarget('.github/actions/setup-claude/notes.yml'), false);
		assert.equal(isValidationTarget('.github/workflows/ci.json'), false);
	});
});

describe('validateSource — gültige Eingaben', () => {
	it('meldet einen sauberen Workflow als fehlerfrei', () => {
		const report = validateSource('.github/workflows/ok.yml', workflow(''));
		assert.deepEqual(report.errors, []);
		assert.equal(report.suppressed, 0);
	});
});

describe('validateSource — echte Befunde bleiben rot', () => {
	it('findet einen falsch geschriebenen Key (`runs_on` statt `runs-on`)', () => {
		const source = 'on: push\njobs:\n  a:\n    runs_on: ubuntu-latest\n    steps:\n      - run: echo\n';
		const report = validateSource('.github/workflows/typo.yml', source);
		assert.equal(report.errors.length, 1);
		assert.equal(report.suppressed, 0);
	});

	it('meldet kaputtes YAML als parse_error', () => {
		const report = validateSource('.github/workflows/broken.yml', 'on: push\njobs:\n  a: [unclosed\n');
		assert.equal(report.errors.length, 1);
		assert.equal(report.errors[0].code, 'parse_error');
	});

	it('meldet eine Composite-Action ohne `runs` als fehlendes Pflichtfeld', () => {
		const report = validateSource('.github/actions/x/action.yml', 'name: x\ndescription: y\n');
		assert.equal(report.actionType, 'action');
		assert.equal(report.errors.length, 1);
		assert.equal(report.errors[0].code, 'required');
	});
});

describe('validateSource — Grenze der bekannten Schema-Lücke (concurrency.queue)', () => {
	it('schluckt `queue: max` — und beziffert die Unterdrückung', () => {
		const report = validateSource('.github/workflows/queue.yml', workflow('concurrency:\n  group: g\n  queue: max\n'));
		assert.deepEqual(report.errors, []);
		assert.equal(report.suppressed, 1);
	});

	it('schluckt `queue: max` NICHT, wenn im selben Block ein unbekannter Key steht', () => {
		const source = workflow('concurrency:\n  group: g\n  queue: max\n  bogus: 1\n');
		const report = validateSource('.github/workflows/queue-bogus.yml', source);
		assert.equal(report.errors.length, 1);
		assert.equal(report.suppressed, 0);
	});

	it('lässt `concurrency` ohne `group` rot', () => {
		const report = validateSource(
			'.github/workflows/nogroup.yml',
			workflow('concurrency:\n  cancel-in-progress: true\n'),
		);
		assert.equal(report.errors.length, 1);
		assert.equal(report.suppressed, 0);
	});

	// Regression zu Review #897/Finding 1: hier scheitern BEIDE oneOf-Zweige nur am Typ
	// („must be string" / „must be object"). Ein Filter, der bloß auf „nichts als Rauschen"
	// prüft statt die Anwesenheit des queue-Befunds zu fordern, schluckt diese Fälle still.
	it('lässt ein falsch getyptes `concurrency` (Zahl) rot', () => {
		const report = validateSource('.github/workflows/num.yml', workflow('concurrency: 42\n'));
		assert.equal(report.errors.length, 1);
		assert.equal(report.suppressed, 0);
	});

	it('lässt ein falsch getyptes `concurrency` (Liste) rot', () => {
		const report = validateSource('.github/workflows/list.yml', workflow('concurrency:\n  - a\n  - b\n'));
		assert.equal(report.errors.length, 1);
		assert.equal(report.suppressed, 0);
	});
});
