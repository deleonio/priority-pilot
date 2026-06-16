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
			unique: true,
		},
		weight: {
			type: DataTypes.FLOAT,
			allowNull: false,
			defaultValue: 20,
			validate: {
				min: 0,
			},
		},
	},
	{
		sequelize,
		modelName: 'Pillar',
		tableName: 'pillars',
		timestamps: true,
	},
);

export default Pillar;
