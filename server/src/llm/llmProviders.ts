import { col, fn, where } from 'sequelize';
import { LlmConfig, LlmProvider } from '../models/index.js';

/**
 * Service-Schicht des Single-Provider-Systems (#951): CRUD + Aktivierung der
 * `llm_providers`-Zeilen plus Lazy-Migration der Legacy-`llm_configs`-Keys.
 *
 * Die Serialisierung lässt `apiKey` bewusst ALWAYS weg (Write-Only, Spec
 * „Sicherheit") — weder das Feld noch der Wert dürfen je eine API-Antwort
 * erreichen.
 */

/** Provider ohne API-Key — die einzige Form, die die API je ausgibt. */
interface LlmProviderDto {
	id: number;
	name: string;
	endpoint: string;
	model: string;
	isActive: boolean;
}

interface LlmProviderCreateInput {
	name: string;
	endpoint: string;
	apiKey: string;
	model: string;
}

/** Alle Felder optional; `apiKey` nur bei nicht-leerem String gesetzt (Bearbeiten-Dialog startet leer). */
interface LlmProviderUpdateInput {
	name?: string;
	endpoint?: string;
	apiKey?: string;
	model?: string;
}

const toDto = (provider: LlmProvider): LlmProviderDto => ({
	id: provider.id,
	name: provider.name,
	endpoint: provider.endpoint,
	model: provider.model,
	isActive: provider.isActive,
});

/**
 * Migriert die Legacy-Kaskaden-Konfiguration (#640) einmalig in Provider-Einträge:
 * Ist die `llm_providers`-Tabelle leer UND steht eine `llm_configs`-Zeile mit Keys,
 * werden „Mistral“ (aktiv, wenn Mistral-Key vorhanden) und „OpenRouter“ (inaktiv)
 * angelegt. Env-Variablen migrieren bewusst NICHT — nur persistierte Bestandsdaten
 * (Spec: „Bestehende LlmConfig-Daten werden migriert“; Env bleibt Legacy-Fallback
 * der Kaskade, kein Bestand im Sinne der Migration).
 *
 * Lazy statt beim Boot: `startTestServer` bootet die App ohne Migrations-Hook —
 * die Migration hängt damit am ersten Lesezugriff und ist in jedem Prozesszustand
 * (inkl. frisch gesyncter Test-DBs) deterministisch. Fehler (Tabelle existiert
 * noch nicht, z. B. Unit-Tests ohne DB-Sync) sind No-Ops.
 */
const migrateLegacyLlmConfig = async (): Promise<void> => {
	try {
		if ((await LlmProvider.count()) > 0) {
			return;
		}
		const legacy = await LlmConfig.findOne({ order: [['id', 'ASC']] });
		if (legacy === null) {
			return;
		}
		if (legacy.mistralApiKey) {
			await LlmProvider.create({
				name: 'Mistral',
				endpoint: 'https://api.mistral.ai/v1/chat/completions',
				apiKey: legacy.mistralApiKey,
				model: 'mistral-medium-latest',
				isActive: true, // Default: Mistral ist aktiv, wenn vorhanden (Spec Migration)
			});
		}
		if (legacy.openrouterApiKey) {
			const mistralAlreadyActive = legacy.mistralApiKey !== '';
			await LlmProvider.create({
				name: 'OpenRouter',
				endpoint: 'https://openrouter.ai/api/v1/chat/completions',
				apiKey: legacy.openrouterApiKey,
				model: 'openrouter/free',
				isActive: !mistralAlreadyActive, // Ohne Mistral-Key ist OpenRouter der einzige Kandidat.
			});
		}
	} catch {
		// Tabelle(n) existieren nicht (Unit-Tests ohne DB-Sync) — Legacy-Pfad bleibt zuständig.
	}
};

/** Alle Provider (ohne API-Keys), aktiver zuerst — stabile Reihenfolge für die Radio-Group. */
export const listProviders = async (): Promise<LlmProviderDto[]> => {
	await migrateLegacyLlmConfig();
	const providers = await LlmProvider.findAll({ order: [['id', 'ASC']] });
	return providers.map(toDto);
};

/**
 * Der aktive Provider (Raw-Model inkl. `apiKey` — NUR für den LLM-Aufruf, nie
 * serialisieren). `null`, wenn keiner aktiv ist (Legacy-Kaskade übernimmt).
 */
export const loadActiveProvider = async (): Promise<LlmProvider | null> => {
	await migrateLegacyLlmConfig();
	try {
		return await LlmProvider.findOne({ where: { isActive: true }, order: [['id', 'ASC']] });
	} catch {
		return null;
	}
};

/**
 * Findet einen Provider anhand seines Namens (Case-insensitiv) — Auflösung des
 * `provider`-Query-Pinnings auf einen dynamisch konfigurierten Provider (#951).
 */
export const findProviderByName = async (name: string): Promise<LlmProvider | null> => {
	try {
		return await LlmProvider.findOne({
			where: where(fn('lower', col('name')), name.toLowerCase()),
			order: [['id', 'ASC']],
		});
	} catch {
		return null;
	}
};

/** Legt einen Provider an; der ERSTE Provider wird direkt aktiv (Spec: „Genau ein aktiver Provider“). */
export const createProvider = async (input: LlmProviderCreateInput): Promise<LlmProviderDto> => {
	const anyExisting = (await LlmProvider.count()) > 0;
	const created = await LlmProvider.create({ ...input, isActive: !anyExisting });
	return toDto(created);
};

/** Aktualisiert einen Provider; `apiKey` nur bei nicht-leerem String. Wirft bei unbekannter ID. */
export const updateProvider = async (id: number, input: LlmProviderUpdateInput): Promise<LlmProviderDto> => {
	const provider = await LlmProvider.findByPk(id);
	if (provider === null) {
		throw new Error('NOT_FOUND');
	}
	const patch: LlmProviderUpdateInput = {};
	if (input.name !== undefined) patch.name = input.name;
	if (input.endpoint !== undefined) patch.endpoint = input.endpoint;
	if (input.model !== undefined) patch.model = input.model;
	if (input.apiKey !== undefined && input.apiKey !== '') patch.apiKey = input.apiKey;
	await provider.update(patch);
	return toDto(provider);
};

/** Löscht einen Provider. Wirft bei unbekannter ID. */
export const deleteProvider = async (id: number): Promise<void> => {
	const provider = await LlmProvider.findByPk(id);
	if (provider === null) {
		throw new Error('NOT_FOUND');
	}
	await provider.destroy();
};

/**
 * Setzt genau einen Provider aktiv und deaktiviert alle anderen (Radio-Button-Logik).
 * Wirft bei unbekannter ID.
 */
export const activateProvider = async (id: number): Promise<LlmProviderDto> => {
	const provider = await LlmProvider.findByPk(id);
	if (provider === null) {
		throw new Error('NOT_FOUND');
	}
	await LlmProvider.update({ isActive: false }, { where: { isActive: true } });
	await provider.update({ isActive: true });
	return toDto(provider);
};
