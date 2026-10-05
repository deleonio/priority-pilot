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
	/** Währung der Abbuchung (#2232) — Altrechnungen tragen `EUR`. */
	public currency!: string;
	public taxNote!: string;
	public deliveredAt?: Date | null;
	/** Positionen (#1912) — nur bei Verrechnung befüllt; Altrechnungen tragen `[]`. */
	public lineItems!: { label: string; amountCents: number }[];
	/** PDF-Bytes (#1955 AK3) — zum Erzeugungszeitpunkt gespeichert; Altrechnungen tragen `null`. */
	public pdfBytes?: Buffer | null;
	/** Zahlungsstatus (#2086) — provider-neutral (`paid`/`refunded`); Rechnungen entstehen erst nach bestätigter Abbuchung. */
	public paymentStatus!: 'paid' | 'refunded';
	/** PayPal-Sale-Referenz (#2086) — Anker für spätere Erstattungen; Altrechnungen tragen `null`. */
	public saleId?: string | null;

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
		currency: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultValue: 'EUR',
		},
		taxNote: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		deliveredAt: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		lineItems: {
			type: DataTypes.JSON,
			allowNull: false,
			defaultValue: [],
		},
		pdfBytes: {
			type: DataTypes.BLOB,
			allowNull: true,
		},
		paymentStatus: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultValue: 'paid',
		},
		saleId: {
			type: DataTypes.STRING,
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
