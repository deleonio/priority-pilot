import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Schnappschuss einer Aufgabe, die per Auto-Delete-Cron (`runDeadlineAutoDelete`, Issue #523)
 * hart gelöscht wurde, weil ihre Deadline seit 3 Tagen verstrichen war. Rein informativ — macht
 * verpasste/aufgeräumte Aufgaben im Bewertungssystem sichtbar, wirkt sich aber NICHT auf
 * `berechneScore`/`berechneStreak`/`berechneMeilensteine` aus (keine Minuspunkte, kein
 * Streak-Malus). Keine Assoziation zu `Task`: die referenzierte Aufgabe existiert nach dem
 * Löschen nicht mehr, daher werden `userId` und die Anzeige-Felder hier denormalisiert.
 */
class MissedTask extends Model {
	public id!: number;
	public taskId!: number;
	public userId?: number | null;
	public title!: string;
	public deadline!: Date;
	public priority?: number | null;
	public verpasstAm!: Date;
}

MissedTask.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		taskId: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		userId: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		title: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		deadline: {
			type: DataTypes.DATE,
			allowNull: false,
		},
		priority: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		verpasstAm: {
			type: DataTypes.DATE,
			allowNull: false,
		},
	},
	{
		sequelize,
		modelName: 'MissedTask',
		tableName: 'missed_tasks',
		timestamps: false,
		indexes: [{ fields: ['userId', 'verpasstAm'] }],
	},
);

export default MissedTask;
