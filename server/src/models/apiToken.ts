import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Ein persönlicher API-Token eines Nutzers für externe Clients (Issue #1352). Der Klartext
 * (`pp_<32 Hex>`) verlässt den Server genau einmal — in der Antwort auf `POST /api-tokens`;
 * gespeichert wird ausschließlich sein SHA-256-Hex (`tokenHash`, unique für den Lookup der
 * Bearer-Middleware).
 *
 * **Pro Nutzer isoliert** (`userId` Pflicht, anders als bei {@link ./pushSubscription.ts}): ein
 * Token ohne Besitzer hätte keine Datenisolation, deshalb gibt es hier keinen Pass-Through-Fall.
 * Der Rückzug ist ein Soft-Delete (`revokedAt`): die Zeile bleibt für die Nachvollziehbarkeit
 * bestehen, wird aber weder gelistet noch für die Authentifizierung akzeptiert.
 */
class ApiToken extends Model {
	public id!: number;
	// Eigentümer des Tokens (Datenisolation #207) — Pflicht, siehe Klassenkommentar.
	public userId!: number;
	public name!: string;
	// SHA-256-Hex des Klartexts; der Klartext selbst wird nie persistiert.
	public tokenHash!: string;
	// Zeitpunkt des letzten erfolgreichen Bearer-Requests (`null`, solange ungenutzt).
	public lastUsedAt?: Date | null;
	// Gesetzt = zurückgezogen (Soft-Delete); ab dann 401 für jeden Request mit diesem Token.
	public revokedAt?: Date | null;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

ApiToken.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		userId: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		name: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		tokenHash: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		lastUsedAt: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		revokedAt: {
			type: DataTypes.DATE,
			allowNull: true,
		},
	},
	{
		sequelize,
		modelName: 'ApiToken',
		tableName: 'api_tokens',
		timestamps: true,
		// Der Hash ist der Lookup-Schlüssel jedes Bearer-Requests ⇒ eindeutig und indiziert.
		indexes: [{ unique: true, fields: ['tokenHash'] }],
	},
);

export default ApiToken;
