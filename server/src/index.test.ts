// Rote Spec-Tests für #180 — ENV-Konfiguration beim Serverstart loggen
//
// Vertrag: Beim Serverstart loggt `logEnvConfig()` die relevanten ENV-Variablen.
// Secrets (MISTRAL_API_KEY) werden maskiert und tauchen nie im Klartext auf.
// Default-Werte werden als solche kenntlich gemacht.
//
// Designentscheidung: Die Funktion wird aus dem (noch zu erstellenden) Modul
// `./env-startup-log.js` importiert — NICHT aus `./index.js`. `index.ts` führt
// sofort `main()` aus und benötigt eine DB; das hätte Seiteneffekte beim Import.
// Solange `env-startup-log.ts` fehlt, schlägt der Import fehl → legitime Rotfärbung.
import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { logEnvConfig } from './env-startup-log.js';

// Die ENV-Variablen, die diese Tests anfassen — werden vor/nach jedem Test sauber wiederhergestellt.
const TOUCHED_ENV_KEYS = [
	'PORT',
	'MISTRAL_API_KEY',
	'MISTRAL_MODEL',
	'DATABASE_STORAGE',
	'DB_RESET',
	'DB_SEED',
] as const;

/** Schnappschuss der relevanten ENV-Variablen, damit Tests sich nicht gegenseitig beeinflussen. */
function snapshotEnv(): Record<string, string | undefined> {
	const snapshot: Record<string, string | undefined> = {};
	for (const key of TOUCHED_ENV_KEYS) {
		snapshot[key] = process.env[key];
	}
	return snapshot;
}

/** Stellt den ENV-Schnappschuss wieder her (löscht Keys, die vorher nicht gesetzt waren). */
function restoreEnv(snapshot: Record<string, string | undefined>): void {
	for (const key of TOUCHED_ENV_KEYS) {
		const value = snapshot[key];
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
}

/** Sammelt alle an console.log übergebenen Argumente eines Mocks zu einem durchsuchbaren String. */
function loggedOutput(logMock: ReturnType<typeof mock.method>): string {
	return logMock.mock.calls
		.map((call) =>
			call.arguments
				.map((argument) => (typeof argument === 'string' ? argument : JSON.stringify(argument)))
				.join(' '),
		)
		.join('\n');
}

describe('Rote Spec-Tests für #180 — logEnvConfig()', () => {
	let envSnapshot: Record<string, string | undefined>;
	let logMock: ReturnType<typeof mock.method>;

	beforeEach(() => {
		envSnapshot = snapshotEnv();
		// Tabula rasa: alle berührten Keys löschen, damit jeder Test seinen Ausgangszustand selbst setzt.
		for (const key of TOUCHED_ENV_KEYS) {
			delete process.env[key];
		}
		logMock = mock.method(console, 'log');
	});

	afterEach(() => {
		logMock.mock.restore();
		restoreEnv(envSnapshot);
	});

	describe('AK 1 — ENV-Ausgabe beim Start', () => {
		it('loggt PORT im Klartext und MISTRAL_API_KEY maskiert', () => {
			process.env.PORT = '4000';
			process.env.MISTRAL_API_KEY = 'sk-123';

			logEnvConfig();

			const output = loggedOutput(logMock);
			assert.match(output, /PORT: '4000'/, 'PORT soll mit gesetztem Wert geloggt werden');
			assert.match(
				output,
				/MISTRAL_API_KEY: '\*\*\* \(gesetzt\)'/,
				'MISTRAL_API_KEY soll als gesetzt-aber-maskiert geloggt werden',
			);
			assert.doesNotMatch(output, /sk-123/, 'Der eigentliche API-Key darf nicht im Output erscheinen');
		});
	});

	describe('AK 2 — Default-Werte sichtbar', () => {
		it('zeigt für nicht gesetzte ENV-Variablen die Defaults und (nicht gesetzt) für den Key', () => {
			// beforeEach hat bereits alle berührten Keys gelöscht → echter "nichts gesetzt"-Zustand.

			logEnvConfig();

			const output = loggedOutput(logMock);
			assert.match(output, /PORT: '3000 \(default\)'/, 'PORT-Default soll sichtbar sein');
			assert.match(
				output,
				/DATABASE_STORAGE: '\.\/database\.sqlite \(default\)'/,
				'DATABASE_STORAGE-Default soll sichtbar sein',
			);
			assert.match(output, /DB_RESET: 'false \(default\)'/, 'DB_RESET-Default soll sichtbar sein');
			assert.match(output, /DB_SEED: 'true \(default\)'/, 'DB_SEED-Default soll sichtbar sein');
			assert.match(
				output,
				/MISTRAL_MODEL: 'mistral-small-latest \(default\)'/,
				'MISTRAL_MODEL-Default soll sichtbar sein',
			);
			assert.match(
				output,
				/MISTRAL_API_KEY: '\(nicht gesetzt\)'/,
				'Ein fehlender API-Key soll als (nicht gesetzt) ausgewiesen werden',
			);
		});
	});

	describe('AK 3 — Kein Secret im Klartext', () => {
		it('maskiert den API-Key und gibt das Geheimnis nie im geloggten Objekt aus', () => {
			process.env.MISTRAL_API_KEY = 'geheim';

			logEnvConfig();

			const output = loggedOutput(logMock);
			assert.doesNotMatch(output, /geheim/, 'Das Geheimnis darf nirgendwo im Log auftauchen');
			assert.match(
				output,
				/MISTRAL_API_KEY: '\*\*\* \(gesetzt\)'/,
				'Statt des Geheimnisses soll die Maskierung erscheinen',
			);
		});
	});
});
