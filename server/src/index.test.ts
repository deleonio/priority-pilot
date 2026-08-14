// Spec-Tests für #619 — Startup-Error-Handling (docs/spec/issue-619.md)
//
// Prüfgegenstand sind die vier AKs (invalid .env / UnhandledRejection / UncaughtException /
// app.listen-Error) — alle müssen mit `process.exit(1)` enden. Die Tests dürfen NIEMALS einen echten
// HTTP-Server oder Scheduler am Leben lassen, sonst terminiert `node --test` nicht (CI-Hang).
// Daher: exit ist gemockt, der Exit-Guard wird pro Test zurückgesetzt, und die Handler-Funktionen
// werden per Direktaufruf geprüft (eine echte unhandled Rejection / ein echter belegter Port würde
// node:test abfangen bzw. die Suite blockieren).
//
// Wichtig: index.ts lädt src/logics erst dynamisch INNERHALB von main() (nach der Config-Prüfung).
// Dadurch importiert dieser Test keine src/logics-Module und scheitert nicht am Coverage-Schwellwert.
import { describe, it, mock, before, beforeEach, after, afterEach } from 'node:test';
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
	let resetExitGuard: () => void;
	let handleUnhandledRejection: (reason: unknown) => void;
	let handleUncaughtException: (error: unknown) => void;
	let handleServerError: (error: NodeJS.ErrnoException, port: number) => void;
	let savedEnv: Record<string, string | undefined>;

	before(async () => {
		// RUN_MAIN MUSS vor dem Import auf 'false' stehen, sonst führt das Modul beim Import
		// automatisch main() aus (Serverstart + Scheduler) → Endlos-Hang in der Suite.
		savedEnv = {
			DATABASE_STORAGE: process.env.DATABASE_STORAGE,
			PORT: process.env.PORT,
			RUN_MAIN: process.env.RUN_MAIN,
		};
		process.env.RUN_MAIN = 'false';

		const module = await import('./index.js');
		main = module.main;
		resetExitGuard = module.resetExitGuard;
		handleUnhandledRejection = module.handleUnhandledRejection;
		handleUncaughtException = module.handleUncaughtException;
		({ handleServerError } = await import('./express/server-error-handler.js'));
	});

	beforeEach(() => {
		// Pro Test frisch: Exit-Guard zurück + process.exit/console gemockt.
		resetExitGuard();
		exitMock = mock.method(process, 'exit', () => {});
		logMock = mock.method(console, 'log');
		errorMock = mock.method(console, 'error');
	});

	afterEach(() => {
		exitMock.mock.restore();
		logMock.mock.restore();
		errorMock.mock.restore();
	});

	after(() => {
		// ENV restaurieren — Tests dürfen process.env nicht verschmutzen.
		for (const [key, value] of Object.entries(savedEnv)) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
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
		it('UnhandledRejection Handler ruft bei Trigger process.exit(1) auf', () => {
			// Handler-Funktion direkt aufrufen (registriert in index.ts via process.on).
			// Eine echte unhandled Rejection würde node:test abfangen und den Test scheitern lassen.
			handleUnhandledRejection(new Error('TEST_UNHANDLED_REJECTION'));

			assert.ok(exitMock.mock.callCount() > 0, 'UnhandledRejection muss zu process.exit(1) führen');
			assert.deepEqual(exitMock.mock.calls[0].arguments, [1], 'Exit-Code muss 1 sein');
			assert.ok(loggedOutput(errorMock).includes('UnhandledRejection'), 'Fehler sollte geloggt werden');
		});
	});

	describe('AK 3 — UncaughtException Handler', () => {
		it('UncaughtException Handler ruft bei Trigger process.exit(1) auf', () => {
			handleUncaughtException(new Error('TEST_UNCAUGHT_EXCEPTION'));

			assert.ok(exitMock.mock.callCount() > 0, 'UncaughtException muss zu process.exit(1) führen');
			assert.deepEqual(exitMock.mock.calls[0].arguments, [1], 'Exit-Code muss 1 sein');
			assert.ok(loggedOutput(errorMock).includes('UncaughtException'), 'Fehler sollte geloggt werden');
		});
	});

	describe('AK 4 — App.listen Error-Callback', () => {
		it('Server-Fehler EADDRINUSE (belegter Port) führt zu process.exit(1)', () => {
			// handleServerError ist der Error-Callback, den launchServer an server.on('error') hängt.
			// Direktaufruf statt echtem app.listen — ein belegter Port würde die Suite blockieren.
			handleServerError({ code: 'EADDRINUSE' } as NodeJS.ErrnoException, 3000);

			assert.ok(exitMock.mock.callCount() > 0, 'EADDRINUSE muss zu process.exit(1) führen');
			assert.deepEqual(exitMock.mock.calls[0].arguments, [1], 'Exit-Code muss 1 sein');
			assert.ok(loggedOutput(errorMock).includes('EADDRINUSE'), 'EADDRINUSE sollte geloggt werden');
		});

		it('auch ein anderer Server-Fehler führt zu process.exit(1)', () => {
			handleServerError({ code: 'EACCES' } as NodeJS.ErrnoException, 3000);

			assert.ok(exitMock.mock.callCount() > 0, 'Anderer Server-Fehler muss ebenfalls zu exit(1) führen');
			assert.deepEqual(exitMock.mock.calls[0].arguments, [1], 'Exit-Code muss 1 sein');
		});
	});
});
