import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Monatlicher KI-Verbrauch je Nutzer (Issue #1459, T4 des Gesamtkonzepts
 * `docs/gesamtkonzept-monetarisierung.md`): genau eine Zeile pro Nutzer und Kalendermonat
 * (`yearMonth` im Format `YYYY-MM`), `count` zählt die verbrauchten Punkte des `ai_assist`-
 * Kontingents. Der Unique-Index (Muster `notificationLog.ts`) macht die Zeile zum
 * Synchronisationspunkt: die Buchung ist ein einziges bedingtes `UPDATE` auf genau diese Zeile,
 * damit gleichzeitige Anfragen das Kontingent nicht überziehen.
 */
class AiUsage extends Model {
	public id!: number;
	public userId!: number;
	public yearMonth!: string;
	public count!: number;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

AiUsage.init(
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
		yearMonth: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		count: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
	},
	{
		sequelize,
		modelName: 'AiUsage',
		tableName: 'ai_usage',
		timestamps: true,
		// Je Nutzer und Monat höchstens eine Zeile — Grundlage der atomaren Buchung.
		indexes: [{ unique: true, fields: ['userId', 'yearMonth'] }],
	},
);

export default AiUsage;
