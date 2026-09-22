import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Ein gespeicherter Ort eines Nutzers (Issue #1342): eine Adresse, optional mit Koordinaten.
 *
 * Seit #1595 ohne Anzeigenamen — die Adresse IST die Bezeichnung (der frühere `name` war auf 60
 * Zeichen begrenzt und ließ echte Nominatim-Adressen am Anlegen scheitern). Bestandsspalten in
 * schon bestehenden Datenbanken bleiben unberührt liegen: `sequelize.sync()` löscht keine Spalten,
 * und die Spalte wird nirgends mehr gelesen oder geschrieben.
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
		// #1595 (AK4): Die Eindeutigkeit der Adresse je Nutzer gehört in die Datenbank, nicht nur in
		// die Routenlogik — ein Read-then-Write in der Route lässt zwei gleichzeitige POSTs (Doppel-
		// klick auf den Stern) beide durchrutschen. Auf Bestands-DBs legt
		// `migratePlaceFavoriteAddressUnique` denselben Index an, nachdem sie Altbestands-Duplikate
		// zusammengeführt hat. Muster: `categories_name_user_id`.
		indexes: [{ unique: true, fields: ['userId', 'address'], name: 'place_favorites_user_id_address' }],
	},
);

export default PlaceFavorite;
