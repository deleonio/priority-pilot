import { randomBytes } from 'node:crypto';
import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Wartelisten-Eintrag für den Launch-Zugang (ADR 0019, #1982). Unbekannte Adressen tragen sich
 * selbst ein und sehen ihre Position im Referral-Rang; Admins schalten einzelne Einträge oder
 * die Top N frei — `status = 'activated'` ist reine Anzeige, die Login-Wirkung trägt der
 * zugelegte `AllowedEmail`-Eintrag (`isDbEmailAllowed`, origin `'warteliste'`).
 * `referralCode` ist der persönliche Empfehlungs-Code, `referredByCode` der Code des Werbers
 * (null, wenn ohne Empfehlung beigetreten). E-Mails werden normalisiert gespeichert
 * (trim + lowercase, wie `logics/allowedEmails.ts`).
 */
class WaitlistEntry extends Model {
	public id!: number;
	public email!: string;
	public referralCode!: string;
	public referredByCode!: string | null;
	public status!: 'waiting' | 'activated';
	/** Ergebnis des Freischalt-Mailversands (#2305); `null` = nie versucht. */
	public accessMailStatus!: 'sent' | 'failed' | null;
	/** App-Sprache beim Eintrag (`Accept-Language`) für die spätere Freischalt-Mail; `null` = Deutsch. */
	public sprache!: string | null;
	public createdAt!: Date;
}

/** Persönlicher Empfehlungs-Code: 16 Zeichen Base64url, kollisionsfrei genug für unique. */
export const newReferralCode = (): string => randomBytes(12).toString('base64url');

WaitlistEntry.init(
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
		referralCode: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true,
		},
		referredByCode: {
			type: DataTypes.STRING,
			allowNull: true,
			defaultValue: null,
		},
		status: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultValue: 'waiting',
		},
		accessMailStatus: {
			type: DataTypes.STRING,
			allowNull: true,
			defaultValue: null,
		},
		sprache: {
			type: DataTypes.STRING,
			allowNull: true,
			defaultValue: null,
		},
		createdAt: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: DataTypes.NOW,
		},
	},
	{
		sequelize,
		modelName: 'WaitlistEntry',
		tableName: 'waitlist_entries',
		timestamps: false,
	},
);

export default WaitlistEntry;
