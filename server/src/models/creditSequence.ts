import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Nummernkreis-Reservierung für Gutschriftnummern (#2237) — eigener Kreis neben den
 * Rechnungsnummern (`invoiceSequence.ts`), damit `GS-`-Nummern lückenlos neben `INV-`-Nummern
 * aufsteigen. Jede Reservierung ist EINE Zeile; die Reihenfolge der Autoincrement-IDs je
 * Kalenderjahr ergibt die laufende Nummer (`../logics/invoices.ts`).
 *
 * Bewusst über einen INSERT statt über einen Zähler: In-Memory-SQLite läuft mit `pool.max = 1`,
 * überlagerte Transaktionen auf derselben Verbindung reißen dort ab (Erfahrung aus #1483). Ein
 * INSERT ist atomar; läuft er in der Transaktion der Gutschrift (#2233), verbraucht ein Rollback
 * keine Nummer.
 */
class CreditSequence extends Model {
	public id!: number;
	public year!: number;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

CreditSequence.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		year: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
	},
	{
		sequelize,
		modelName: 'CreditSequence',
		tableName: 'credit_sequences',
		timestamps: true,
	},
);

export default CreditSequence;
