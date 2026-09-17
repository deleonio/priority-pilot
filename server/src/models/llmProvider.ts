import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Ein konfigurierter LLM-Provider des Single-Provider-Systems (#951).
 *
 * Zwei Arten von Zeilen:
 * - `kind='custom'`: beliebige Provider mit eigenem Endpoint/Key (per UI/API anlegbar,
 *   bearbeitbar, löschbar). Der Key liegt write-only in der DB.
 * - `kind='builtin'`: die zwei fest eingebauten Provider „Mistral“ und „OpenRouter“
 *   (`builtinKey` = 'mistral'|'openrouter'). Sie sind unveränderlich (kein Bearbeiten/
 *   Löschen) — Endpoint, Key und Default-Modell kommen zur Laufzeit aus den ENV-Variablen
 *   (`MISTRAL_API_KEY`, `OPENROUTER_API_KEY` u. a.), nicht aus der DB. Ist einer der beiden
 *   aktiv (explizit oder als Fallback, wenn kein Custom-Provider gewählt ist), fließen die
 *   ENV-Werte in jeden LLM-Aufruf ein.
 *
 * Genau EIN Provider ist effektiv aktiv (`isActive`) und erhält sämtliche LLM-Aufrufe
 * (Radio-Button-Auswahl, siehe `POST /llm-providers/{id}/activate`). Seit #1547 tragen
 * Custom-Provider die `userId` ihres Eigentümers; Zeilen mit `userId = null` (Built-ins,
 * historische Bestandszeilen) gelten instanzweit wie `llm_configs` (#640).
 *
 * Spalten-Semantik bei Builtins: `endpoint` und `apiKey` bleiben leer (Runtime-Auflösung über
 * ENV), `model` ist leer, solange der Nutzer kein Modell gewählt hat (dann greift der
 * ENV-/Code-Default des Providers).
 *
 * Spalten-Naming: `apiKey`→`api_key`, `isActive`→`is_active` (explizite `field`-Mappings,
 * kein globales `underscored` — die Timestamps bleiben camelCase `createdAt`/`updatedAt`,
 * wie es die Raw-SQL-Seeds der Spec-Tests erwarten).
 */
class LlmProvider extends Model {
	public id!: number;
	public name!: string;
	public endpoint!: string;
	/** Write-Only: wird nie serialisiert (kein API-Response-Feld). Bei Builtins immer leer. */
	public apiKey!: string;
	/** Gewähltes Modell; '' = noch keins gewählt (Builtins: ENV-/Code-Default greift). */
	public model!: string;
	public isActive!: boolean;
	/** 'custom' (UI-verwaltbar) oder 'builtin' (Mistral/OpenRouter, fix). */
	public kind!: 'custom' | 'builtin';
	/** Bei Builtins der feste Schlüssel ('mistral'|'openrouter'), bei Custom-Zeilen null. */
	public builtinKey!: string | null;
	/**
	 * Eigentümer der Zeile (#1547): `null` = instanzweit (Built-ins, historische Custom-Zeilen),
	 * sonst die User-ID — der Provider ist dann nur für diesen Nutzer sichtbar/verwaltbar.
	 */
	public userId!: number | null;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

LlmProvider.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		name: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		endpoint: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		apiKey: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultValue: '',
			field: 'api_key',
		},
		model: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultValue: '',
		},
		isActive: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
			field: 'is_active',
		},
		kind: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultValue: 'custom',
			validate: { isIn: [['custom', 'builtin']] },
		},
		builtinKey: {
			type: DataTypes.STRING,
			allowNull: true,
			defaultValue: null,
			field: 'builtin_key',
		},
		userId: {
			type: DataTypes.INTEGER,
			allowNull: true,
			defaultValue: null,
		},
	},
	{
		sequelize,
		modelName: 'LlmProvider',
		tableName: 'llm_providers',
		timestamps: true,
	},
);

export default LlmProvider;
