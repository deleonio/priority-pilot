import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Verknüpfung Task↔Säule (n:m). Pro (Task, Säule):
 * - `share`: prozentualer Investitions-Anteil des Tasks in diese Säule (0–100). Die Summe der
 *   `share` über die Säulen **eines** Tasks ergibt 100 (siehe Validierung in routes/tasks.ts).
 * - `confidence`: Konfidenz in Prozent (0–100; Default 100 ⇒ volle Sicherheit), wie sicher der
 *   Beitrag tatsächlich auf diese Säule einzahlt. Geht in die Wertberechnung ein (siehe value.ts).
 *
 * `taskId` + `pillarId` bilden zusammen den Primärschlüssel: jede Säule kommt je Task höchstens
 * einmal vor (kein Duplikat).
 */
class TaskPillar extends Model {
	public taskId!: number;
	public pillarId!: number;
	public share!: number;
	public confidence!: number;
}

TaskPillar.init(
	{
		taskId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			primaryKey: true,
		},
		pillarId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			primaryKey: true,
		},
		share: {
			type: DataTypes.FLOAT,
			allowNull: false,
			defaultValue: 0,
			validate: {
				min: 0,
				max: 100,
			},
		},
		confidence: {
			type: DataTypes.FLOAT,
			allowNull: false,
			defaultValue: 100,
			validate: {
				min: 0,
				max: 100,
			},
		},
	},
	{
		sequelize,
		modelName: 'TaskPillar',
		tableName: 'task_pillars',
		timestamps: false,
	},
);

export default TaskPillar;
