import { Model, DataTypes } from 'sequelize';
import sequelize from '../database.js';

class Dependency extends Model {}

Dependency.init(
	{
		weight: {
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
