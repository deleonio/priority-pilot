import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Series } from './index.js';
import { resetDb, closeDb } from '../test/helpers.js';

// #2501: `checklist` existert am Series-Modell noch nicht (rote Spec-Tests) — Zugriff per
// Intersection + Cast, damit tsc grün bleibt, bis die Impl-Phase die Spalte anlegt
// (Muster MEMORY 2026-08-23).
type SeriesChecklistAttr = { checklist?: Array<{ id: string; title: string }> };

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

// ── #2501: JSON-Spalte `checklist` am Serien-Template (AK5-Teil: Modell-Default) ─────────────
// Rot, bis die Impl-Phase die Spalte anlegt: ohne Spalte liest Sequelize `undefined` statt `[]`.
describe('Series-Modell — checklist-Default (#2501 AK5)', () => {
	it('Serie ohne checklist liest als leere Liste (Default [])', async () => {
		const series = (await Series.create({
			title: 'Ohne Checkliste',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: new Date('2026-01-01T00:00:00.000Z'),
		})) as Series & SeriesChecklistAttr;

		assert.deepEqual(series.checklist, [], 'ohne Angabe ist die Checkliste leer');
	});

	it('gesetzte checklist-Einträge ({id, title}) werden persistiert und via findByPk gelesen', async () => {
		const checklist = [
			{ id: '11111111-1111-4111-8111-111111111111', title: 'Einräumen' },
			{ id: '22222222-2222-4222-8222-222222222222', title: 'Abwischen' },
		];
		const baseAttrs = {
			title: 'Mit Checkliste',
			rhythm: 'weekly' as const,
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: new Date('2026-01-01T00:00:00.000Z'),
		};
		const created = (await Series.create({
			...baseAttrs,
			checklist,
		} as typeof baseAttrs & SeriesChecklistAttr)) as Series & SeriesChecklistAttr;

		assert.deepEqual(created.checklist, checklist, 'die Einträge liegen unverändert an');
		const reloaded = (await Series.findByPk(created.id)) as (Series & SeriesChecklistAttr) | null;
		assert.ok(reloaded, 'die Serie ist persistiert');
		assert.deepEqual(reloaded.checklist, checklist, 'die Checkliste überlebt die Persistenz');
	});
});
