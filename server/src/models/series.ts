import {
	BelongsToManyAddAssociationMixin,
	BelongsToManyGetAssociationsMixin,
	DataTypes,
	Model,
} from 'sequelize';
import sequelize from '../database.js';
import Pillar from './pillar.js';
import SeriesPillar from './seriesPillar.js';

/** Unterstützte Wiederholungsfrequenzen einer Serien-Vorlage. */
export type SeriesFrequency = 'DAILY' | 'WEEKLY';

/** Eine Säule samt der zugehörigen Snapshot-Join-Zeile (`share`/`confidence`). */
export type SeriesPillarContribution = Pillar & { SeriesPillar: SeriesPillar };

/**
 * Vorlage (Template) für eine wiederkehrende Aufgabe. Aus ihr materialisiert
 * `generateDueInstances` (siehe logics/series.ts) je fälligem Termin im Horizont genau **eine**
 * konkrete `Task`-Instanz. Die Säulen-Zuordnung der Vorlage ist n:m über `series_pillars` und wird
 * beim Generieren als **Snapshot** auf die Instanz kopiert (Entkopplung künftiger Template-Edits).
 */
class Series extends Model {
	public id!: number;
	public frequency!: SeriesFrequency;
	public interval!: number;
	public byWeekday?: number[] | null;
	public startDate!: string;
	public defaultPriority!: number;
	public active!: boolean;

	// Säulen-Beiträge der Vorlage (n:m über `series_pillars`); die Join-Zeile trägt `share`/`confidence`.
	public getPillars!: BelongsToManyGetAssociationsMixin<SeriesPillarContribution>;
	public addPillar!: BelongsToManyAddAssociationMixin<Pillar, number>;

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
		frequency: {
			type: DataTypes.ENUM('DAILY', 'WEEKLY'),
			allowNull: false,
		},
		interval: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 1,
			validate: {
				min: 1,
			},
		},
		// Optionale Wochentags-Einschränkung (0–6) für WEEKLY; fehlt sie, gilt der Wochentag des
		// `startDate`. Aktuell als Snapshot-fähige Liste vorgehalten (Generierung nutzt `startDate`).
		byWeekday: {
			type: DataTypes.JSON,
			allowNull: true,
		},
		startDate: {
			type: DataTypes.DATEONLY,
			allowNull: false,
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
		active: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: true,
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
