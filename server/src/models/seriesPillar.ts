import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Verknüpfung Series↔Säule (n:m) — die Säulen-**Vorlage** eines Serien-Templates (#302). Analog zu
 * `TaskPillar`, aber auf der Template-Ebene: Pro (Series, Säule):
 * - `share`: prozentualer Investitions-Anteil der Serie in diese Säule (0–100). Die Summe der
 *   `share` über die Säulen **einer** Serie ergibt 100 (siehe geteilte Validierung in
 *   logics/pillarContributions.ts).
 * - `confidence`: Konfidenz in Prozent (0–100; Default 100 ⇒ volle Sicherheit), wie sicher der
 *   Beitrag tatsächlich auf diese Säule einzahlt.
 *
 * `seriesId` + `pillarId` bilden zusammen den Primärschlüssel: jede Säule kommt je Serie höchstens
 * einmal vor (kein Duplikat).
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
