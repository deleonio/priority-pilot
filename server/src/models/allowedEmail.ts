import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * DB-Zulassung einer E-Mail-Adresse mit Herkunft (#1982/#1983): Wer freigeschaltet wurde, darf
 * sich anmelden — unabhängig von der Env-Allowlist (`GOOGLE_ALLOWED_EMAIL[S]`), die daneben
 * weiterwirkt (ADR 0019). `origin` nennt den Freischaltweg: `'warteliste'` (#1982, Admin-
 * Freischaltung der Warteliste), `'einladung'`/`'delegation'`/`'admin'` (#1983). Gelesen über
 * `logics/allowedEmails.ts` (`isDbEmailAllowed`), geschrieben über `logics/waitlist.ts`.
 * E-Mails werden normalisiert gespeichert (trim + lowercase, wie `logics/allowedEmails.ts`).
 */
class AllowedEmail extends Model {
	public id!: number;
	public email!: string;
	public origin!: 'warteliste' | 'einladung' | 'delegation' | 'admin';
	public createdAt!: Date;
}

AllowedEmail.init(
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
		origin: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		createdAt: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: DataTypes.NOW,
		},
	},
	{
		sequelize,
		modelName: 'AllowedEmail',
		tableName: 'allowed_emails',
		timestamps: false,
	},
);

export default AllowedEmail;
