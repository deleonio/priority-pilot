import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';
import type { Plan } from '../logics/plans.js';

/** Systemweite Nutzerrolle (Rollensystem admin/member/tester) — getrennt von `GroupRole` (Gruppen-Mitgliedschaft). */
export type UserRole = 'admin' | 'member' | 'tester';

/**
 * Ein Benutzer mit E-Mail-/Passwort-Authentifizierung (Issue #206).
 * `passwordHash` hält ausschließlich den bcrypt-Hash — niemals das Klartext-Passwort.
 * `displayName` fällt per Default auf die E-Mail zurück.
 */
class User extends Model {
	public id!: number;
	public email!: string;
	public passwordHash!: string;
	public displayName!: string;
	public avatarUrl!: string | null;
	/**
	 * `true`, sobald der Nutzer den Anzeigenamen selbst über `PUT /profile` gesetzt hat (#1256) —
	 * dann überschreibt der OAuth-Profil-Sync (`upsertOAuthUser`) den Namen nicht mehr; ohne
	 * eigenes Setzen (0) folgt `displayName` weiter dem Google-Profil. Der Avatar-Sync bleibt
	 * von der Flag unberührt.
	 */
	public displayNameCustom!: boolean;
	/** Geo-Konfiguration pro User (#1098) — serverseitig statt localStorage. */
	public displayDistanceKm!: number;
	public alarmDistanceKm!: number;
	public intervalMinutes!: number;
	/** Zuletzt gemeldete Position (#1926) — Bezug der Flankenerkennung „Eintritt in den Alarmabstand"; `null` = noch keine Meldung. */
	public lastGeoLatitude!: number | null;
	public lastGeoLongitude!: number | null;
	/** Fürsorge-Push (#1794) — eigener Schalter (Default ein), unabhängig vom Push-Hauptschalter. */
	public carePushEnabled!: boolean;
	/** Hinweis zum Aufteilen großer, mehrfach verschobener Aufgaben (#1994) — Default ein. */
	public splitHintEnabled!: boolean;
	/** IANA-Zeitzone des Nutzers (#1794) — Ruhezeit + Kalendertag-Dedup; `null` = UTC-Fallback. */
	public zeitzone!: string | null;
	public sprache!: string | null;
	/** Zifferblatt-Auswahl (#2009) — serverseitig am Konto statt nur im Gerät; `null` = Default `bluete`. */
	public balanceVariant!: string | null;
	/** Inhaltliche Präferenzen am Konto (#2398) — `null` = bisheriger Frontend-Default. */
	public aiEnabled!: boolean | null;
	public balancePriority!: boolean | null;
	public expertMode!: boolean | null;
	public geolocationEnabled!: boolean | null;
	/** Mindestdauer freier Kalender-Lücken in Minuten (#1990, Default 30). */
	public freeSlotMinMinutes!: number;
	/** Systemweite Rolle (Rollensystem admin/member/tester) — steuert Admin-Views und -API-Endpunkte. */
	public role!: UserRole;
	/**
	 * Ausgewählter LLM-Provider für die KI-Aufrufe dieses Nutzers (#1548) — `null` = keine
	 * Auswahl (Auflösung fällt auf den instanzweit aktiven Provider zurück). Wirksam wird nur
	 * eine Auswahl auf einen EIGENEN Provider (#1547).
	 */
	public selectedLlmProviderId!: number | null;
	/**
	 * Start des letzten Laufs der Säulen-Neuberechnung (#1614) — Bezugspunkt für „Fortsetzen": offen
	 * sind die Aufgaben, deren `pillarsRecalculatedAt` fehlt oder älter ist. `null` = noch nie gelaufen.
	 */
	public pillarRecalcStartedAt!: Date | null;
	/** Gebuchtes Paket (#1456) — Quelle der Entitlement-Auswertung in `logics/plans.ts`. */
	public plan!: Plan;
	/** Zustimmung zu den Nutzungsbedingungen (#1901): Fassung (`TERMS_VERSION`) und Zeitpunkt; `null` = noch nie. */
	public termsVersion!: string | null;
	public termsAcceptedAt!: Date | null;
	/** Dialog-Vorgaben für die per MCP verbundene KI (#1935) — getrimmter Freitext; `null` = keine. */
	public mcpInstructions!: string | null;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

User.init(
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
		passwordHash: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		displayName: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultValue: '',
		},
		avatarUrl: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		displayNameCustom: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		displayDistanceKm: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 5,
		},
		alarmDistanceKm: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 1,
		},
		intervalMinutes: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 5,
		},
		lastGeoLatitude: {
			type: DataTypes.FLOAT,
			allowNull: true,
			defaultValue: null,
		},
		lastGeoLongitude: {
			type: DataTypes.FLOAT,
			allowNull: true,
			defaultValue: null,
		},
		carePushEnabled: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: true,
		},
		splitHintEnabled: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: true,
		},
		zeitzone: {
			type: DataTypes.STRING,
			allowNull: true,
			defaultValue: null,
		},
		sprache: {
			type: DataTypes.STRING,
			allowNull: true,
			defaultValue: null,
		},
		balanceVariant: {
			type: DataTypes.STRING,
			allowNull: true,
			defaultValue: null,
		},
		aiEnabled: {
			type: DataTypes.BOOLEAN,
			allowNull: true,
			defaultValue: null,
		},
		balancePriority: {
			type: DataTypes.BOOLEAN,
			allowNull: true,
			defaultValue: null,
		},
		expertMode: {
			type: DataTypes.BOOLEAN,
			allowNull: true,
			defaultValue: null,
		},
		geolocationEnabled: {
			type: DataTypes.BOOLEAN,
			allowNull: true,
			defaultValue: null,
		},
		freeSlotMinMinutes: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 30,
		},
		role: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultValue: 'member',
		},
		selectedLlmProviderId: {
			type: DataTypes.INTEGER,
			allowNull: true,
			defaultValue: null,
		},
		pillarRecalcStartedAt: {
			type: DataTypes.DATE,
			allowNull: true,
			defaultValue: null,
		},
		plan: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultValue: 'free',
		},
		termsVersion: {
			type: DataTypes.STRING,
			allowNull: true,
			defaultValue: null,
		},
		termsAcceptedAt: {
			type: DataTypes.DATE,
			allowNull: true,
			defaultValue: null,
		},
		mcpInstructions: {
			type: DataTypes.TEXT,
			allowNull: true,
			defaultValue: null,
		},
	},
	{
		sequelize,
		modelName: 'User',
		tableName: 'users',
		timestamps: true,
	},
);

export default User;
