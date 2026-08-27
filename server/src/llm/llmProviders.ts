import { col, fn, where } from 'sequelize';
import { LlmProvider } from '../models/index.js';

/**
 * Service-Schicht des Provider-Systems: CRUD + Aktivierung der `llm_providers`-Zeilen,
 * dazu die zwei fest eingebauten Provider „Mistral“ und „OpenRouter“.
 *
 * Built-ins sind normale Zeilen (`kind='builtin'`) — so funktionieren Radio-Auswahl und
 * Modell-Persistenz über die bestehende Tabelle. Ihre Verbindungswerte (Endpoint, Key,
 * Default-Modell) stehen bewusst NICHT in der DB, sondern werden zur Laufzeit aus den
 * ENV-Variablen aufgelöst: `endpoint`/`apiKey` bleiben leer, `model` ist leer, solange der
 * Nutzer kein Modell gewählt hat.
 *
 * Fallback: Ist kein Custom-Provider aktiv (nie gewählt oder aktiver gelöscht), übernimmt
 * automatisch einer der Built-ins — Mistral, wenn `MISTRAL_API_KEY` gesetzt ist, sonst
 * OpenRouter. Ohne jeden ENV-Key ist kein Provider aktiv (LLM-Endpunkte antworten 503).
 *
 * Die Serialisierung lässt `apiKey` bewusst ALWAYS weg (Write-Only) — weder das Feld noch
 * der Wert dürfen je eine API-Antwort erreichen.
 */

/** Provider ohne API-Key — die einzige Form, die die API je ausgibt. */
interface LlmProviderDto {
	id: number;
	name: string;
	endpoint: string;
	model: string;
	isActive: boolean;
	/** 'custom' = frei verwaltbar, 'builtin' = fix (Mistral/OpenRouter, Key aus ENV). */
	kind: 'custom' | 'builtin';
	/** Ob ein Key vorhanden ist (Built-in: ENV gesetzt; Custom: DB-Key gesetzt). */
	hasApiKey: boolean;
}

interface LlmProviderCreateInput {
	name: string;
	endpoint: string;
	apiKey: string;
	/** Pflicht beim Anlegen: `/models` ist nicht bei jedem Anbieter abrufbar. */
	model: string;
}
/** Alle Felder optional; `apiKey` nur bei nicht-leerem String gesetzt (Bearbeiten-Dialog startet leer). */
interface LlmProviderUpdateInput {
	name?: string;
	endpoint?: string;
	apiKey?: string;
	model?: string;
}

/** Definition eines fest eingebauten Providers — alle Werte stammen aus ENV/Code, nie aus der DB. */
interface BuiltinDefinition {
	key: 'mistral' | 'openrouter';
	name: string;
	/** ENV-Variable mit dem API-Key. */
	envKey: string;
	/** ENV-Variable mit der Basis-URL (optional). */
	envUrl: string;
	/** Code-Default der Basis-URL (OpenAI-kompatibel, ohne `/chat/completions`). */
	defaultUrl: string;
	/** ENV-Variable mit dem Default-Modell (optional). */
	envModel: string;
	/** Code-Default des Modells, wenn weder DB-Wahl noch ENV vorliegen. */
	defaultModel: string;
	/**
	 * Eingebauter Katalog, wenn der Live-Abruf der Modellliste scheitert. Bewusst NUR für
	 * Mistral befüllt: Dessen `GET /models` verlangt einen Key mit aktivem Abo (z. B. HTTP 402
	 * nach Ablauf des Free-Tiers) — ohne Katalog bliebe die Modellwahl leer. Die Einträge sind
	 * stabile `-latest`-Aliasse, die Mistral per Design auf die aktuelle Version zeigen lässt,
	 * veralten also nicht (anders als rotierende `:free`-Modelle, deshalb bewusst kein Katalog
	 * für OpenRouter — dessen Liste ist zudem öffentlich abrufbar).
	 */
	fallbackModels: readonly { id: string; name: string }[];
}

