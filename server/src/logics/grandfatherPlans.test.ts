import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sequelize from '../database.js';
import { User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
// `grandfatherPlans`/`planDistribution` existieren noch nicht — der Import macht diese Spec-Datei
// bewusst ROT, bis `server/src/logics/grandfatherPlans.ts` sie exportiert (#1463, T8).
import { grandfatherPlans, planDistribution } from './grandfatherPlans.js';

/**
 * Rote Spec-Tests für #1463 (Spec `docs/spec/issue-1463.md`, T8 „Launch") — Übergangs-Setzung der
 * Bestandskonten vor dem Scharfschalten von `MONETIZATION_ENFORCED`.
 *
 * AK1: `grandfatherPlans(seq, cutoff)` hebt Alt-Free-Konten (createdAt < cutoff) auf `ultimate`.
 * AK2: Zweitlauf = No-op; `migrate.ts`/Serverstart ruft die Setzung NICHT auf.
 * AK3: `planDistribution(seq)` zählt Konten je Paket.
 * AK4: CLI-Skript validiert den Stichtag und bricht ohne Schreibzugriff ab, wenn er fehlt/ungültig ist.
 */

const testDir = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(testDir, '../..');

const createUser = (overrides: {
	id: number;
	email: string;
	plan: 'free' | 'pro' | 'max' | 'ultimate';
	createdAt: Date;
}) =>
	User.create({
		id: overrides.id,
		email: overrides.email,
		passwordHash: '__test__',
		displayName: overrides.email,
		plan: overrides.plan,
		createdAt: overrides.createdAt,
	});

beforeEach(resetDb);
after(closeDb);

describe('grandfatherPlans — AK1: setzt nur Alt-Free-Konten vor dem Stichtag auf ultimate', () => {
	it('Konto vor dem Stichtag mit plan=free wird auf ultimate gesetzt, Konto danach bleibt free', async () => {
		const cutoff = new Date('2026-09-01T00:00:00Z');
		await createUser({ id: 1, email: 'alt@example.com', plan: 'free', createdAt: new Date('2026-08-01T00:00:00Z') });
		await createUser({ id: 2, email: 'neu@example.com', plan: 'free', createdAt: new Date('2026-09-15T00:00:00Z') });

		const changed = await grandfatherPlans(sequelize, cutoff);

		assert.equal(changed, 1, 'genau ein Konto (vor dem Stichtag) wurde geändert');
		const alt = await User.findByPk(1);
		const neu = await User.findByPk(2);
		assert.equal(alt?.get('plan'), 'ultimate', 'Alt-Konto vor dem Stichtag steht auf ultimate');
		assert.equal(neu?.get('plan'), 'free', 'Konto nach dem Stichtag bleibt free');
	});

	it('Konto vor dem Stichtag mit bereits gebuchtem Paket bleibt unverändert', async () => {
		const cutoff = new Date('2026-09-01T00:00:00Z');
		await createUser({ id: 1, email: 'pro@example.com', plan: 'pro', createdAt: new Date('2026-01-01T00:00:00Z') });
		await createUser({ id: 2, email: 'max@example.com', plan: 'max', createdAt: new Date('2026-01-01T00:00:00Z') });

		const changed = await grandfatherPlans(sequelize, cutoff);

		assert.equal(changed, 0, 'kein Konto mit bereits gebuchtem Paket wird geändert');
		assert.equal((await User.findByPk(1))?.get('plan'), 'pro');
		assert.equal((await User.findByPk(2))?.get('plan'), 'max');
	});
});

describe('grandfatherPlans — AK2: Idempotenz, keine Kopplung an migrate.ts/Serverstart', () => {
	it('zweiter Lauf mit gleichem Stichtag ändert 0 Konten', async () => {
		const cutoff = new Date('2026-09-01T00:00:00Z');
		await createUser({ id: 1, email: 'alt@example.com', plan: 'free', createdAt: new Date('2026-08-01T00:00:00Z') });

		const firstRun = await grandfatherPlans(sequelize, cutoff);
		const secondRun = await grandfatherPlans(sequelize, cutoff);

		assert.equal(firstRun, 1, 'erster Lauf ändert das eine Alt-Free-Konto');
		assert.equal(secondRun, 0, 'zweiter Lauf mit gleichem Stichtag ändert nichts mehr');
	});

	it('server/src/logics/migrate.ts ruft grandfatherPlans nicht auf — kein Auto-Lauf beim Serverstart', () => {
		const migrateSource = readFileSync(resolve(testDir, 'migrate.ts'), 'utf-8');
		assert.doesNotMatch(
			migrateSource,
			/grandfatherPlans/,
			'migrate.ts darf grandfatherPlans weder importieren noch aufrufen (Setzung bleibt manueller CLI-Lauf)',
		);

		const indexSource = readFileSync(resolve(serverRoot, 'src/index.ts'), 'utf-8');
		assert.doesNotMatch(
			indexSource,
			/grandfatherPlans/,
			'server/src/index.ts (Serverstart) darf grandfatherPlans nicht referenzieren',
		);
	});
});

describe('planDistribution — AK3: Anzahl Konten je Paket', () => {
	it('zählt Konten je Paket, 0 für Pakete ohne Konten', async () => {
		await createUser({ id: 1, email: 'a@example.com', plan: 'free', createdAt: new Date() });
		await createUser({ id: 2, email: 'b@example.com', plan: 'free', createdAt: new Date() });
		await createUser({ id: 3, email: 'c@example.com', plan: 'ultimate', createdAt: new Date() });

		const distribution = await planDistribution(sequelize);

		assert.deepEqual(distribution, { free: 2, pro: 0, max: 0, ultimate: 1 });
	});

	it('liefert alle vier Pakete mit 0 bei leerer users-Tabelle', async () => {
		const distribution = await planDistribution(sequelize);

		assert.deepEqual(distribution, { free: 0, pro: 0, max: 0, ultimate: 0 });
	});
});

describe('CLI-Skript — AK4: Stichtag-Validierung', () => {
	const runCli = (env: Record<string, string | undefined>) =>
		spawnSync('node', ['--import', 'tsx', 'src/cli/grandfatherPlans.ts'], {
			cwd: serverRoot,
			env: { ...process.env, DATABASE_STORAGE: ':memory:', NODE_ENV: 'test', ...env },
			encoding: 'utf-8',
		});

	it('bricht ohne Stichtag-Env-Variable mit Exit-Code != 0 ab', () => {
		const result = runCli({ GRANDFATHER_CUTOFF: undefined });
		assert.notEqual(result.status, 0, 'fehlender Stichtag muss zu Exit-Code != 0 führen');
	});

	it('bricht bei ungültigem ISO-Datum mit Exit-Code != 0 ab', () => {
		const result = runCli({ GRANDFATHER_CUTOFF: 'kein-datum' });
		assert.notEqual(result.status, 0, 'ungültiger Stichtag muss zu Exit-Code != 0 führen');
	});

	it('gültiger Stichtag: Exit-Code 0, Ausgabe enthält Anzahl geänderter Konten und Paketverteilung', () => {
		const result = runCli({ GRANDFATHER_CUTOFF: '2026-09-01T00:00:00Z' });
		assert.equal(result.status, 0, `Exit-Code sollte 0 sein, stderr: ${result.stderr}`);
		assert.match(result.stdout, /free/i, 'Ausgabe enthält die Paketverteilung (mind. "free")');
	});
});
