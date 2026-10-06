import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Einmal-Token der Kündigung ohne Login (#2317, § 312k BGB), Muster {@link ./loginToken.ts}: der
 * Klartext steht nur im Link der Mail, gespeichert wird sein SHA-256-Hex. Trägt die Angaben der
 * Anfrage, damit die Bestätigung genau das kündigt, was der Kunde abgeschickt hat.
 */
class CancellationToken extends Model {
	public id!: number;
	// Konto-Adresse, an die der Link ging.
	public email!: string;
	public tokenHash!: string;
	public expiresAt!: Date;
	// Gesetzt = eingelöst; ein Token kündigt genau einmal.
	public usedAt?: Date | null;
	public subscriptionId!: number;
	public kind!: 'ordinary' | 'extraordinary';
	public reason?: string | null;
	// Wunschdatum (YYYY-MM-DD) oder `null` = zum nächstmöglichen Zeitpunkt.
	public effective?: string | null;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

CancellationToken.init(
	{
		id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
		email: { type: DataTypes.STRING, allowNull: false },
		tokenHash: { type: DataTypes.STRING, allowNull: false },
		expiresAt: { type: DataTypes.DATE, allowNull: false },
		usedAt: { type: DataTypes.DATE, allowNull: true },
		subscriptionId: { type: DataTypes.INTEGER, allowNull: false },
		kind: { type: DataTypes.STRING, allowNull: false },
		reason: { type: DataTypes.TEXT, allowNull: true },
		effective: { type: DataTypes.STRING, allowNull: true },
	},
	{
		sequelize,
		modelName: 'CancellationToken',
		tableName: 'cancellation_tokens',
		timestamps: true,
		indexes: [{ unique: true, fields: ['tokenHash'] }],
	},
);

export default CancellationToken;
