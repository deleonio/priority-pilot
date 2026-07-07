import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Verhindert doppelte Erinnerungen (Issue #355, fachlicher Push-Trigger): pro Auslöser-Art (`kind`,
 * z. B. `'due-task'`) und eindeutigem Schlüssel (`dedupeKey`, z. B. `taskId:deadlineISO`) wird
 * höchstens eine Zeile angelegt (Unique-Index) — ein wiederholter Scheduler-Lauf sendet dieselbe
 * Erinnerung nicht erneut. `userId` ist rein informativ (Nachvollziehbarkeit); die Isolation läuft
 * bereits über den `dedupeKey`, der die auslösende Entität (z. B. den Task) eindeutig bindet.
 */
class NotificationLog extends Model {
	public id!: number;
	public userId?: number | null;
	public kind!: string;
	public dedupeKey!: string;
	public sentAt!: Date;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

NotificationLog.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		userId: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		kind: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		dedupeKey: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		sentAt: {
			type: DataTypes.DATE,
			allowNull: false,
		},
	},
	{
		sequelize,
		modelName: 'NotificationLog',
		tableName: 'notification_logs',
		timestamps: true,
		// Idempotenz: dieselbe Auslöser-Art + derselbe dedupeKey wird nur einmal protokolliert.
		indexes: [{ unique: true, fields: ['kind', 'dedupeKey'] }],
	},
);

export default NotificationLog;
