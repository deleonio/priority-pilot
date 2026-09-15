import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Eine ausgestellte Rechnung zu einem Abrechnungszeitraum (Issue #1495 AK8). `number` ist die
 * fortlaufende Rechnungsnummer aus `../logics/invoices.ts` (`INV-<Jahr>-<6-stellig>`, eindeutig per
 * DB-Constraint). `taxNote` trägt den §19-UStG-Hinweis — es gibt bewusst **keinen Steuerausweis**
 * (Kleinunternehmerregelung, ADR 0013).
 *
 * `amountCents` ist der Rechnungsbetrag, **kein** Zahlungsmittel: Karten-/Kontodaten werden hier
 * nicht gespeichert (AK9). Pro Nutzer über `userId` gefiltert, ohne Sequelize-Assoziation
 * (Muster `subscription.ts`).
 */
class Invoice extends Model {
	public id!: number;
	public userId!: number;
	public subscriptionId!: number;
	public number!: string;
	public periodStart!: Date;
	public periodEnd!: Date;
	public amountCents!: number;
	public taxNote!: string;
	public deliveredAt?: Date | null;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

Invoice.init(
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
		subscriptionId: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		number: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true,
		},
		periodStart: {
			type: DataTypes.DATE,
			allowNull: false,
		},
		periodEnd: {
			type: DataTypes.DATE,
			allowNull: false,
		},
		amountCents: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		taxNote: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		deliveredAt: {
			type: DataTypes.DATE,
			allowNull: true,
		},
	},
	{
		sequelize,
		modelName: 'Invoice',
		tableName: 'invoices',
		timestamps: true,
	},
);

export default Invoice;
