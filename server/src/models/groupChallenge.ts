import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Zeitlich begrenzte Gruppen-Challenge (#1992). Bewusst ohne Status-Spalte: ob sie läuft, ergibt
 * sich beim Lesen aus `endsAt` — so endet sie automatisch, ohne dass ein Job laufen muss.
 */
class GroupChallenge extends Model {
	public id!: number;
	public groupId!: number;
	public startsAt!: Date;
	public endsAt!: Date;
}

GroupChallenge.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		groupId: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		startsAt: {
			type: DataTypes.DATE,
			allowNull: false,
		},
		endsAt: {
			type: DataTypes.DATE,
			allowNull: false,
		},
	},
	{
		sequelize,
		modelName: 'GroupChallenge',
		tableName: 'group_challenges',
		timestamps: false,
	},
);

export default GroupChallenge;
