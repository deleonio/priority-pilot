import { DataTypes, Model, Op, literal, type OrderItem, type WhereOptions } from 'sequelize';
import sequelize from '../database.js';

/**
 * Ein Zahlungsanbieter-Abo eines Nutzers (Issue #1494, T6a). Hält ausschließlich die für Support
 * und Statusanzeige nötigen Metadaten — Anbieter, externe Abo-ID, gebuchtes Paket/Zeitraum, Status,
 * aktuelle Periode und Rechnungsreferenz. Der Preis lebt ausschließlich in `../logics/plans.ts`
 * (`PLAN_PRICES`): dieses Modell speichert bewusst **keine** Preise und **keine** Zahlungsdaten —
 * einzige Ausnahme ist das Upgrade-Guthaben `creditCents` (#1912).
 *
 * Pro Nutzer über `userId` gefiltert, ohne Sequelize-Assoziation (Muster `apiToken.ts`).
 */
class Subscription extends Model {
	public id!: number;
	public userId!: number;
	public provider!: string;
	public externalSubscriptionId!: string;
	public plan!: string;
	public period!: 'monthly' | 'quarterly' | 'yearly';
	public status!: string;
	public currentPeriodEnd!: Date;
	public invoiceReference?: string | null;
	/** Geplanter Paketwechsel nach unten (#1495 AK4) — wirkt erst ab `pendingPlanEffectiveAt`. */
	public pendingPlan?: string | null;
	/** Vorgemerkter Zeitraum des geplanten Wechsels — zusammen mit `pendingPlan` fällig. */
	public pendingPeriod?: 'monthly' | 'quarterly' | 'yearly' | null;
	public pendingPlanEffectiveAt?: Date | null;
	/** Zeitpunkt des ersten fehlgeschlagenen Einzugs (#1506 AK8) — Basis der Kulanzfrist. */
	public firstFailureAt?: Date | null;
	/** Bisherige Versuche der PayPal-Kündigung nach Fristablauf, solange sie nicht bestätigt ist (#2606); sonst null. */
	public cancelRetryAttempts?: number | null;
	/** Bisherige Versuche der anteiligen Restlaufzeit-Erstattung (#2745), solange sie nicht gelang; sonst null. */
	public refundRetryAttempts?: number | null;
	/** Guthaben aus dem abgelösten Abo (#1912), einmalig auf der ersten Rechnung verrechnet. */
	public creditCents!: number;
	/** Zeitpunkt der PayPal-Zustimmung (ACTIVATED) eines Upgrades, das bis zum Zahlungseingang ausstehend bleibt (#2238). */
	public approvedAt?: Date | null;
	/** Angaben aus dem Kündigungsdialog (#2308): Art, Grund (nur außerordentlich), Bestätigungsadresse, Eingang. */
	public cancellationKind?: 'ordinary' | 'extraordinary' | null;
	public cancellationReason?: string | null;
	public cancellationEmail?: string | null;
	public cancellationRequestedAt?: Date | null;
	/** Zustimmung zum sofortigen Leistungsbeginn beim Erstkauf (#2329, § 312f BGB) — Serverzeit des Checkout-Starts. */
	public withdrawalConsentAt?: Date | null;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

Subscription.init(
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
		provider: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		externalSubscriptionId: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		plan: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		period: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		status: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		currentPeriodEnd: {
			type: DataTypes.DATE,
			allowNull: false,
		},
		invoiceReference: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		pendingPlan: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		pendingPeriod: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		pendingPlanEffectiveAt: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		firstFailureAt: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		cancelRetryAttempts: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		refundRetryAttempts: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		creditCents: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		approvedAt: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		cancellationKind: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		cancellationReason: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		cancellationEmail: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		cancellationRequestedAt: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		withdrawalConsentAt: {
			type: DataTypes.DATE,
			allowNull: true,
		},
	},
	{
		sequelize,
		modelName: 'Subscription',
		tableName: 'subscriptions',
		timestamps: true,
		// Ein Kauf beim Anbieter gehört zu genau einem Abo; schützt gleichzeitig eingereichte Play-Käufe.
		indexes: [{ unique: true, fields: ['provider', 'externalSubscriptionId'] }],
	},
);

/** Status eines laufenden oder ausstehenden Abos: blockt einen zweiten Abschluss und das Löschen des Kontos. */
export const OPEN_SUBSCRIPTION_STATUSES = ['active', 'approval_pending', 'past_due', 'suspended'];

/** Zahlungsrückstand (#2240): das Abo läuft beim Anbieter weiter und zählt als offen. */
export const OVERDUE_SUBSCRIPTION_STATUSES = ['past_due', 'suspended'];

/** Status, in denen ein Abo bezahlt läuft — anders als {@link OPEN_SUBSCRIPTION_STATUSES} ohne `approval_pending`. */
const RUNNING_SUBSCRIPTION_STATUSES = ['active', 'past_due', 'suspended'];

/** Effektives Ende eines gekündigten Abos (#2745): das gekürzte Vertragsende (`pendingPlanEffectiveAt`), sonst das Periodenende. */
export const effectiveCancellationEnd = (sub: {
	currentPeriodEnd: Date | null;
	pendingPlanEffectiveAt?: Date | string | null;
}): Date | null => (sub.pendingPlanEffectiveAt != null ? new Date(sub.pendingPlanEffectiveAt) : sub.currentPeriodEnd);

/** Läuft effektiv (#1338): bezahlt offen oder gekündigt mit Restlaufzeit (#2745: bis zum gekürzten Vertragsende). */
export const isSubscriptionRunning = (
	sub: { status: string; currentPeriodEnd: Date | null; pendingPlanEffectiveAt?: Date | string | null },
	now = new Date(),
): boolean => {
	if (RUNNING_SUBSCRIPTION_STATUSES.includes(sub.status)) {
		return true;
	}
	if (sub.status !== 'cancelled') {
		return false;
	}
	const end = effectiveCancellationEnd(sub);
	return end !== null && end > now;
};

/** {@link isSubscriptionRunning} als Datenbank-Filter. */
export const runningSubscriptionWhere = (now = new Date()): WhereOptions => ({
	[Op.or]: [
		{ status: RUNNING_SUBSCRIPTION_STATUSES },
		{
			status: 'cancelled',
			// Gekündigt (#2745): Restlaufzeit zählt bis zum gekürzten Vertragsende, sonst bis zum Periodenende.
			[Op.or]: [
				{ pendingPlanEffectiveAt: { [Op.gt]: now } },
				{ pendingPlanEffectiveAt: null, currentPeriodEnd: { [Op.gt]: now } },
			],
		},
	],
});

/** Reihenfolge offener Abos: bezahlte vor einem nie bestätigten Checkout (#2235, #2240). */
export const PAID_FIRST: OrderItem = [literal("status = 'approval_pending'"), 'ASC'];

export default Subscription;
