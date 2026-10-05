import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Ein Journal-Eintrag eines Nutzers (#2212): Freitext, Datum (`YYYY-MM-DD`) und optional eine
 * eigene Säule. **Pro Nutzer isoliert** (Muster {@link ./placeFavorite.ts}); verschwindet die
 * Säule, setzt der Fremdschlüssel `pillarId` auf `null` (Assoziation in `models/index.ts`).
 */
class JournalEntry extends Model {
	public id!: number;
	public userId!: number;
	public text!: string;
	public date!: string;
	public pillarId!: number | null;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

JournalEntry.init(
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
		date: {
			type: DataTypes.DATEONLY,
			allowNull: false,
		},
		pillarId: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
	},
	{
		sequelize,
		modelName: 'JournalEntry',
		tableName: 'journal_entries',
		timestamps: true,
	},
);

export default JournalEntry;
