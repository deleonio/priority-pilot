import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Category } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { validateCategoryId, isCategoryExistent, remapCategoryForRecipient } from './categoryOwnership.js';

/**
 * Tests für die Kategorie-Eigentümerprüfung (#1471/F-6): `logics/categoryOwnership.ts` entscheidet,
 * ob ein Task oder eine Serie auf eine Kategorie zeigen darf. Ein Loch hier lässt Datensätze auf
 * fremde Stammdaten verweisen (Kontogrenze), und die Übergabe an ein Gruppenmitglied (#1252 AK6)
 * hängt daran, welche Kategorie der Empfänger bekommt — beides fällt im laufenden Betrieb nicht auf.
 *
 * DB-Teil gegen die In-Memory-SQLite wie in den Nachbarn (`pillarContributions.test.ts`).
 */

describe('validateCategoryId — strukturelle Prüfung des Feldwerts', () => {
	it('null bedeutet „keine Kategorie" und ist gültig', () => {
		assert.deepEqual(validateCategoryId(null), { ok: true, categoryId: null });
	});

	it('positive Ganzzahl ist gültig und wird durchgereicht', () => {
		assert.deepEqual(validateCategoryId(1), { ok: true, categoryId: 1 });
		assert.deepEqual(validateCategoryId(42), { ok: true, categoryId: 42 });
	});

	it('0 und negative Werte sind ungültig', () => {
		assert.deepEqual(validateCategoryId(0), { ok: false });
		assert.deepEqual(validateCategoryId(-1), { ok: false });
	});

	it('Kommazahlen sind ungültig', () => {
		assert.deepEqual(validateCategoryId(1.5), { ok: false });
	});

	it('numerische Strings werden nicht stillschweigend konvertiert', () => {
		assert.deepEqual(validateCategoryId('3'), { ok: false });
	});

	it('undefined ist hier ungültig — „Feld nicht gesetzt" behandelt der Aufrufer', () => {
		assert.deepEqual(validateCategoryId(undefined), { ok: false });
	});
});

describe('isCategoryExistent — Kontobindung der Kategorie', () => {
	beforeEach(resetDb);
	after(closeDb);

	it('null als categoryId ist trivial erfüllt (keine Zuordnung)', async () => {
		assert.equal(await isCategoryExistent(null, 1), true);
	});

	it('eigene Kategorie → true', async () => {
		const own = await Category.create({ name: 'Haushalt', userId: 7 });
		assert.equal(await isCategoryExistent(own.id, 7), true);
	});

	it('fremde Kategorie → false (Kontogrenze)', async () => {
		const foreign = await Category.create({ name: 'Haushalt', userId: 8 });
		assert.equal(await isCategoryExistent(foreign.id, 7), false);
	});

	it('nicht existierende Kategorie → false', async () => {
		assert.equal(await isCategoryExistent(999, 7), false);
	});

	it('userId null matcht nur Kategorien ohne Eigentümer (Dev-Pass-Through)', async () => {
		const ownerless = await Category.create({ name: 'Ohne Konto', userId: null });
		const owned = await Category.create({ name: 'Mit Konto', userId: 7 });
		assert.equal(await isCategoryExistent(ownerless.id, null), true);
		assert.equal(await isCategoryExistent(owned.id, null), false);
	});
});

describe('remapCategoryForRecipient — Übergabe an ein Gruppenmitglied (#1252 AK6)', () => {
	beforeEach(resetDb);
	after(closeDb);

	it('gleichnamige Kategorie des Empfängers → deren Id', async () => {
		const source = await Category.create({ name: 'Haushalt', userId: 7 });
		const target = await Category.create({ name: 'Haushalt', userId: 8 });
		assert.equal(await remapCategoryForRecipient(source.id, 8), target.id);
	});

	it('Empfänger hat keine gleichnamige Kategorie → null statt Verweis auf fremde Stammdaten', async () => {
		const source = await Category.create({ name: 'Haushalt', userId: 7 });
		await Category.create({ name: 'Arbeit', userId: 8 });
		assert.equal(await remapCategoryForRecipient(source.id, 8), null);
	});

	it('Quell-Kategorie existiert nicht → null', async () => {
		assert.equal(await remapCategoryForRecipient(999, 8), null);
	});
});
