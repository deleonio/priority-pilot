import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Einmal-Token für den Magic-Link-Login per E-Mail. Der Klartext steht nur im Link der Mail;
 * gespeichert wird ausschließlich sein SHA-256-Hex (`tokenHash`, Muster {@link ./apiToken.ts}).
 *
 * Bewusst an die **E-Mail** gebunden, nicht an eine `userId`: Der Link darf auch für eine Adresse
 * verschickt werden, die noch kein Konto hat — angelegt wird der Nutzer erst beim Einlösen
 * (`upsertOAuthUser`, Verknüpfung über die E-Mail wie beim Google-Login).
 */
class LoginToken extends Model {
	public id!: number;
	public email!: string;
	// SHA-256-Hex des Klartexts; der Klartext selbst wird nie persistiert.
	public tokenHash!: string;
	public expiresAt!: Date;
	// Gesetzt = eingelöst. Ein Token gilt genau einmal (atomarer Verbrauch in `logics/magicLink.ts`).
	public usedAt?: Date | null;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

LoginToken.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		email: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		tokenHash: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		expiresAt: {
			type: DataTypes.DATE,
			allowNull: false,
		},
		usedAt: {
			type: DataTypes.DATE,
			allowNull: true,
		},
	},
	{
		sequelize,
		modelName: 'LoginToken',
		tableName: 'login_tokens',
		timestamps: true,
		// Hash = Lookup-Schlüssel beim Einlösen; `email` für das Limit pro Adresse.
		indexes: [{ unique: true, fields: ['tokenHash'] }, { fields: ['email'] }],
	},
);

export default LoginToken;
