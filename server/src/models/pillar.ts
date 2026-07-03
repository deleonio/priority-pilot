import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Eine der fünf festen Lebensbalance-Säulen. **Globale Stammdaten** — für alle Nutzer identisch,
 * nicht pro Nutzer isoliert (die Säulen-Auswahl im API ist daher unscoped). `weight` ist der
 * prozentuale Anteil der Säule (Default 20 ⇒ fünf Säulen summieren sich auf 100 %). `description`
 * ist die kanonische Kurzbeschreibung (Einstellungs-Menü); Quelle der Werte ist
 * {@link ../models/pillarData.ts SEED_PILLARS}. Säulennamen sind **global eindeutig** (Unique-Index
 * auf `name`) — die fünf Stammdaten treten nie doppelt auf.
 */
class Pillar extends Model {
	public id!: number;
	public name!: string;
	public weight!: number;
	public description!: string;

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
	},
	{
		sequelize,
		modelName: 'Pillar',
		tableName: 'pillars',
		timestamps: true,
		// Säulennamen sind global eindeutig (globale Stammdaten, nicht pro Nutzer). Der frühere
		// #207-Index auf (name, userId) wurde mit dem userId-Cleanup durch diesen ersetzt.
		indexes: [{ unique: true, fields: ['name'] }],
	},
);

export default Pillar;
