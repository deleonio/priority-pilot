import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * „Nicht jetzt" mit Grund (#1977): jede Grundauswahl-Entscheidung an einem Fürsorge-Vorschlag
 * wird als eigener Eintrag erfasst — `grund` ist der sprachunabhängige Enum-Wert, der Bezug ist
 * genau eins von `taskId` (eigene Aufgabe) oder `templateKey` (kuratierte Vorlage); KI-Vorschläge
 * ohne stabilen Schlüssel erreichen den Endpoint nicht. Reine Historie (kein Upsert, keine
 * Auswirkung auf die Auswahl-Logik), pro Nutzer isoliert (`userId`), Muster
 * `careSuggestionDismissal.ts`.
 */
class CareSuggestionRejection extends Model {
	public id!: number;
	public userId!: number;
	public grund!: string;
	public taskId!: number | null;
	public templateKey!: string | null;
	public abgelehntAm!: Date;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

CareSuggestionRejection.init(
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
		grund: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		taskId: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		templateKey: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		abgelehntAm: {
			type: DataTypes.DATE,
			allowNull: false,
		},
	},
	{
		sequelize,
		modelName: 'CareSuggestionRejection',
		tableName: 'care_suggestion_rejections',
		timestamps: true,
	},
);

export default CareSuggestionRejection;
