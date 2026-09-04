import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Mitgliedschaft Nutzer↔Gruppe (#1211): `groupId` + `userId` bilden zusammen den
 * Primärschlüssel (Muster `taskPillar.ts`) — jeder Nutzer kommt je Gruppe höchstens einmal
 * vor. `role` unterscheidet Admin (bearbeiten/löschen) von Mitglied; `joinedAt` hält den
 * Eintrittszeitpunkt explizit, da die Tabelle keine Timestamps pflegt.
 */
class GroupMember extends Model {
	public groupId!: number;
	public userId!: number;
	public role!: 'admin' | 'member';
	public joinedAt!: Date;
}

GroupMember.init(
	{
		groupId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			primaryKey: true,
		},
		userId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			primaryKey: true,
		},
		role: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultValue: 'member',
		},
		joinedAt: {
			type: DataTypes.DATE,
			allowNull: false,
		},
	},
	{
		sequelize,
		modelName: 'GroupMember',
		tableName: 'group_members',
		timestamps: false,
	},
);

export default GroupMember;
