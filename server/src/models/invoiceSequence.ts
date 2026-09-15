import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Nummernkreis-Reservierung für Rechnungsnummern (Issue #1495 AK8). Jede Reservierung ist EINE
 * Zeile; die Reihenfolge der Autoincrement-IDs je Kalenderjahr ergibt die lückenlos aufsteigende
 * laufende Nummer (`../logics/invoices.ts`).
 *
 * Bewusst über einen INSERT statt über einen Zähler mit `findOrCreate()`/Transaktion: In-Memory-
 * SQLite läuft mit `pool.max = 1`, überlagerte Transaktionen auf derselben Verbindung reißen dort
 * bei parallelen Aufrufen ab (Erfahrung aus #1483). Ein INSERT ist atomar, die vergebene ID
 * eindeutig — daraus lässt sich die Nummer ohne Sperre ableiten.
 */
class InvoiceSequence extends Model {
	public id!: number;
	public year!: number;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

InvoiceSequence.init(
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
		modelName: 'InvoiceSequence',
		tableName: 'invoice_sequences',
		timestamps: true,
	},
);

export default InvoiceSequence;
