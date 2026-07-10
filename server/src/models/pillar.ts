import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Eine der fünf festen Lebensbalance-Säulen. Säulen werden mit #427 **pro Nutzer** geführt: Jede
 * Säule trägt eine `userId` (nullable für Alt-Bestände vor der Migration). `weight` ist der
 * prozentuale Anteil der Säule (Default 20 ⇒ fünf Säulen summieren sich auf 100 %). `description`
 * ist die kanonische Kurzbeschreibung (Einstellungs-Menü); Quelle der Werte ist
 * {@link ../models/pillarData.ts SEED_PILLARS}. Säulennamen sind **pro Nutzer eindeutig**
 * (Unique-Index auf `name`, `userId`) — derselbe Name darf für verschiedene Nutzer existieren, für
 * denselben Nutzer aber nur einmal.
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
		// Eigentümer der Säule (#427). Nullable für Alt-Bestände (globale Säulen vor der Migration);
		// migratePillarsPerUser überführt diese in Pro-Nutzer-Säulen mit gesetzter userId.
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
		// Säulennamen sind pro Nutzer eindeutig (#427): derselbe Name darf für verschiedene Nutzer
		// existieren, für denselben Nutzer aber nur einmal.
		indexes: [{ unique: true, fields: ['name', 'userId'] }],
	},
);

export default Pillar;
