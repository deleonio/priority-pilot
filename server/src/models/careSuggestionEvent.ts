import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

export type CareReaktion = 'angezeigt' | 'uebernommen' | 'abgelehnt';

/**
 * Anonymes Reaktions-Ereignis auf einen Fürsorge-Vorschlag (#1798): Woche (Montag, UTC), Vorlage
 * und Reaktion — bewusst ohne `userId`. `dedupKey` ist ein HMAC aus Nutzer, Vorlage und Woche
 * (`logics/careWirkung.ts`), damit eine Anzeige je Nutzer und Woche nur einmal zählt; er ist ohne
 * Server-Secret nicht umkehrbar und taucht in keiner Auswertung auf.
 */
class CareSuggestionEvent extends Model {
	public id!: number;
	public woche!: string;
	public templateKey!: string;
	public reaktion!: CareReaktion;
	public dedupKey!: string | null;
}

CareSuggestionEvent.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		woche: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		templateKey: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		reaktion: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		dedupKey: {
			type: DataTypes.STRING,
			allowNull: true,
			unique: true,
		},
	},
	{
		sequelize,
		modelName: 'CareSuggestionEvent',
		tableName: 'care_suggestion_events',
		timestamps: false,
	},
);

export default CareSuggestionEvent;
