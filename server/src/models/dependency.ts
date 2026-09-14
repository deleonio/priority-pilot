import { Model, DataTypes } from 'sequelize';
import sequelize from '../database.js';

class Dependency extends Model {}

Dependency.init(
	{
		// Gültiger Bereich 0,1–1 (#1429), durchgesetzt in der Route `POST /tasks/:id/dependencies`
		// (server/src/express/routes/tasks.ts) — nicht hier im Modell. Ausgewertet in
		// `calculateValueContribution` (server/src/logics/value.ts) und `buildTaskGraph`
		// (server/src/logics/graph.ts).
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
