import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Ein Benutzer mit E-Mail-/Passwort-Authentifizierung (Issue #206).
 * `passwordHash` hält ausschließlich den bcrypt-Hash — niemals das Klartext-Passwort.
 * `displayName` fällt per Default auf die E-Mail zurück.
 */
class User extends Model {
	public id!: number;
	public email!: string;
	public passwordHash!: string;
	public displayName!: string;
	public avatarUrl!: string | null;
	/** Geo-Konfiguration pro User (#1098) — serverseitig statt localStorage. */
	public displayDistanceKm!: number;
	public alarmDistanceKm!: number;
	public intervalMinutes!: number;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

User.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		email: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true,
		},
		passwordHash: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		displayName: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultValue: '',
		},
		avatarUrl: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		displayDistanceKm: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 5,
		},
		alarmDistanceKm: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 1,
		},
		intervalMinutes: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 5,
		},
	},
	{
		sequelize,
		modelName: 'User',
		tableName: 'users',
		timestamps: true,
	},
);

export default User;
