// Rote Spec-Tests für #619 — Startup-Error-Handling
//
// Vertrag: Bei kritischen Startup-Fehlern beendet der Prozess sich sofort mit process.exit(1),
// nicht im Zombie-Zustand weiter. Spec: docs/spec/issue-619.md
//
// AK 1: Startup-Catch-all bei Fehler mit process.exit(1)
// AK 2: UnhandledRejection Handler (loggen + exit)
// AK 3: UncaughtException Handler (loggen + exit)
// AK 4: App.listen Error-Callback (loggen + exit)
//
// Diese Tests sind rot, weil die Implementierung in server/src/index.ts und
// server/src/express/index.ts noch fehlt.
import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

/** Sammelt alle an console.log/error übergebenen Argumente eines Mocks zu einem durchsuchbaren String. */
function loggedOutput(logMock: ReturnType<typeof mock.method>): string {
	return logMock.mock.calls
		.map((call) =>
			call.arguments.map((argument) => (typeof argument === 'string' ? argument : JSON.stringify(argument))).join(' '),
		)
		.join('\n');
}

describe('Rote Spec-Tests für #619 — Startup-Error-Handling (docs/spec/issue-619.md)', () => {
	let exitMock: ReturnType<typeof mock.method>;
	let logMock: ReturnType<typeof mock.method>;
	let errorMock: ReturnType<typeof mock.method>;
	let main: () => Promise<void>;

	beforeEach(async () => {
		// RUN_MAIN=false setzen VOR dem Import, damit main() nicht automatisch ausgeführt wird
		process.env.RUN_MAIN = 'false';

		// Mocks für process.exit und console einrichten
		exitMock = mock.method(process, 'exit', () => {
			throw new Error('process.exit(1) was called — test passes');
		});
		logMock = mock.method(console, 'log');
		errorMock = mock.method(console, 'error');

		// Modul bei jedem Test neu laden, um Isolation zu gewährleisten
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
			// Arrange: Invalid DATABASE_STORAGE setzen (Projekt verwendet DATABASE_STORAGE, nicht DATABASE_URL)
			// Marker für Test-Validierung in index.ts
			process.env.DATABASE_STORAGE = 'invalid://test-database';

			// Act & Assert: main() sollte process.exit(1) aufrufen
			try {
				await main();
				assert.fail('main() sollte process.exit(1) aufrufen und nicht normal zurückkehren');
			} catch (error) {
				assert.match(
					(error as Error).message,
					/process\.exit\(1\) was called/,
					'Bei invalid .env muss process.exit(1) aufgerufen werden',
				);
				assert.equal(exitMock.mock.callCount(), 1, 'process.exit sollte genau einmal aufgerufen werden');
				assert.deepEqual(exitMock.mock.calls[0].arguments, [1], 'process.exit sollte mit Code 1 aufgerufen werden');
			}

			// Spec-Bezug: docs/spec/issue-619.md, Schritte 1
			const errorOutput = loggedOutput(errorMock);
			assert.ok(errorOutput.length > 0, 'Fehler sollte vor dem Exit geloggt werden');
		});

		it('bei fehlender Required-Env-Var wird process.exit(1) aufgerufen', async () => {
			// Arrange: Required-Env-Var löschen (DATABASE_STORAGE auf ungültigen Pfad setzen)
			process.env.DATABASE_STORAGE = '';

			// Act & Assert: main() sollte process.exit(1) aufrufen
			try {
				await main();
				assert.fail('main() sollte process.exit(1) aufrufen und nicht normal zurückkehren');
			} catch (error) {
				assert.match(
					(error as Error).message,
					/process\.exit\(1\) was called/,
					'Bei fehlender Required-Env-Var muss process.exit(1) aufgerufen werden',
				);
				assert.equal(exitMock.mock.callCount(), 1, 'process.exit sollte genau einmal aufgerufen werden');
			}

			// Spec-Bezug: docs/spec/issue-619.md, Schritte 1
			const errorOutput = loggedOutput(errorMock);
			assert.ok(errorOutput.length > 0, 'Fehler sollte vor dem Exit geloggt werden');
		});
	});

	describe('AK 2 — UnhandledRejection Handler', () => {
		it('Unhandled Rejection im Startup führt zu process.exit(1)', async () => {
			// Arrange: Promise der im Startup rejected wird
			process.env.TEST_UNHANDLED_REJECTION = 'true';

			// Act & Assert: main() sollte process.exit(1) aufrufen
			try {
				await main();
				assert.fail('main() sollte bei unhandled rejection process.exit(1) aufrufen');
			} catch (error) {
				assert.match(
					(error as Error).message,
					/process\.exit\(1\) was called/,
					'Bei unhandled rejection muss process.exit(1) aufgerufen werden',
				);
				assert.equal(exitMock.mock.callCount(), 1, 'process.exit sollte genau einmal aufgerufen werden');
			}

			// Spec-Bezug: docs/spec/issue-619.md, Schritte 2
			const errorOutput = loggedOutput(errorMock);
			assert.ok(errorOutput.length > 0, 'Unhandled rejection sollte vor dem Exit geloggt werden');
			assert.match(errorOutput, /UnhandledRejection/i, 'Log sollte UnhandledRejection erwähnen');
		});
	});

	describe('AK 3 — UncaughtException Handler', () => {
		it('Uncaught Exception im Startup führt zu process.exit(1)', async () => {
			// Arrange: Exception der im Startup geworfen wird
			process.env.TEST_UNCAUGHT_EXCEPTION = 'true';

			// Act & Assert: main() sollte process.exit(1) aufrufen
			try {
				await main();
				assert.fail('main() sollte bei uncaught exception process.exit(1) aufrufen');
			} catch (error) {
				assert.match(
					(error as Error).message,
					/process\.exit\(1\) was called/,
					'Bei uncaught exception muss process.exit(1) aufgerufen werden',
				);
				assert.equal(exitMock.mock.callCount(), 1, 'process.exit sollte genau einmal aufgerufen werden');
			}

			// Spec-Bezug: docs/spec/issue-619.md, Schritte 3
			const errorOutput = loggedOutput(errorMock);
			assert.ok(errorOutput.length > 0, 'Uncaught exception sollte vor dem Exit geloggt werden');
			assert.match(errorOutput, /UncaughtException/i, 'Log sollte UncaughtException erwähnen');
		});
	});

	describe('AK 4 — App.listen Error-Callback', () => {
		it('bei belegtem Port wird app.listen Error-Callback mit process.exit(1) aufgerufen', async () => {
			// Arrange: Port belegen durch Test-Server
			process.env.PORT = '3000';

			// Act & Assert: main() sollte process.exit(1) aufrufen
			try {
				await main();
				assert.fail('main() sollte bei belegtem Port process.exit(1) aufrufen');
			} catch (error) {
				assert.match(
					(error as Error).message,
					/process\.exit\(1\) was called/,
					'Bei belegtem Port muss app.listen Error-Callback process.exit(1) aufrufen',
				);
				assert.equal(exitMock.mock.callCount(), 1, 'process.exit sollte genau einmal aufgerufen werden');
			}

			// Spec-Bezug: docs/spec/issue-619.md, Schritte 4
			const errorOutput = loggedOutput(errorMock);
			assert.ok(errorOutput.length > 0, 'Port-belegt-Fehler sollte vor dem Exit geloggt werden');
			assert.match(errorOutput, /EADDRINUSE|port.*belegt/i, 'Log sollte Port-belegt-Fehler erwähnen');
		});
	});

	describe('Normaler Startup (kein Exit)', () => {
		it('bei korrekter Konfiguration läuft Server ohne process.exit(1)', async () => {
			// Arrange: Gültige Konfiguration
			process.env.PORT = '3001'; // Anderer Port als Test-Server
			process.env.DATABASE_URL = './database.test.sqlite';

			// Act & Assert: main() sollte normal zurückkehren, nicht process.exit(1)
			const exitCountBefore = exitMock.mock.callCount();
			await main();
			const exitCountAfter = exitMock.mock.callCount();

			assert.equal(
				exitCountAfter,
				exitCountBefore,
				'Bei korrekter Konfiguration sollte process.exit NICHT aufgerufen werden',
			);

			// Spec-Bezug: docs/spec/issue-619.md, Erwartetes Ergebnis
			const logOutput = loggedOutput(logMock);
			assert.ok(logOutput.length > 0, 'Server-Start sollte geloggt werden');
		});
	});
});
