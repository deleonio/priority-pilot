import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Series } from './index.js';
import { resetDb, closeDb } from '../test/helpers.js';

beforeEach(resetDb);
after(closeDb);

// Rote Spec-Tests für #244 (AK1) — das Serien-Template bekommt ein nullable `userId`-Feld für
// die User-Ownership. KEIN Produktivcode — die Tests werden grün, sobald `Series` das Feld hat.

describe('Series-Modell — userId (AK1 #244)', () => {
	it('Serie kann mit userId angelegt werden und trägt die userId', async () => {
		const series = await Series.create({
			title: 'Mit Owner',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: new Date('2026-01-01T00:00:00.000Z'),
			userId: 1,
		});

		assert.equal(series.userId, 1, 'die gesetzte userId liegt am Serien-Objekt an');
	});

	it('Serie ohne userId hat userId === null (nullable)', async () => {
		const series = await Series.create({
			title: 'Ohne Owner',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: new Date('2026-01-01T00:00:00.000Z'),
		});

		assert.equal(series.userId, null, 'ohne Angabe bleibt userId null (nullable)');
	});

	it('userId wird persistiert und ist via findByPk abrufbar', async () => {
		const created = await Series.create({
			title: 'Persistenz',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: new Date('2026-01-01T00:00:00.000Z'),
			userId: 42,
		});

		const reloaded = await Series.findByPk(created.id);
		assert.ok(reloaded, 'die Serie ist persistiert und abrufbar');
		assert.equal(reloaded.userId, 42, 'die userId überlebt die Persistenz');
	});
});
