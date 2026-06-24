import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/** Wiederholungsrhythmus eines Serien-Templates (striktes RRULE-Subset, siehe #120). */
export type SeriesRhythm = 'daily' | 'weekly' | 'monthly';

/**
 * Serien-Template einer wiederkehrenden Aufgabe (Habit, Konzept §4.2). Das Template hält den
 * Rhythmus und die Default-Werte; jede fällige Wiederholung wird über `generateDueInstances`
 * (siehe `logics/series.ts`) als **eigenständiger** `Task` mit `seriesId` materialisiert. Eine
 * Änderung am Template wirkt nur auf **künftige** Instanzen, nie rückwirkend.
 */
class Series extends Model {
	public id!: number;
	public title!: string;
	public rhythm!: SeriesRhythm;
	public defaultPriority!: number;
	public defaultEstimatedEffort!: number;
	public active!: boolean;
	public startDate!: Date;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

Series.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		title: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		rhythm: {
			type: DataTypes.ENUM('daily', 'weekly', 'monthly'),
			allowNull: false,
			defaultValue: 'weekly',
		},
		defaultPriority: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 3,
			validate: {
				min: 1,
				max: 5,
			},
		},
		defaultEstimatedEffort: {
			type: DataTypes.FLOAT,
			allowNull: false,
			defaultValue: 0.5,
			validate: {
				min: 0.1,
				max: 1,
			},
		},
		active: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: true,
		},
		startDate: {
			type: DataTypes.DATE,
			allowNull: false,
		},
	},
	{
		sequelize,
		modelName: 'Series',
		tableName: 'series',
		timestamps: true,
	},
);

export default Series;
