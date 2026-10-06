import type Subscription from '../models/subscription.js';
import User from '../models/user.js';
import { adminEmails } from './adminEmails.js';
import { displayLabel } from './invoices.js';
import { isMailConfigured, sendMailToUser, type MailSender } from './mail.js';
import type { Plan } from './plans.js';

/**
 * Mails zur Kündigung (#2308, § 312k BGB): die Bestätigung an den Kunden geht allein aus dem
 * CANCELLED-Webhook (`applyPlanChange`), die Betreiber-Meldung einer außerordentlichen Kündigung
 * aus der Cancel-Route. Ohne SMTP und ohne injizierten `send` entfällt der Versand (Muster
 * `dueTaskReminders.ts`); Transportfehler schluckt `sendMailToUser`.
 */

const formatDate = (date: Date): string => date.toLocaleDateString('de-DE');

const contractLabel = (subscription: Subscription): string =>
	displayLabel(subscription.get('plan') as Plan, String(subscription.get('period')));

/** Kündigungsbestätigung an die Adresse aus dem Dialog, sonst die Konto-Adresse; ohne Angaben gilt ordentlich. */
export const sendCancellationConfirmation = async (
	subscription: Subscription,
	now: Date,
	send?: MailSender,
): Promise<void> => {
	if (!send && !isMailConfigured()) {
		return;
	}
	const extraordinary = subscription.get('cancellationKind') === 'extraordinary';
	const requestedAt = (subscription.get('cancellationRequestedAt') as Date | null) ?? now;
	const email =
		(subscription.get('cancellationEmail') as string | null) ??
		(await User.findByPk(subscription.get('userId') as number))?.email ??
		null;
	await sendMailToUser(
		{ email },
		{
			subject: 'Balamentum: Bestätigung deiner Kündigung',
			text: [
				'Hallo,',
				'',
				'wir bestätigen die Kündigung deines Abos.',
				'',
				`Vertrag: ${contractLabel(subscription)}`,
				`Art der Kündigung: ${extraordinary ? 'außerordentlich' : 'ordentlich'}`,
				...(extraordinary ? [`Grund: ${String(subscription.get('cancellationReason'))}`] : []),
				`Kündigung eingegangen am: ${formatDate(requestedAt)}`,
				`Vertragsende: ${formatDate(subscription.get('currentPeriodEnd') as Date)}`,
				'',
				'Bis zum Vertragsende bleibt dein Paket aktiv, danach nutzt du Balamentum im Free-Paket weiter.',
			].join('\n'),
		},
		send,
	);
};

/** Meldet eine außerordentliche Kündigung samt Grund an jede Adresse aus `ADMIN_EMAILS` zur Prüfung von Hand. */
export const notifyAdminsOfExtraordinaryCancellation = async (
	subscription: Subscription,
	userEmail: string | null,
	send?: MailSender,
): Promise<void> => {
	if (!send && !isMailConfigured()) {
		return;
	}
	const text = [
		'Eine außerordentliche Kündigung ist eingegangen und braucht eine Prüfung (vorzeitiges Ende oder Erstattung von Hand).',
		'',
		`Nutzer: ${userEmail ?? `#${String(subscription.get('userId'))}`}`,
		`Vertrag: ${contractLabel(subscription)}`,
		`Grund: ${String(subscription.get('cancellationReason'))}`,
		`Bestätigung an: ${String(subscription.get('cancellationEmail'))}`,
		`Vertragsende: ${formatDate(subscription.get('currentPeriodEnd') as Date)}`,
	].join('\n');
	for (const email of adminEmails()) {
		await sendMailToUser({ email }, { subject: 'Balamentum: Außerordentliche Kündigung', text }, send);
	}
};
