import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Eine Web-Push-Subscription eines Nutzers (Issue #355). Jede Zeile hält die vom Browser über
 * `PushManager.subscribe()` erzeugte Subscription: die eindeutige `endpoint`-URL des Push-Dienstes
 * sowie die beiden Verschlüsselungsschlüssel (`p256dh`, `auth`), mit denen `web-push` die Payload
 * für genau diesen Client verschlüsselt.
 *
 * **Pro Nutzer isoliert** (Datenisolation #207, `userId`): der interne Versand-Helper adressiert
 * gezielt die Subscriptions **eines** Nutzers — es gibt bewusst keinen „an alle senden"-Pfad.
 * `userId` ist wie bei {@link ./task.ts} nullable (Abwärtskompatibilität zum Pass-Through-Modus ohne
 * Auth-Konfiguration). `endpoint` ist **global eindeutig** (Unique-Index): ein erneutes `subscribe`
 * mit gleichem Endpoint aktualisiert die bestehende Zeile (Idempotenz), statt Duplikate anzulegen.
 */
class PushSubscription extends Model {
	public id!: number;
	public endpoint!: string;
	public p256dh!: string;
	public auth!: string;
	// Ablaufzeitpunkt der Subscription in Epoch-Millisekunden (vom Browser geliefert, meist `null`).
	public expirationTime?: number | null;
	// Eigentümer der Subscription (Datenisolation #207). `null` im Pass-Through-Modus (kein Auth-Gate).
	public userId?: number | null;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

PushSubscription.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		// Endpoint-URLs können lang sein (FCM/Mozilla) — TEXT statt STRING(255).
		endpoint: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
		p256dh: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		auth: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		expirationTime: {
			type: DataTypes.BIGINT,
			allowNull: true,
		},
		// Eigentümer-Bindung (Issue #207, AK5). `null` erlaubt (Abwärtskompatibilität, s. o.).
		userId: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
	},
	{
		sequelize,
		modelName: 'PushSubscription',
		tableName: 'push_subscriptions',
		timestamps: true,
		// Endpoint global eindeutig ⇒ erneutes subscribe ist idempotent (Upsert auf endpoint).
		indexes: [{ unique: true, fields: ['endpoint'] }],
	},
);

export default PushSubscription;
