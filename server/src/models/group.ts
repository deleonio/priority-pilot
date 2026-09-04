import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Eine Nutzergruppe (#1211, Teil 1 der Gruppen-Epic #952): Name (Pflicht, ≤ 60 Zeichen) und
 * optionale Beschreibung. **Bewusst ohne `userId`** — die Zugehörigkeit kommt ausschließlich
 * aus `group_members` (Membership statt Eigentümer): der Ersteller wird beim Anlegen als
 * Admin-Mitglied eingetragen, spätere Mitglieder kommen über Einladungen (Ticket 2, #952).
 * Sichtbarkeit/Rechte der Routen laufen daher über Membership-Lookups, nie über `ownerScope`.
 */
class Group extends Model {
	public id!: number;
	public name!: string;
	public description!: string | null;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

Group.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		name: {
			type: DataTypes.STRING(60),
			allowNull: false,
		},
		description: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
	},
	{
		sequelize,
		modelName: 'Group',
		tableName: 'groups',
	},
);

export default Group;
