import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Zugelassene E-Mail-Adresse mit Herkunft (#1983). Entsteht, wenn eine Gruppe eine unbekannte
 * Adresse einlädt (`einladung`), eine Aufgabe an sie delegiert wird (`delegation`) oder ein Admin
 * sie freischaltet (`admin`). Wirkt neben der Env-Allowlist (`logics/allowedEmails.ts`), die
 * unverändert weiterzieht (AK7) — das Konto selbst entsteht beim ersten Login (`upsertOAuthUser`).
 */
export type AllowedEmailOrigin = 'einladung' | 'delegation' | 'admin';

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
		indexes: [{ unique: true, fields: ['email'] }],
	},
);

// Benannter Export zusätzlich zum Default: Der Spec-Test (#1983) importiert `AllowedEmail`
// benannt; alle anderen Modelle folgen dem Default-Muster (models/index.ts).
export { AllowedEmail };
export default AllowedEmail;
