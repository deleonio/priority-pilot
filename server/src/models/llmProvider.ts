import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Ein konfigurierter LLM-Provider des Single-Provider-Systems (#951).
 *
 * Ablösung der festen Mistral→OpenRouter-Kaskade: beliebig viele Provider mit
 * eigenem Endpoint/Key/Modell, genau EINER davon ist aktiv (`isActive`) und
 * erhält sämtliche LLM-Aufrufe (Radio-Button-Auswahl, siehe `POST
 * /llm-providers/{id}/activate`). Wie `llm_configs` (#640) bewusst instanzweit
 * ohne `userId` — die Konfiguration gilt für die ganze Instanz.
 *
 * Spalten-Naming: `apiKey`→`api_key`, `isActive`→`is_active` (explizite
 * `field`-Mappings, kein globales `underscored` — die Timestamps bleiben
 * camelCase `createdAt`/`updatedAt`, wie es die Raw-SQL-Seeds der Spec-Tests
 * erwarten).
 */
class LlmProvider extends Model {
	public id!: number;
	public name!: string;
	public endpoint!: string;
	/** Write-Only: wird nie serialisiert (kein API-Response-Feld). */
	public apiKey!: string;
	public model!: string;
	public isActive!: boolean;

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
		},
		isActive: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
			field: 'is_active',
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