/** Die zwei fixen Provider — Reihenfolge = Fallback-Priorität (Mistral vor OpenRouter). */
const BUILTIN_DEFINITIONS: readonly BuiltinDefinition[] = [
	{
		key: 'mistral',
		name: 'Mistral',
		envKey: 'MISTRAL_API_KEY',
		envUrl: 'MISTRAL_API_URL',
		defaultUrl: 'https://api.mistral.ai/v1',
		envModel: 'MISTRAL_MODEL',
		defaultModel: 'mistral-small-latest',
		fallbackModels: [
			{ id: 'mistral-large-latest', name: 'Mistral Large' },
			{ id: 'mistral-medium-latest', name: 'Mistral Medium' },
			{ id: 'mistral-small-latest', name: 'Mistral Small' },
			{ id: 'magistral-medium-latest', name: 'Magistral Medium' },
			{ id: 'magistral-small-latest', name: 'Magistral Small' },
			{ id: 'ministral-8b-latest', name: 'Ministral 8B' },
			{ id: 'open-mistral-nemo', name: 'Open Mistral Nemo' },
		],
	},
	{
		key: 'openrouter',
		name: 'OpenRouter',
		envKey: 'OPENROUTER_API_KEY',
		envUrl: 'OPENROUTER_API_URL',
		defaultUrl: 'https://openrouter.ai/api/v1',
		envModel: 'OPENROUTER_MODEL',
		defaultModel: 'openrouter/free',
		fallbackModels: [],
	},
] as const;

/** Liefert die Definition eines Built-ins — wirft bei unbekanntem Schlüssel (DB-Korruption). */
const builtinDefinition = (key: string | null): BuiltinDefinition => {
	const definition = BUILTIN_DEFINITIONS.find((entry) => entry.key === key);
	if (definition === undefined) {
		throw new Error(`Unbekannter builtin-Provider-Schlüssel: ${String(key)}`);
	}
	return definition;
};

/**
 * Eingebauter Fallback-Katalog eines Built-ins für die Modellliste — `null`, wenn es keinen
 * gibt (Custom-Provider, OpenRouter). Der Aufrufer nutzt ihn, wenn der Live-Abruf scheitert.
 */
export const builtinModelFallback = (provider: LlmProvider): { id: string; name: string }[] | null => {
	if (provider.kind !== 'builtin') {
		return null;
	}
	const { fallbackModels } = builtinDefinition(provider.builtinKey);
	return fallbackModels.length > 0 ? [...fallbackModels] : null;
};

/**
 * Der Fallback-Built-in: Mistral, wenn dessen ENV-Key gesetzt ist, sonst OpenRouter —
 * `null`, wenn kein Built-in konfiguriert ist (dann ist ohne aktiven Custom-Provider
 * gar kein Provider aktiv und LLM-Aufrufe antworten 503).
 */
const builtinFallbackKey = (): 'mistral' | 'openrouter' | null => {
	if (process.env.MISTRAL_API_KEY !== undefined && process.env.MISTRAL_API_KEY !== '') return 'mistral';
	if (process.env.OPENROUTER_API_KEY !== undefined && process.env.OPENROUTER_API_KEY !== '') return 'openrouter';
	return null;
};

/** Entfernt einen `/chat/completions`-Suffix und abschließende Slashes → OpenAI-kompatible Basis-URL. */
const toBaseUrl = (endpoint: string): string => endpoint.replace(/\/chat\/completions\/?$/, '').replace(/\/+$/, '');

/**
 * Laufzeit-Konfiguration eines Providers für LLM- und Modelllisten-Aufrufe.
 * Built-ins lösen Endpoint/Key/Modell aus den ENV-Variablen auf; bei Custom-Providern
 * wird eine evtl. gespeicherte vollständige Chat-Completions-URL (Legacy-Bestand aus #951)
 * für den Chat-Call unverändert verwendet und nur für die Modellliste auf die Basis-URL
 * gekürzt.
 */
export interface ProviderRuntime {
	/** Basis-URL (OpenAI-kompatibel) — Modellliste: `{baseUrl}/models`. */
	baseUrl: string;
	/** Chat-Completions-Endpoint für LLM-Aufrufe. */
	chatEndpoint: string;
	/** API-Key ('' = nicht gesetzt). */
	apiKey: string;
	/** Modell ('' = keins gewählt — nur bei Custom-Providern möglich). */
	model: string;
	/** Anzeigename für Fehlermeldungen. */
	label: string;
	/** Kennung der Key-Quelle für 503-Meldungen (ENV-Name oder „API-Key von X"). */
	keySource: string;
}

