import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Verknüpfung Serie↔Säule (n:m), analog zu `task_pillars`. Sie hält den **Template-Snapshot** der
 * Säulen-Verteilung, der beim Generieren auf jede Instanz kopiert wird:
 * - `share`: prozentualer Investitions-Anteil in diese Säule (0–100; Summe je Serie = 100).
 * - `confidence`: Konfidenz in Prozent (0–100; Default 100), wie sicher der Beitrag einzahlt.
 *
 * `seriesId` + `pillarId` bilden zusammen den Primärschlüssel (jede Säule je Serie höchstens einmal).
 */
class SeriesPillar extends Model {
	public seriesId!: number;
	public pillarId!: number;
	public share!: number;
	public confidence!: number;
}

SeriesPillar.init(
	{
		seriesId: {
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
		modelName: 'SeriesPillar',
		tableName: 'series_pillars',
		timestamps: false,
	},
);

export default SeriesPillar;
