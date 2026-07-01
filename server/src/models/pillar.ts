import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Eine der fünf festen Lebensbalance-Säulen. `weight` ist der prozentuale Anteil
 * der Säule (Default 20 ⇒ fünf Säulen summieren sich auf 100 %).
 */
class Pillar extends Model {
	public id!: number;
	public name!: string;
	public weight!: number;

	// Eigentümer der Säule (Issue #207, AK5 — Datenisolation). Nullable für Abwärtskompatibilität:
	// bestehende, nutzerlose Säulen bleiben erhalten; neue Säulen werden an die Session-`userId` gebunden.
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
		// Eigentümer-Bindung (Issue #207, AK5). `null` erlaubt (Abwärtskompatibilität, s. o.).
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
		// Säulennamen sind pro Nutzer eindeutig (statt global) — verschiedene Nutzer dürfen dieselbe
		// Säule benennen. Nutzerlose Alt-Säulen (`userId = null`) bleiben davon unberührt.
		indexes: [{ unique: true, fields: ['name', 'userId'] }],
	},
);

export default Pillar;