/** Löst die effektive Laufzeit-Konfiguration einer Provider-Zeile auf (ENV für Built-ins). */
export const toRuntimeConfig = (provider: LlmProvider): ProviderRuntime => {
	if (provider.kind === 'builtin') {
		const definition = builtinDefinition(provider.builtinKey);
		const baseUrl = (process.env[definition.envUrl] || definition.defaultUrl).replace(/\/+$/, '');
		return {
			baseUrl,
			chatEndpoint: `${baseUrl}/chat/completions`,
			apiKey: process.env[definition.envKey] ?? '',
			model: provider.model || process.env[definition.envModel] || definition.defaultModel,
			label: provider.name,
			keySource: definition.envKey,
		};
	}
	const baseUrl = toBaseUrl(provider.endpoint);
	return {
		baseUrl,
		chatEndpoint: provider.endpoint.endsWith('/chat/completions') ? provider.endpoint : `${baseUrl}/chat/completions`,
		apiKey: provider.apiKey,
		model: provider.model,
		label: provider.name,
		keySource: `API-Key von ${provider.name}`,
	};
};

/**
 * Legt die zwei Built-in-Zeilen lazy an, falls sie fehlen (frische DB, später dazugekommene
 * Spalten o. Ä.). Fehler (Tabelle existiert noch nicht, z. B. Unit-Tests ohne DB-Sync) sind
 * No-Ops — dann bleibt der Aufrufer bei „kein Provider“.
 */
const ensureBuiltins = async (): Promise<void> => {
	try {
		for (const definition of BUILTIN_DEFINITIONS) {
			const existing = await LlmProvider.findOne({ where: { kind: 'builtin', builtinKey: definition.key } });
			if (existing === null) {
				await LlmProvider.create({
					name: definition.name,
					endpoint: '',
					apiKey: '',
					model: '',
					isActive: false,
					kind: 'builtin',
					builtinKey: definition.key,
				});
			}
		}
	} catch {
		// Tabelle existiert nicht (Unit-Tests ohne DB-Sync) — Aufrufer behandelt „kein Provider“.
	}
};

/** Effektive Serialisierung einer Zeile: Built-ins lösen Endpoint/Modell/Key-Präsenz aus ENV auf. */
const toDto = (provider: LlmProvider, isActive: boolean): LlmProviderDto => {
	if (provider.kind === 'builtin') {
		const runtime = toRuntimeConfig(provider);
		return {
			id: provider.id,
			name: provider.name,
			endpoint: runtime.baseUrl,
			model: runtime.model,
			isActive,
			kind: 'builtin',
			hasApiKey: runtime.apiKey !== '',
		};
	}
	return {
		id: provider.id,
		name: provider.name,
		endpoint: provider.endpoint,
		model: provider.model,
		isActive,
		kind: 'custom',
		hasApiKey: provider.apiKey !== '',
	};
};

/**
 * Bestimmt die effektive Aktiv-Markierung: die explizit aktive Zeile, sonst der
 * Fallback-Built-in (nach ENV-Key-Präsenz). `null` = kein Provider aktiv.
 */
const effectiveActive = (providers: LlmProvider[]): LlmProvider | null => {
	const explicit = providers.find((provider) => provider.isActive);
	if (explicit !== undefined) return explicit;
	const fallbackKey = builtinFallbackKey();
	if (fallbackKey === null) return null;
	return providers.find((provider) => provider.kind === 'builtin' && provider.builtinKey === fallbackKey) ?? null;
};

/** Alle Provider (ohne API-Keys) — Built-ins zuerst (feste Reihenfolge für die Radio-Group). */
export const listProviders = async (): Promise<LlmProviderDto[]> => {
	await ensureBuiltins();
	const providers = await LlmProvider.findAll({ order: [['id', 'ASC']] });
	const active = effectiveActive(providers);
	const builtins = BUILTIN_DEFINITIONS.map(
		(definition) =>
			providers.find((provider) => provider.kind === 'builtin' && provider.builtinKey === definition.key) ?? null,
	);
	const customs = providers.filter((provider) => provider.kind === 'custom');
	return [...builtins, ...customs]
		.filter((provider): provider is LlmProvider => provider !== null)
		.map((provider) => toDto(provider, provider.id === active?.id));
};

