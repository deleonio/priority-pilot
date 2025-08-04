import { Model, DataTypes } from 'sequelize';
import sequelize from '../database.js';

/**
 * Zwischentabelle, die die Abhängigkeiten zwischen zwei Aufgaben
 * inklusive eines Gewichtungsfaktors abbildet.
 */
class Dependency extends Model {}

Dependency.init(
	{
		weight: {
			// Einfluss des abhängigen Tasks (0-1)
			type: DataTypes.FLOAT,
			allowNull: false,
			defaultValue: 1.0,
		},
	},
	{
		sequelize,
		modelName: 'Dependency',
		tableName: 'dependencies',
		timestamps: false,
	},
);

export default Dependency;
