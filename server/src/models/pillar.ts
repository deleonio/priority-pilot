import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Eine der fünf festen Lebensbalance-Säulen. **Nutzer-eigene Stammdaten** (#421, Epic #420, Teil 1):
 * jeder Nutzer besitzt seine eigene Kopie der Standard-Säulen, gebunden über die nullbare `userId`.
 * `weight` ist der prozentuale Anteil der Säule (Default 20 ⇒ fünf Säulen summieren sich auf 100 %).
 * `description` ist die kanonische Kurzbeschreibung (Einstellungs-Menü); Quelle der Werte ist
 * {@link ../models/pillarData.ts SEED_PILLARS}. Säulennamen sind **pro Nutzer eindeutig**
 * (Unique-Index auf `name`, `userId`) — derselbe Name ist für verschiedene Nutzer erlaubt.
 * NULL-owned Zeilen (`userId IS NULL`) sind historische globale Stammdaten, die die Migration
 * unangetastet lässt.
 */
class Pillar extends Model {
	public id!: number;
	public name!: string;
	public weight!: number;
	public description!: string;
	public userId!: number | null;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

Pillar.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		name: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		weight: {
			type: DataTypes.FLOAT,
			allowNull: false,
			defaultValue: 20,
			validate: {
				min: 0,
			},
		},
		// Kurzbeschreibung der Säule (globale Stammdaten, nicht nutzereditierbar). NOT NULL mit
		// Default '' damit bestehende Zeilen beim Nachziehen der Spalte nicht verletzt werden; der
		// Seed bzw. die Migration füllen die echten Werte (siehe SEED_PILLARS).
		description: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultValue: '',
		},
		// Eigentümer-Bindung (#421): nullbar für Abwärtskompatibilität mit den historischen globalen
		// (NULL-owned) Stammdaten. Neue Säulen werden pro Nutzer mit gesetzter userId angelegt.
		userId: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
	},
	{
		sequelize,
		modelName: 'Pillar',
		tableName: 'pillars',
		timestamps: true,
		// Säulennamen sind pro Nutzer eindeutig (#421): derselbe Name für verschiedene Nutzer ist
		// erlaubt, Duplikate beim selben Nutzer werden abgewiesen.
		indexes: [{ unique: true, fields: ['name', 'userId'], name: 'pillars_name_user_id' }],
	},
);

export default Pillar;