/**
 * Der effektiv aktive Provider als DB-Zeile (Raw-Model inkl. `apiKey` — NUR für den
 * LLM-Aufruf via {@link toRuntimeConfig}, nie serialisieren). Explizit aktive Zeile,
 * sonst Fallback-Built-in; `null`, wenn gar kein Provider verfügbar ist.
 */
export const loadActiveProvider = async (): Promise<LlmProvider | null> => {
	await ensureBuiltins();
	try {
		const providers = await LlmProvider.findAll({ order: [['id', 'ASC']] });
		return effectiveActive(providers);
	} catch {
		return null;
	}
};

/**
 * Findet einen Provider anhand seines Namens (Case-insensitiv) — Auflösung des
 * `provider`-Query-Pinnings; findet seit den Built-ins auch „mistral“/„openrouter“.
 */
export const findProviderByName = async (name: string): Promise<LlmProvider | null> => {
	await ensureBuiltins();
	try {
		return await LlmProvider.findOne({
			where: where(fn('lower', col('name')), name.toLowerCase()),
			order: [['id', 'ASC']],
		});
	} catch {
		return null;
	}
};

/**
 * Legt einen Custom-Provider an — inaktiv; die Aktivierung erfolgt bewusst über die
 * Radio-Auswahl (`activateProvider`), nicht automatisch.
 */
export const createProvider = async (input: LlmProviderCreateInput): Promise<LlmProviderDto> => {
	const created = await LlmProvider.create({ ...input, isActive: false, kind: 'custom', builtinKey: null });
	return toDto(created, false);
};

/**
 * Aktualisiert einen Provider. Built-ins sind bis auf die Modell-Wahl unveränderlich
 * (`BUILTIN_IMMUTABLE`); bei Custom-Providern wird `apiKey` nur bei nicht-leerem String
 * gesetzt. Wirft bei unbekannter ID (`NOT_FOUND`).
 */
export const updateProvider = async (id: number, input: LlmProviderUpdateInput): Promise<LlmProviderDto> => {
	const provider = await LlmProvider.findByPk(id);
	if (provider === null) {
		throw new Error('NOT_FOUND');
	}
	const patch: LlmProviderUpdateInput = {};
	if (input.model !== undefined) patch.model = input.model;
	if (provider.kind === 'builtin') {
		if (input.name !== undefined || input.endpoint !== undefined || input.apiKey !== undefined) {
			throw new Error('BUILTIN_IMMUTABLE');
		}
	} else {
		if (input.name !== undefined) patch.name = input.name;
		if (input.endpoint !== undefined) patch.endpoint = input.endpoint;
		if (input.apiKey !== undefined && input.apiKey !== '') patch.apiKey = input.apiKey;
	}
	await provider.update(patch);
	const active = await loadActiveProvider();
	return toDto(provider, provider.id === active?.id);
};

/**
 * Löscht einen Custom-Provider (Built-ins: `BUILTIN_IMMUTABLE`). War er aktiv, übernimmt
 * automatisch der Built-in-Fallback. Wirft bei unbekannter ID.
 */
export const deleteProvider = async (id: number): Promise<void> => {
	const provider = await LlmProvider.findByPk(id);
	if (provider === null) {
		throw new Error('NOT_FOUND');
	}
	if (provider.kind === 'builtin') {
		throw new Error('BUILTIN_IMMUTABLE');
	}
	await provider.destroy();
};

/**
 * Setzt genau einen Provider aktiv und deaktiviert alle anderen (Radio-Button-Logik) —
 * für Custom- UND Built-in-Provider. Wirft bei unbekannter ID.
 */
export const activateProvider = async (id: number): Promise<LlmProviderDto> => {
	const provider = await LlmProvider.findByPk(id);
	if (provider === null) {
		throw new Error('NOT_FOUND');
	}
	await LlmProvider.update({ isActive: false }, { where: { isActive: true } });
	await provider.update({ isActive: true });
	return toDto(provider, true);
};
