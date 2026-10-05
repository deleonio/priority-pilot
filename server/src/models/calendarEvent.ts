import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Ein abgerufener Termin einer Kalenderquelle (#2209) — nur Start, Ende, Titel und ganztägig.
 * `userId` ist denormalisiert, damit die Route ohne Join scopen kann (Muster `missed_tasks`).
 */
class CalendarEvent extends Model {
	public id!: number;
	public userId!: number;
	public sourceId!: number;
	public start!: Date;
	public end!: Date;
	public title!: string;
	public allDay!: boolean;
}

CalendarEvent.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		userId: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		sourceId: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		start: {
			type: DataTypes.DATE,
			allowNull: false,
		},
		end: {
			type: DataTypes.DATE,
			allowNull: false,
		},
		title: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
		allDay: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
		},
	},
	{
		sequelize,
		modelName: 'CalendarEvent',
		tableName: 'calendar_events',
		timestamps: false,
	},
);

export default CalendarEvent;
