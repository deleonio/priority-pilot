import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Ein gespeicherter Ort eines Nutzers (Issue #1342): benannte Adresse, optional mit Koordinaten.
 *
 * **Pro Nutzer isoliert** (`userId` Pflicht, Muster {@link ./apiToken.ts}) — fremde Favoriten sind
 * über die `userId`-Bedingung der Routen schlicht unsichtbar (404 statt 403, Datenisolation #207).
 * `latitude`/`longitude` sind nullbar: ein Freitext-Favorit ohne Geocoding-Treffer hat beide `null`
 * (AK4). Gelöscht wird hart — anders als beim API-Token gibt es keinen Nachvollziehbarkeitsbedarf.
 */
class PlaceFavorite extends Model {
	public id!: number;
	// Eigentümer des Favoriten (Datenisolation #207) — Pflicht, siehe Klassenkommentar.
	public userId!: number;
	public name!: string;
	public address!: string;
	// `null`, solange der Ort nur als Freitext existiert (kein Geocoding-Treffer, AK4).
	public latitude?: number | null;
	public longitude?: number | null;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

PlaceFavorite.init(
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
		address: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		latitude: {
			type: DataTypes.FLOAT,
			allowNull: true,
		},
		longitude: {
			type: DataTypes.FLOAT,
			allowNull: true,
		},
	},
	{
		sequelize,
		modelName: 'PlaceFavorite',
		tableName: 'place_favorites',
		timestamps: true,
	},
);

export default PlaceFavorite;
