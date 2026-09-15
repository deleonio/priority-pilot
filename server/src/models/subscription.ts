import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Ein Zahlungsanbieter-Abo eines Nutzers (Issue #1494, T6a). Hält ausschließlich die für Support
 * und Statusanzeige nötigen Metadaten — Anbieter, externe Abo-ID, gebuchtes Paket/Zeitraum, Status,
 * aktuelle Periode und Rechnungsreferenz. Der Preis lebt ausschließlich in `../logics/plans.ts`
 * (`PLAN_PRICES`): dieses Modell speichert bewusst **keine** Beträge und **keine** Zahlungsdaten.
 *
 * Pro Nutzer über `userId` gefiltert, ohne Sequelize-Assoziation (Muster `apiToken.ts`).
 */
class Subscription extends Model {
	public id!: number;
	public userId!: number;
	public provider!: string;
	public externalSubscriptionId!: string;
	public plan!: string;
	public period!: 'monthly' | 'quarterly' | 'yearly';
	public status!: string;
	public currentPeriodEnd!: Date;
	public invoiceReference?: string | null;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

Subscription.init(
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
		provider: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		externalSubscriptionId: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		plan: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		period: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		status: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		currentPeriodEnd: {
			type: DataTypes.DATE,
			allowNull: false,
		},
		invoiceReference: {
			type: DataTypes.STRING,
			allowNull: true,
		},
	},
	{
		sequelize,
		modelName: 'Subscription',
		tableName: 'subscriptions',
		timestamps: true,
	},
);

export default Subscription;
