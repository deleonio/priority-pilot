import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SequelizeOptions } from 'sequelize';
import * as databaseModule from './database.js';

// Rote Spec-Tests für #2825 — Dialektwahl in database.ts (docs/spec/issue-2825.md).
//
// Vertrag: database.ts exportiert die reine Funktion buildDatabaseOptions(env) → SequelizeOptions;
// der Default-Export (Sequelize-Instanz) nutzt sie. Der Export existiert noch nicht — die
// Existenz-Assertion ist die legitime Rotfärbung für neue Funktionalität. Namespace-Import + Cast
// halten tsc grün bis dahin (Muster migrate.test.ts, #1225).

type BuildDatabaseOptions = (env: NodeJS.ProcessEnv) => SequelizeOptions;

const buildDatabaseOptions = (): BuildDatabaseOptions => {
	const fn = (databaseModule as { buildDatabaseOptions?: BuildDatabaseOptions }).buildDatabaseOptions;
	assert.ok(typeof fn === 'function', 'Export buildDatabaseOptions fehlt in database.ts (rote Spec-Tests für #2825)');
	return fn;
};

const mariadbEnv = (dialect: string | undefined): NodeJS.ProcessEnv => ({
	DB_DIALECT: dialect,
	MARIADB_HOST: 'db.example.de',
	MARIADB_PORT: '3307',
	MARIADB_USER: 'bala',
	MARIADB_PASSWORD: 'geheim',
	MARIADB_DATABASE: 'balamentum',
});

describe('buildDatabaseOptions (#2825)', () => {
	it('baut bei DB_DIALECT=mysql die MariaDB-Optionen aus der Env: Dialekt, Zugangsdaten, UTC-Zeitzone, Pool (AK1)', () => {
		const options = buildDatabaseOptions()(mariadbEnv('mysql'));
		assert.equal(options.dialect, 'mysql');
		assert.equal(options.host, 'db.example.de');
		assert.equal(String(options.port), '3307');
		assert.equal(options.username, 'bala');
		assert.equal(options.password, 'geheim');
		assert.equal(options.database, 'balamentum');
		assert.equal(options.timezone, '+00:00');
		assert.ok(options.pool && Object.keys(options.pool).length > 0, 'Pool-Konfiguration im mysql-Zweig erwartet');
	});

	it('behandelt DB_DIALECT=sqlite explizit wie den Default und ignoriert vorhandene MARIADB-Werte (AK1/AK2)', () => {
		assert.equal(buildDatabaseOptions()(mariadbEnv('sqlite')).dialect, 'sqlite');
	});

	it('bleibt ohne Env unverändert: sqlite, Default-Storage, keine MariaDB-Optionen (AK2)', () => {
		const options = buildDatabaseOptions()({});
		assert.equal(options.dialect, 'sqlite');
		assert.equal(options.storage, './database.sqlite');
		assert.equal(options.logging, false);
		assert.equal(options.host, undefined);
		assert.equal(options.timezone, undefined);
		assert.equal(options.pool, undefined);
	});

	it('bildet DATABASE_STORAGE unverändert ab und hält den :memory:-Ein-Pool fest (AK2)', () => {
		const memory = buildDatabaseOptions()({ DATABASE_STORAGE: ':memory:' });
		assert.equal(memory.storage, ':memory:');
		assert.equal(memory.pool?.max, 1);

		const file = buildDatabaseOptions()({ DATABASE_STORAGE: './data/bala.sqlite' });
		assert.equal(file.storage, './data/bala.sqlite');
		assert.equal(file.pool, undefined);
	});

	it('scheitert bei ungültigem DB_DIALECT früh mit einer Meldung, die die Variable nennt (AK1)', () => {
		assert.throws(() => buildDatabaseOptions()(mariadbEnv('postgres')), /DB_DIALECT/);
	});
});
