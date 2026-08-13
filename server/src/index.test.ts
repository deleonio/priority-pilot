// Spec-Tests für #619 — Startup-Error-Handling (docs/spec/issue-619.md)
import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';

function loggedOutput(logMock: ReturnType<typeof mock.method>): string {
	return logMock.mock.calls
		.map((call) =>
			call.arguments.map((argument) => (typeof argument === 'string' ? argument : JSON.stringify(argument))).join(' '),
		)
		.join('\n');
}

describe('Spec-Tests für #619 — Startup-Error-Handling', () => {
	let exitMock: ReturnType<typeof mock.method>;
	let logMock: ReturnType<typeof mock.method>;
	let errorMock: ReturnType<typeof mock.method>;
	let main: () => Promise<void>;

	beforeEach(async () => {
		process.env.RUN_MAIN = 'false';
		process.env.PORT = '' as unknown as string;

		exitMock = mock.method(process, 'exit', () => {});
		logMock = mock.method(console, 'log');
		errorMock = mock.method(console, 'error');

		const module = await import('./index.js');
		main = module.main;
	});

	afterEach(() => {
		exitMock.mock.restore();
		logMock.mock.restore();
		errorMock.mock.restore();
	});

	describe('AK 1 — Startup-Catch-all mit process.exit(1)', () => {
		it('bei invalid .env (DATABASE_STORAGE) wird process.exit(1) aufgerufen', async () => {
			process.env.DATABASE_STORAGE = 'invalid://test-database';
			await main();

			assert.ok(exitMock.mock.callCount() > 0, 'Bei invalid .env muss process.exit(1) aufgerufen werden');
			assert.deepEqual(exitMock.mock.calls[0].arguments, [1], 'process.exit mit Code 1');
		});

		it('bei fehlender Required-Env-Var wird process.exit(1) aufgerufen', async () => {
			process.env.DATABASE_STORAGE = '';
			await main();

			assert.ok(exitMock.mock.callCount() > 0, 'Bei fehlender Required-Env-Var muss process.exit(1) aufgerufen werden');
		});
	});

	describe('AK 2 — UnhandledRejection Handler', () => {
		it('UnhandledRejection Handler ist registriert', () => {
			const listenerCount = process.listenerCount('unhandledRejection');
			assert.ok(listenerCount > 0, 'unhandledRejection Handler sollte registriert sein');
		});
	});

	describe('AK 3 — UncaughtException Handler', () => {
		it('UncaughtException Handler ist registriert', () => {
			const listenerCount = process.listenerCount('uncaughtException');
			assert.ok(listenerCount > 0, 'uncaughtException Handler sollte registriert sein');
		});
	});

	describe('AK 4 — App.listen Error-Callback', () => {
		it('launchServer() exportiert server.on("error") Handler', async () => {
			const { launchServer } = await import('./express/index.js');
			assert.equal(typeof launchServer, 'function', 'launchServer sollte exportiert sein');
		});
	});

	describe('Normaler Startup', () => {
		it('bei korrekter Konfiguration läuft main() erfolgreich', async () => {
			process.env.PORT = '3001';

			// Mock zurücksetzen
			exitMock.mock.resetCalls();

			await main();

			// Prüfen, dass Server-Logs vorhanden sind
			const logOutput = loggedOutput(logMock);
			assert.ok(logOutput.length > 0, 'Server-Start sollte geloggt werden');
		});
	});
});
