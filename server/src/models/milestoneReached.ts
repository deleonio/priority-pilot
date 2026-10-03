import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Ein einmal erreichter Meilenstein eines Nutzers (Issue #1965): pro Nutzer und Meilenstein-
 * Schlüssel (`streak-<n>` / `punkte-<n>` aus `berechneMeilensteine`, `logics/milestones.ts`)
 * speichert die Zeile, dass die Stufe erreicht war. Einmal erreicht bleibt erreicht — das
 * Wiedereröffnen einer erledigten Aufgabe senkt die Punktesumme, nimmt aber keine Auszeichnung
 * mehr weg (Belohnung nie als Bestrafung).
 *
 * **Pro Nutzer isoliert** (`userId` Pflicht, Muster `api_tokens`): die Zeilen entstehen beim
 * Lesen der Meilenstein-Stände rückwirkend aus den Bestandsdaten (#1362-Muster) und werden mit
 * dem Konto gelöscht (`logics/deleteAccount.ts`).
 */
class MilestoneReached extends Model {
	public id!: number;
	// Eigentümer des Meilenstein-Stands (Datenisolation #207) — Pflicht, siehe Klassenkommentar.
	public userId!: number;
	// Meilenstein-Schlüssel aus `berechneMeilensteine` (`streak-<n>` / `punkte-<n>`).
	public schluessel!: string;
	// Wann die Stufe erstmals als erreicht persistiert wurde.
	public zeitpunkt!: Date;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

MilestoneReached.init(
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
		schluessel: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		zeitpunkt: {
			type: DataTypes.DATE,
			allowNull: false,
		},
	},
	{
		sequelize,
		modelName: 'MilestoneReached',
		tableName: 'milestone_reached',
		timestamps: true,
		// Ein Stand je Nutzer und Schwelle — die Persistierung beim Lesen ist idempotent (findOrCreate).
		indexes: [{ unique: true, fields: ['userId', 'schluessel'] }],
	},
);

export default MilestoneReached;
