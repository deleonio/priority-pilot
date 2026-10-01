import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/** Freischaltweg einer DB-Zulassung: Warteliste (#1982) oder Einladung/Delegation/Admin (#1983). */
export type AllowedEmailOrigin = 'einladung' | 'delegation' | 'admin' | 'warteliste';

const ORIGINS: AllowedEmailOrigin[] = ['einladung', 'delegation', 'admin', 'warteliste'];

/**
 * DB-Zulassung einer E-Mail-Adresse mit Herkunft (#1982/#1983): Wer freigeschaltet wurde, darf
 * sich anmelden — unabhängig von der Env-Allowlist (`GOOGLE_ALLOWED_EMAIL[S]`), die daneben
 * weiterwirkt (ADR 0019). Das Konto selbst entsteht beim ersten Login (`upsertOAuthUser`).
 * Gelesen und geschrieben über `logics/allowedEmails.ts` (`isDbEmailAllowed`, `allowEmail`).
 * E-Mails werden normalisiert gespeichert (trim + lowercase, wie `logics/allowedEmails.ts`).
 */
class AllowedEmail extends Model {
	public id!: number;
	public email!: string;
	public origin!: AllowedEmailOrigin;
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
			validate: { isIn: [ORIGINS] },
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

// Benannter Export zusätzlich zum Default: Der Spec-Test (#1983) importiert `AllowedEmail`
// benannt; alle anderen Modelle folgen dem Default-Muster (models/index.ts).
export { AllowedEmail };
export default AllowedEmail;
