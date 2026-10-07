import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Eine Kalenderquelle eines Nutzers (#2209): ICS-Adresse, die der Server nur lesend abruft.
 * **Pro Nutzer isoliert** (Muster {@link ./placeFavorite.ts}). Die Adresse ist geheim (die
 * iCal-Adresse von Google gewährt Lesezugriff ohne Anmeldung) — sie wird nie ausgegeben oder geloggt.
 * CalDAV-Quellen (#2211) tragen Benutzername und App-Passwort, Letzteres nur als Chiffrat
 * (`logics/secret-crypto.ts`); beides steht in keiner API-Antwort.
 */
class CalendarSource extends Model {
	public id!: number;
	public userId!: number;
	public name!: string;
	public url!: string;
	public type!: 'ics' | 'caldav';
	public username!: string | null;
	public passwordEncrypted!: string | null;

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
		type: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultValue: 'ics',
		},
		username: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		passwordEncrypted: {
			type: DataTypes.TEXT,
			allowNull: true,
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
