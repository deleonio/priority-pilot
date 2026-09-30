import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import { SEED_PILLARS } from '../models/pillarData.js';
import * as migrateModule from './migrate.js';
import { berechneLebensbalanceNachKadenz } from './heartBalance.js';
import type { KadenzTask } from './heartBalance.js';
import { closeDb } from '../test/helpers.js';

// Rote Spec-Tests für #1848 (docs/spec/issue-1848.md), AK3 (Migration `key`) und AK5 (Wochen-Soll über `key`).

const catalog = SEED_PILLARS as unknown as readonly { key: string; name: string }[];

// `migratePillarKey` existiert noch nicht — Zugriff über Namespace + Cast, damit tsc bis zur Impl-Phase grün bleibt.
const migratePillarKey = () =>
	(migrateModule as unknown as { migratePillarKey?: (db: typeof sequelize) => Promise<void> }).migratePillarKey!(
		sequelize,
	);

after(closeDb);

describe('#1848 AK3: migratePillarKey', () => {
	beforeEach(async () => {
		await sequelize.getQueryInterface().dropAllTables();
		// Bestands-Schema ohne `key`, mit den Standard-Säulen und einer Fremdsäule.
		await sequelize.query(
			'CREATE TABLE `pillars` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `name` VARCHAR(255) NOT NULL, ' +
				"`weight` FLOAT NOT NULL DEFAULT 20, `description` VARCHAR(255) NOT NULL DEFAULT '', `userId` INTEGER, " +
				'`createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL)',
		);
		const names = [...catalog.map((p) => p.name), 'Eigene Säule'];
		await sequelize.query(
			'INSERT INTO `pillars` (`name`, `weight`, `createdAt`, `updatedAt`) VALUES ' +
				names.map(() => '(?, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').join(', '),
			{ replacements: names },
		);
	});

	const keysByName = async (): Promise<Map<string, string | null>> => {
		const [rows] = await sequelize.query('SELECT `name`, `key` FROM `pillars`');
		return new Map((rows as { name: string; key: string | null }[]).map((r) => [r.name, r.key]));
	};

	it('setzt key je Standard-Namen, lässt Fremdnamen bei null und ist idempotent', async () => {
		await migratePillarKey();
		await assert.doesNotReject(migratePillarKey, 'zweiter Lauf bleibt stabil');

		const keys = await keysByName();
		for (const { key, name } of catalog) {
			assert.equal(keys.get(name), key, `„${name}" trägt key ${key}`);
		}
		assert.equal(keys.get('Eigene Säule'), null);
	});

	it('ist ohne pillars-Tabelle ein No-op', async () => {
		await sequelize.getQueryInterface().dropAllTables();
		await assert.doesNotReject(migratePillarKey);
	});
});

describe('#1848 AK5: Wochen-Soll über key', () => {
	it('eine umbenannte Säule mit key koerper behält 5×/Woche (nicht den 1×-Fallback)', () => {
		const jetzt = new Date('2026-09-30T12:00:00Z');
		// `key` ist erst mit der Umsetzung Teil von BalanceSaeule — als Variable (kein Excess-Property-Check).
		const saeulen = [{ id: 1, name: 'Mein Sport', key: 'koerper', weight: 100 }];
		// 4 Erledigungen im 28-Tage-Fenster: Soll 5×4=20 → Erfüllung 0,2 → Füllstand 0,2;
		// beim 1×-Fallback (Soll 4) wäre der Füllstand 1.
		const tasks: KadenzTask[] = Array.from({ length: 4 }, (_, i) => ({
			status: 'Done',
			estimatedEffort: 1,
			pillars: [{ pillarId: 1, share: 100 }],
			erledigtAm: new Date(jetzt.getTime() - (i + 1) * 24 * 60 * 60 * 1000),
		}));

		const ergebnis = berechneLebensbalanceNachKadenz(saeulen, tasks, jetzt);

		assert.ok(Math.abs(ergebnis.fill - 0.2) < 1e-9, `fill=${ergebnis.fill}, erwartet 0,2`);
	});
});
