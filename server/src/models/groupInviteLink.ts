import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Teilbarer Einladungslink einer Gruppe (#1226). Der Token ist unique und wird per
 * `crypto.randomBytes` erzeugt; „gültig" heißt: nicht abgelaufen (`expiresAt`) und nicht
 * widerrufen (`revokedAt`). Bewusst minimal — der Linkpreisgabe enthält weder Mitglieder
 * noch E-Mails, nur Gruppenname und Anzeigename des Einladenden (siehe routes/groups.ts).
 */
class GroupInviteLink extends Model {
	public id!: number;
	public groupId!: number;
	public token!: string;
	public createdByUserId!: number;
	public expiresAt!: Date;
	public revokedAt!: Date | null;
	public createdAt!: Date;
}

GroupInviteLink.init(
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
		token: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true,
		},
		createdByUserId: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		expiresAt: {
			type: DataTypes.DATE,
			allowNull: false,
		},
		revokedAt: {
			type: DataTypes.DATE,
			allowNull: true,
			defaultValue: null,
		},
		createdAt: {
			type: DataTypes.DATE,
			allowNull: false,
		},
	},
	{
		sequelize,
		modelName: 'GroupInviteLink',
		tableName: 'group_invite_links',
		timestamps: false,
	},
);

export default GroupInviteLink;
