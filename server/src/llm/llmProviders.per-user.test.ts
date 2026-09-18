import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import { User } from '../models/index.js';
import { activateProvider, createProvider, loadActiveProvider } from './llmProviders.js';
import type { LlmProvider } from '../models/index.js';

/**
 * Rote Spec-Tests für #1548 (Spec docs/spec/issue-1548.md) — Provider-Auflösung pro Nutzer.
 *
 * AK3: `loadActiveProvider(userId)` liefert für einen Nutzer mit wirksamer Auswahl
 * (users.selectedLlmProviderId) genau diesen Provider statt des instanzweit aktiven;
 * ohne Auswahl (oder Auswahl eines instanzweiten Providers) bleibt es beim instanzweit
 * aktiven — unverändert zum Status quo.
 *
 * Rot, bis `loadActiveProvider` den Nutzerkontext auswertet: heute ignoriert der zusätzliche
 * Parameter und liefert immer den instanzweit aktiven Provider → Assert-Fehler.
 * KEIN Produktivcode.
 */

const ENV_KEYS = ['MISTRAL_API_KEY', 'OPENROUTER_API_KEY', 'MISTRAL_MODEL', 'OPENROUTER_MODEL'] as const;

/**
 * `loadActiveProvider` hat heute keine Parameter — der Spec-Vertrag (#1548 AK3) sieht einen
 * optionalen `userId` vor. Getarnter Aufruf, damit `tsc --noemit` (Gate) den red-Test nicht
 * schon als Typfehler ablehnt; sobald die Impl die Signatur führt, ist der Cast überflüssig.
 */
const loadActiveProviderFor = (userId?: number): Promise<LlmProvider | null> =>
	(loadActiveProvider as (userId?: number) => Promise<LlmProvider | null>)(userId);

/** Zieht die Auswahl-Spalte testseitig nach, solange das User-Modell sie noch nicht kennt (Muster `ensureDisplayNameCustomColumn`). */
const ensureSelectionColumn = async (): Promise<void> => {
	const [rows] = await sequelize.query("PRAGMA table_info('users')");
	const has = (rows as { name: string }[]).some((row) => row.name === 'selectedLlmProviderId');
	if (!has) {
		await sequelize.query('ALTER TABLE `users` ADD COLUMN `selectedLlmProviderId` INTEGER');
	}
};

const setSelection = async (userId: number, providerId: number | null): Promise<void> => {
	await ensureSelectionColumn();
	await sequelize.query('UPDATE `users` SET `selectedLlmProviderId` = ? WHERE `id` = ?', {
		replacements: [providerId, userId],
	});
};

describe('Provider-Auflösung pro Nutzer (#1548 AK3)', () => {
	const envBackup: Record<string, string | undefined> = {};
	let user: { id: number };
	let instanceProvider: { id: number };
	let ownProvider: { id: number };

	before(() => {
		for (const key of ENV_KEYS) {
			envBackup[key] = process.env[key];
		}
	});

	after(() => {
		for (const [key, value] of Object.entries(envBackup)) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	});

	beforeEach(async () => {
		for (const key of ENV_KEYS) {
			delete process.env[key];
		}
		await sequelize.sync({ force: true });

		const created = await User.create({ email: 'per-user@1548.example.com', passwordHash: 'x' });
		user = { id: created.id };
		// Instanzweit aktiver Provider (Radio-Wahl, userId = null) …
		instanceProvider = await createProvider(
			{ name: 'Instanz', endpoint: 'https://instanz.example.com/v1', apiKey: 'instanz-key', model: 'm1' },
			null,
		);
		await activateProvider(instanceProvider.id);
		// … und ein inaktiver eigener Provider des Nutzers (#1547).
		ownProvider = await createProvider(
			{ name: 'Eigener', endpoint: 'https://own.example.com/v1', apiKey: 'own-key', model: 'm2' },
			user.id,
		);
	});

	it('mit ausgewähltem eigenen Provider: Auflösung liefert ihn statt des instanzweit aktiven', async () => {
		await setSelection(user.id, ownProvider.id);

		const resolved = await loadActiveProviderFor(user.id);
		assert.equal(resolved?.id, ownProvider.id, 'gewählter eigener Provider muss gewinnen');
		assert.equal(resolved?.name, 'Eigener');
	});

	it('ohne Auswahl: instanzweit aktiver Provider — unverändert zum Status quo', async () => {
		const resolved = await loadActiveProviderFor(user.id);
		assert.equal(resolved?.id, instanceProvider.id, 'ohne Auswahl gilt der instanzweit aktive Provider');
		assert.equal((await loadActiveProvider())?.id, instanceProvider.id, 'ohne Nutzerkontext ebenfalls');
	});

	it('Auswahl eines instanzweiten Providers wirkt wie keine Auswahl (Fallback auf den aktiv gesetzten)', async () => {
		await setSelection(user.id, instanceProvider.id);

		const resolved = await loadActiveProviderFor(user.id);
		assert.equal(resolved?.id, instanceProvider.id);
	});

	it('Auswahl verweist auf einen gelöschten Provider → Fallback auf den instanzweit aktiven', async () => {
		await setSelection(user.id, ownProvider.id);
		await sequelize.query('DELETE FROM `llm_providers` WHERE `id` = ?', { replacements: [ownProvider.id] });

		const resolved = await loadActiveProviderFor(user.id);
		assert.equal(
			resolved?.id,
			instanceProvider.id,
			'verwaiste Auswahl darf nicht zu null oder falschem Provider führen',
		);
	});
});
