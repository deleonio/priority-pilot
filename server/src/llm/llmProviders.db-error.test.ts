import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import { LlmProvider, User } from '../models/index.js';
import { findProviderByName, hasOwnProviderSelection, loadActiveProvider } from './llmProviders.js';
import { MissingApiKeyError, parseSearchQueryWithMistral } from './llm.js';

/**
 * Spec docs/spec/issue-2687 — DB-Fehler in der Provider-Auflösung sichtbar loggen.
 *
 * AK1–AK3: Die stillen Catches in `loadActiveProvider`, `hasOwnProviderSelection` und
 * `findProviderByName` loggen die Fehlerursache per `console.error` (genau eine Zeile mit
 * Ursache), bevor der bisherige Fallback (`null`/`false`) greift.
 * AK4/AK5: Über den öffentlichen Pfad bleibt der Vertrag unverändert — DB-Fehler bei der
 * Auflösung liefert `MissingApiKeyError` (→ 503), die Ursache steht im Log.
 *
 * Trigger per Methoden-Override an den Sequelize-Modellstatiken; `ensureBuiltins` hat einen
 * eigenen, bewusst stillen Catch (Tabelle fehlt ohne DB-Sync) — dieser bleibt unangetastet
 * und zählt NICHT als Logzeile. KEIN Produktivcode.
 */

const throwsCause = (cause: Error) => async () => {
	throw cause;
};

/** Format-robust: alle Argumente aller console.error-Aufrufe als ein Text. */
const logText = (errorMock: ReturnType<typeof mock.method>) =>
	errorMock.mock.calls.map((call) => call.arguments.map(String).join(' ')).join('\n');

describe('DB-Fehler in der Provider-Auflösung werden geloggt (#2687)', () => {
	let cause: Error;

	beforeEach(async () => {
		await sequelize.sync({ force: true });
		cause = new Error('Datenbank nicht erreichbar');
	});

	it('AK1: loadActiveProvider loggt die Ursache und liefert weiterhin null', async () => {
		const findAll = mock.method(LlmProvider, 'findAll', throwsCause(cause));
		const errors = mock.method(console, 'error', () => {});
		try {
			assert.equal(await loadActiveProvider(), null);
			assert.equal(errors.mock.callCount(), 1, 'genau eine Logzeile');
			assert.match(logText(errors), /Datenbank nicht erreichbar/, 'Log enthält die Ursache');
		} finally {
			findAll.mock.restore();
			errors.mock.restore();
		}
	});

	it('AK2: hasOwnProviderSelection loggt die Ursache und liefert weiterhin false', async () => {
		const findByPk = mock.method(User, 'findByPk', throwsCause(cause));
		const errors = mock.method(console, 'error', () => {});
		try {
			assert.equal(await hasOwnProviderSelection(42), false);
			assert.equal(errors.mock.callCount(), 1, 'genau eine Logzeile');
			assert.match(logText(errors), /Datenbank nicht erreichbar/, 'Log enthält die Ursache');
		} finally {
			findByPk.mock.restore();
			errors.mock.restore();
		}
	});

	it('AK3: findProviderByName loggt die Ursache und liefert weiterhin null', async () => {
		const findOne = mock.method(LlmProvider, 'findOne', throwsCause(cause));
		const errors = mock.method(console, 'error', () => {});
		try {
			assert.equal(await findProviderByName('mistral'), null);
			assert.equal(errors.mock.callCount(), 1, 'genau eine Logzeile');
			assert.match(logText(errors), /Datenbank nicht erreichbar/, 'Log enthält die Ursache');
		} finally {
			findOne.mock.restore();
			errors.mock.restore();
		}
	});

	it('AK4/AK5: öffentlicher Pfad — MissingApiKeyError (503) unverändert, Ursache geloggt', async () => {
		const findByPk = mock.method(User, 'findByPk', throwsCause(cause));
		const errors = mock.method(console, 'error', () => {});
		try {
			await assert.rejects(
				() => parseSearchQueryWithMistral('einkaufen', undefined, [], 42),
				MissingApiKeyError,
				'Antwortvertrag unverändert: kein Provider → MissingApiKeyError (503)',
			);
			assert.equal(errors.mock.callCount(), 1, 'genau eine Logzeile');
			assert.match(logText(errors), /Datenbank nicht erreichbar/, 'Log enthält die Ursache');
		} finally {
			findByPk.mock.restore();
			errors.mock.restore();
		}
	});
});
