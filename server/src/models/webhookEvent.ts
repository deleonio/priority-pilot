import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Ein eingegangenes Webhook-Ereignis eines Zahlungsanbieters (Issue #1495, T6b). Hält den
 * unveränderten Rohbody (`rawPayload`) für Nachvollziehbarkeit und Signaturprüfung sowie die
 * Ereignis-ID des Anbieters. Der Unique-Index `(provider, externalEventId)` ist die
 * Dedup-Grundlage: ein zweifach zugestelltes Ereignis scheitert beim zweiten `create()` und wird
 * damit nur einmal verarbeitet (AK3).
 *
 * Speichert bewusst **keine** Zahlungsdaten (AK9) — Karten-/Kontodaten liegen ausschließlich bei
 * PayPal (ADR 0013).
 */
class WebhookEvent extends Model {
	public id!: number;
	public provider!: string;
	public externalEventId!: string;
	public eventType!: string;
	public rawPayload!: string;
	public verified!: boolean;
	public processedAt?: Date | null;
	public receivedAt!: Date;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

WebhookEvent.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		provider: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		externalEventId: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		eventType: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		rawPayload: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
		verified: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		processedAt: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		receivedAt: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: DataTypes.NOW,
		},
	},
	{
		sequelize,
		modelName: 'WebhookEvent',
		tableName: 'webhook_events',
		timestamps: true,
		indexes: [{ unique: true, fields: ['provider', 'externalEventId'] }],
	},
);

export default WebhookEvent;
