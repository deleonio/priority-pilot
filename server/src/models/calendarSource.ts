import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Eine Kalenderquelle eines Nutzers (#2209): ICS-Adresse, die der Server nur lesend abruft.
 * **Pro Nutzer isoliert** (Muster {@link ./placeFavorite.ts}). Die Adresse ist geheim (die
 * iCal-Adresse von Google gewährt Lesezugriff ohne Anmeldung) — sie wird nie ausgegeben oder geloggt.
 */
class CalendarSource extends Model {
	public id!: number;
	public userId!: number;
	public name!: string;
	public url!: string;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

CalendarSource.init(
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
		name: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		url: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
	},
	{
		sequelize,
		modelName: 'CalendarSource',
		tableName: 'calendar_sources',
		timestamps: true,
	},
);

export default CalendarSource;
