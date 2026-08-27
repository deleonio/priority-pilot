import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';
import type Pillar from './pillar.js';
import type SeriesPillar from './seriesPillar.js';

/** Wiederholungsrhythmus eines Serien-Templates (striktes RRULE-Subset, siehe #120). */
export type SeriesRhythm =
	'daily' | 'weekly' | 'monthly' | 'weekdays' | 'weekend' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** Eine Säule samt der zugehörigen Join-Zeile (`share`/`confidence`) der Serien-Vorlage (#302). */
type SeriesPillarWithContribution = Pillar & { SeriesPillar: SeriesPillar };

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
	public priority!: number;
	public estimatedEffort!: number;
	public active!: boolean;
	public startDate!: Date;

	// Freitext-Beschreibung des Templates (Issue #301, AK-A2.1). Nullable/optional: Bestände ohne
	// Beschreibung bleiben lesbar; ohne Angabe angelegte Serien tragen `description === null`.
	public description?: string | null;

	// Adresse des Serien-Orts (#1063, analog `Task.address`): wird beim Generieren als Snapshot auf
	// jede Instanz vererbt. Nullable — die meisten Serien haben keinen Ortsbezug.
	public address?: string | null;

	// Auto-Löschung bei verpasster Deadline (Issue #523): wird beim Generieren auf jede Instanz
	// vererbt, sodass die Cron-Löschlogik auch für Serien-Aufgaben greift. Default `false`.
	public autoDeleteAfterDeadline!: boolean;

	// Eigentümer des Templates (Issue #244, AK1 — Datenisolation), analog zu `Task.userId`. Nullable
	// für Abwärtskompatibilität: Alt-Bestände ohne Zuordnung bleiben lesbar; neue Serien werden über
	// die Session-`userId` gebunden.
	public userId?: number | null;

	/** Eager-geladene Säulen-Vorlage (über `include: [Pillar]`); je Eintrag mit `SeriesPillar` (#302). */
	public Pillars?: SeriesPillarWithContribution[];

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
			type: DataTypes.STRING(30),
			allowNull: false,
			validate: {
				len: [1, 30],
			},
		},
		rhythm: {
			type: DataTypes.ENUM(
				'daily',
				'weekly',
				'monthly',
				'weekdays',
				'weekend',
				'mon',
				'tue',
				'wed',
				'thu',
				'fri',
				'sat',
				'sun',
			),
			allowNull: false,
			defaultValue: 'weekly',
		},
		priority: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 3,
			validate: {
				min: 1,
				max: 5,
			},
		},
		estimatedEffort: {
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
		// Eigentümer-Bindung (Issue #244, AK1). `null` erlaubt (Abwärtskompatibilität, s. o.).
		// `defaultValue: null` stellt sicher, dass eine ohne Angabe angelegte Serie `userId === null`
		// (statt `undefined`) trägt.
		userId: {
			type: DataTypes.INTEGER,
			allowNull: true,
			defaultValue: null,
		},
		// Freitext-Beschreibung (Issue #301). `null` erlaubt; `defaultValue: null` stellt sicher, dass
		// eine ohne Angabe angelegte Serie `description === null` (statt `undefined`) trägt.
		description: {
			type: DataTypes.TEXT,
			allowNull: true,
			defaultValue: null,
		},
		// Adresse des Serien-Orts (#1063), analog `Task.address`. `null` erlaubt; `defaultValue: null`
		// stellt sicher, dass eine ohne Angabe angelegte Serie `address === null` trägt.
		address: {
			type: DataTypes.STRING(255),
			allowNull: true,
			defaultValue: null,
		},
		// Auto-Löschung bei verpasster Deadline (Issue #523). Default `false`; beim Generieren vererbt.
		autoDeleteAfterDeadline: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
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
