import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Einladung eines Kontos in eine Gruppe (#1212). Anders als `GroupMember` trägt die Tabelle
 * einen eigenen Autoincrement-PK und KEINEN Unique-Constraint auf `(groupId, invitedUserId)`:
 * nach einem `declined` darf dieselbe Person erneut eingeladen werden, es entsteht also eine
 * zweite Zeile. Die Duplikat-Regel („nur eine offene Einladung je Konto+Gruppe") ist deshalb
 * Anwendungslogik in routes/groups.ts und prüft ausschließlich gegen `status = 'pending'`.
 */
class GroupInvitation extends Model {
	public id!: number;
	public groupId!: number;
	public invitedUserId!: number;
	public invitedByUserId!: number;
	public status!: 'pending' | 'accepted' | 'declined';
	public createdAt!: Date;
}

GroupInvitation.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		groupId: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		invitedUserId: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		invitedByUserId: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		status: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultValue: 'pending',
		},
		createdAt: {
			type: DataTypes.DATE,
			allowNull: false,
		},
	},
	{
		sequelize,
		modelName: 'GroupInvitation',
		tableName: 'group_invitations',
		timestamps: false,
	},
);

export default GroupInvitation;
