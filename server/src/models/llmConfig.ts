import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Persistierte Konfiguration der LLM-Kaskade (#640): Mistral als Primär-Provider, OpenRouter als
 * optionale Verfeinerungsstufe. Bewusst eine **Singleton-Zeile** ohne `userId` — die Konfiguration
 * gilt instanzweit (das Ticket fordert nur Auth-Schutz, keine Datenisolation zwischen Nutzern).
 * Gesetzte Werte haben Vorrang vor den gleichnamigen Umgebungsvariablen; ohne Zeile bleibt Env der
 * Fallback (siehe `loadEffectiveLlmConfig` in `../llm/llm.ts`).
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
