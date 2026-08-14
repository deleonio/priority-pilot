import { describe, it, before, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import { LlmConfig } from '../models/index.js';
import { loadEffectiveLlmConfig } from './llm.js';

/**
 * Rote Spec-Tests für Issue #640 — Journey 5: Die LLM-Kaskade bevorzugt eine persistierte
 * Konfiguration vor den Umgebungsvariablen; ohne DB-Werte bleibt Env der Fallback.
 * Spec: docs/spec/issue-640.md (Journey 5).
 *
 * `loadEffectiveLlmConfig` (in `./llm.js`) und das Model `LlmConfig` (in `../models/index.js`)
 * existieren noch nicht als benannte Exporte — beide Dateien existieren bereits, liefern die
 * benötigten Namen aber noch nicht. Node/ESM prüft benannte Bindungen beim Modul-Load: fehlt ein
 * Export, wirft der Import sofort einen `SyntaxError`, was den gesamten Testlauf hier rot markiert,
 * bis die Produktivseite beide Exporte bereitstellt.
 */

const ORIGINAL_ENV = { ...process.env };

before(async () => {
	await sequelize.sync({ force: true });
});

beforeEach(() => {
	process.env = { ...ORIGINAL_ENV };
});

afterEach(async () => {
	process.env = { ...ORIGINAL_ENV };
	// Tabelle nach jedem Test leeren, damit die Tests unabhängig voneinander sind.
	await LlmConfig.destroy({ where: {}, truncate: true });
});

after(async () => {
	process.env = { ...ORIGINAL_ENV };
});

describe('LLM-Kaskade: persistierte Config vor Env (#640, Journey 5)', () => {
	it('ohne persistierte Zeile: nutzt Env-Werte (Fallback, Abwärtskompatibilität)', async () => {
		process.env.MISTRAL_API_KEY = 'env-mistral-key';
		process.env.OPENROUTER_API_KEY = 'env-openrouter-key';
		process.env.OPENROUTER_MODEL = 'env/model';

		const config = await loadEffectiveLlmConfig();

		assert.equal(config.mistralApiKey, 'env-mistral-key');
		assert.equal(config.openrouterApiKey, 'env-openrouter-key');
		assert.equal(config.openrouterModel, 'env/model');
	});

	it('mit persistierter Zeile: nutzt DB-Werte, ignoriert abweichende Env-Werte', async () => {
		process.env.MISTRAL_API_KEY = 'env-mistral-key';
		process.env.OPENROUTER_API_KEY = 'env-openrouter-key';
		process.env.OPENROUTER_MODEL = 'env/model';

		await LlmConfig.create({
			mistralApiKey: 'db-mistral-key',
			openrouterApiKey: 'db-openrouter-key',
			openrouterModel: 'db/model',
		});

		const config = await loadEffectiveLlmConfig();

		assert.equal(config.mistralApiKey, 'db-mistral-key');
		assert.equal(config.openrouterApiKey, 'db-openrouter-key');
		assert.equal(config.openrouterModel, 'db/model');
	});
});
