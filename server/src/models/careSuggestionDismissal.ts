import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Abgelehnter Fürsorge-Vorschlag (#1791): der Nutzer hat eine kuratierte Vorlage mit
 * „nicht jetzt“/„ablehnen“ verworfen — der `templateKey` (sprachunabhängiger Stammdaten-Schlüssel
 * aus `logics/careSuggestionData.ts`) bindet die Ablehnung an die Vorlage, nicht an ihren Titel.
 * Die Auswahl (`logics/careSuggestions.ts`) unterdrückt die Vorlage für `CARE_ABLEHNUNG_TAGE`
 * ab `abgelehntAm`; danach erscheint sie wieder. Pro Nutzer isoliert (`userId`), Muster
 * `pillarFeedback.ts`. Wiederholtes Ablehnen aktualisiert den bestehenden Eintrag.
 */
class CareSuggestionDismissal extends Model {
	public id!: number;
	public userId!: number;
	public templateKey!: string;
	public abgelehntAm!: Date;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

CareSuggestionDismissal.init(
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
		templateKey: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		abgelehntAm: {
			type: DataTypes.DATE,
			allowNull: false,
		},
	},
	{
		sequelize,
		modelName: 'CareSuggestionDismissal',
		tableName: 'care_suggestion_dismissals',
		timestamps: true,
	},
);

export default CareSuggestionDismissal;
