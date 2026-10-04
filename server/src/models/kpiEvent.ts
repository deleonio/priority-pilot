import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

export type KpiArt = 'aktivierung' | 'aktivitaet' | 'wochenkarte' | 'einladung';

/**
 * Anonymes KPI-Ereignis der Markteinführungs-Messung (#1989): UTC-Kalendertag, Ereignisart und
 * HMAC-`dedupKey` — bewusst ohne `userId` und ohne Aufgabeninhalte. Der Key ist ohne Server-Secret
 * nicht umkehrbar und taucht in keiner Auswertung auf (`logics/kpiKennzahlen.ts`); er macht
 * Ereignisse je Konto/Tag/Woche idempotent, ohne sie einem Konto zuordnen zu können.
 */
class KpiEvent extends Model {
	public id!: number;
	public tag!: string;
	public art!: KpiArt;
	public dedupKey!: string;
}

KpiEvent.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		tag: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		art: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		dedupKey: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true,
		},
	},
	{
		sequelize,
		modelName: 'KpiEvent',
		tableName: 'kpi_events',
		timestamps: false,
	},
);

export default KpiEvent;
