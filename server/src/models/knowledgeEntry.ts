import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Persönlicher Wissens-Eintrag eines Nutzers (#1936), z. B. „Ich trainiere dienstags nicht“. Passende
 * Einträge fließen in die Säulenzuordnung ein (`logics/knowledgeEntries.ts`). Pro Nutzer isoliert
 * (Muster {@link ./placeFavorite.ts}); gelöscht wird hart, auch beim Kontolöschen.
 */
class KnowledgeEntry extends Model {
	public id!: number;
	public userId!: number;
	public text!: string;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

KnowledgeEntry.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		userId: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		text: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
	},
	{
		sequelize,
		modelName: 'KnowledgeEntry',
		tableName: 'knowledge_entries',
		timestamps: true,
	},
);

export default KnowledgeEntry;
