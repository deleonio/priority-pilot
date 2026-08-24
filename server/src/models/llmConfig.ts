import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Persistierte Konfiguration des Legacy-LLM-Systems (#640): Mistral/OpenRouter-Keys. Seit dem
 * Single-Provider-System (#951) nur noch Migrationsquelle für `llm_providers`.
 * Bewusst eine **Singleton-Zeile** ohne `userId` — instanzweit (nur Auth-Schutz, keine
 * Nutzerisolation).
 * Die gleichnamigen Umgebungsvariablen sind mit der Kaskade entfallen (#951).
 */
class LlmConfig extends Model {
	public id!: number;
	public mistralApiKey!: string;
	public openrouterApiKey!: string;
	public openrouterModel!: string;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

LlmConfig.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		// Leerer String = „nicht gesetzt" (kein NULL), damit die API-Antwort ohne Sonderfall
		// serialisiert werden kann und der Env-Fallback rein über die Leerheit greift.
		mistralApiKey: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultValue: '',
		},
		openrouterApiKey: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultValue: '',
		},
		openrouterModel: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultValue: '',
		},
	},
	{
		sequelize,
		modelName: 'LlmConfig',
		tableName: 'llm_configs',
		timestamps: true,
	},
);

export default LlmConfig;
