import type Subscription from '../models/subscription.js';
import User from '../models/user.js';
import { adminEmails } from './adminEmails.js';
import { spracheVon, type CareSprache } from './careSuggestionData.js';
import { displayLabel } from './invoices.js';
import { isMailConfigured, sendMailToUser, type MailSender } from './mail.js';
import type { Plan } from './plans.js';

/**
 * Mails zur Kündigung (#2308, § 312k BGB): die Bestätigung an den Kunden geht allein aus dem
 * CANCELLED-Webhook (`applyPlanChange`), die Betreiber-Meldung einer außerordentlichen Kündigung
 * aus der Cancel-Route. Ohne SMTP und ohne injizierten `send` entfällt der Versand (Muster
 * `dueTaskReminders.ts`); Transportfehler schluckt `sendMailToUser`.
 */

const formatDate = (date: Date, sprache: CareSprache = 'de'): string =>
	date.toLocaleDateString(sprache === 'en' ? 'en-GB' : 'de-DE');

const contractLabel = (subscription: Subscription, sprache: CareSprache = 'de'): string =>
	displayLabel(subscription.get('plan') as Plan, String(subscription.get('period')), sprache);

/** Kündigungsbestätigung je App-Sprache des Kontos (`users.sprache`). */
const BESTAETIGUNG: Record<
	CareSprache,
	{
		subject: string;
		einleitung: string;
		vertrag: string;
		art: string;
		grund: string;
		eingang: string;
		ende: string;
		schluss: string;
		ordentlich: string;
		ausserordentlich: string;
		anrede: string;
	}
> = {
	de: {
		subject: 'Balamentum: Bestätigung deiner Kündigung',
		anrede: 'Hallo,',
		einleitung: 'wir bestätigen die Kündigung deines Abos.',
		vertrag: 'Vertrag',
		art: 'Art der Kündigung',
		ordentlich: 'ordentlich',
		ausserordentlich: 'außerordentlich',
		grund: 'Grund',
		eingang: 'Kündigung eingegangen am',
		ende: 'Vertragsende',
		schluss: 'Bis zum Vertragsende bleibt dein Paket aktiv, danach nutzt du Balamentum im Free-Paket weiter.',
	},
	en: {
		subject: 'Balamentum: Confirmation of your cancellation',
		anrede: 'Hello,',
		einleitung: 'we confirm the cancellation of your subscription.',
		vertrag: 'Contract',
		art: 'Type of cancellation',
		ordentlich: 'ordinary',
		ausserordentlich: 'extraordinary',
		grund: 'Reason',
		eingang: 'Cancellation received on',
		ende: 'End of contract',
		schluss:
			'Your plan stays active until the end of the contract; after that you continue to use Balamentum on the Free plan.',
	},
};

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
	const user = await User.findByPk(subscription.get('userId') as number);
	const email = (subscription.get('cancellationEmail') as string | null) ?? user?.email ?? null;
	const sprache = spracheVon(user?.sprache);
	const t = BESTAETIGUNG[sprache];
	await sendMailToUser(
		{ email },
		{
			subject: t.subject,
			text: [
				t.anrede,
				'',
				t.einleitung,
				'',
				`${t.vertrag}: ${contractLabel(subscription, sprache)}`,
				`${t.art}: ${extraordinary ? t.ausserordentlich : t.ordentlich}`,
				...(extraordinary ? [`${t.grund}: ${String(subscription.get('cancellationReason'))}`] : []),
				`${t.eingang}: ${formatDate(requestedAt, sprache)}`,
				`${t.ende}: ${formatDate(subscription.get('currentPeriodEnd') as Date, sprache)}`,
				'',
				t.schluss,
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
