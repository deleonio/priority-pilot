import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Eine der fünf festen Lebensbalance-Säulen. **Globale Stammdaten** — für alle Nutzer identisch,
 * nicht pro Nutzer isoliert (die Säulen-Auswahl im API ist daher unscoped). `weight` ist der
 * prozentuale Anteil der Säule (Default 20 ⇒ fünf Säulen summieren sich auf 100 %). `description`
 * ist die kanonische Kurzbeschreibung (Einstellungs-Menü); Quelle der Werte ist
 * {@link ../models/pillarData.ts SEED_PILLARS}.
 */
class Pillar extends Model {
	public id!: number;
	public name!: string;
	public weight!: number;
	public description!: string;

	// Nur aus historischen Gründen vorhanden (Issue #207 hatte Säulen pro Nutzer isoliert; das wurde
	// zurückgenommen, weil Säulen feste App-Stammdaten sind). Nullable; **nicht** für Filter genutzt.
	public userId?: number | null;

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
		// Nur aus historischen Gründen nullable (siehe Klassen-Kommentar); nicht für Filter genutzt.
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
		// Historischer Unique-Index aus #207 (name, userId). Da Säulen global sind, ist `userId`
		// effektiv immer null; der Index bleibt aus Migrationssicherheit unangetastet.
		indexes: [{ unique: true, fields: ['name', 'userId'] }],
	},
);

export default Pillar;
