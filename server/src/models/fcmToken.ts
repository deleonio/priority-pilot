import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * FCM-Gerätetoken der Android-App (#1670, ADR 0016). Web Push gibt es im Android-WebView nicht; die
 * App meldet stattdessen ihr Firebase-Cloud-Messaging-Token an. Getrennt von {@link ./pushSubscription.ts},
 * weil ein FCM-Token keine Web-Push-Schlüssel hat.
 *
 * `token` ist global eindeutig: Ein Gerät gehört immer dem zuletzt angemeldeten Nutzer, eine erneute
 * Registrierung durch einen anderen Nutzer übernimmt die Zeile. `userId` ist wie bei den Web-Push-
 * Subscriptions nullable (Pass-Through-Modus ohne Auth-Konfiguration).
 */
class FcmToken extends Model {
	public id!: number;
	public token!: string;
	public userId?: number | null;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

FcmToken.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		token: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
		userId: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
	},
	{
		sequelize,
		modelName: 'FcmToken',
		tableName: 'fcm_tokens',
		timestamps: true,
		indexes: [{ unique: true, fields: ['token'] }, { fields: ['userId'] }],
	},
);

export default FcmToken;
