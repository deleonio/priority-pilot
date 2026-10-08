import type Subscription from '../../models/subscription.js';
import User from '../../models/user.js';
import { spracheVon, type CareSprache } from '../careSuggestionData.js';
import { isMailConfigured, sendMailToUser, type MailSender } from '../mail.js';

/**
 * Mails zum Abo-Lebenszyklus (#2306), Ton nach `docs/fuersorge-tonalitaet.md`: warm, ohne Schuldzuweisung,
 * mit dem nächsten Schritt. Der Versand ist best effort — {@link sendMailToUser} wirft nie, ein Mailfehler
 * ändert den Abo-Zustand nicht. Ohne injizierten Versand und ohne SMTP-Konfiguration entfällt die Mail.
 */

/** Verwaltung der Zahlungsmethode bei PayPal. */
const PAYPAL_PAYMENT_LINK = 'https://www.paypal.com/myaccount/autopay/';

/** Versand in der App-Sprache des Kontos (`users.sprache`). */
const deliver = async (
	subscription: Subscription,
	payload: (sprache: CareSprache) => { subject: string; text: string },
	mailSend?: MailSender,
): Promise<void> => {
	if (!mailSend && !isMailConfigured()) {
		return;
	}
	const user = await User.findByPk(subscription.get('userId') as number);
	if (user) {
		await sendMailToUser(user, payload(spracheVon(user.sprache)), mailSend);
	}
};

const fristDatum = (date: Date, sprache: CareSprache): string =>
	date.toLocaleDateString(sprache === 'en' ? 'en-GB' : 'de-DE', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		timeZone: 'Europe/Berlin',
	});

/** Erster Zahlungsausfall: Fristende und Link zur Zahlungsmethode bei PayPal. */
export const sendPaymentFailedMail = (subscription: Subscription, graceEnd: Date, mailSend?: MailSender) =>
	deliver(
		subscription,
		(sprache) =>
			sprache === 'en'
				? {
						subject: 'Your payment did not go through',
						text: [
							'Hello,',
							'',
							`unfortunately, the last payment for your subscription could not be collected. This happens quite often, for example with an expired card. Your plan remains unchanged until ${fristDatum(graceEnd, sprache)}.`,
							'',
							`You can check or update your payment method at PayPal here: ${PAYPAL_PAYMENT_LINK}`,
							'',
							'PayPal will then try again, you do not need to do anything else.',
						].join('\n'),
					}
				: {
						subject: 'Deine Zahlung hat nicht geklappt',
						text: [
							'Hallo,',
							'',
							`die letzte Zahlung für dein Abo konnte leider nicht abgebucht werden. Das passiert öfter, etwa bei einer abgelaufenen Karte. Bis zum ${fristDatum(graceEnd, sprache)} bleibt dein Paket unverändert bestehen.`,
							'',
							`Du kannst deine Zahlungsmethode hier bei PayPal prüfen oder aktualisieren: ${PAYPAL_PAYMENT_LINK}`,
							'',
							'Danach versucht PayPal es erneut, du musst nichts weiter tun.',
						].join('\n'),
					},
		mailSend,
	);

/** Paketentzug nach Ablauf der Kulanzfrist: Abo beendet, jetzt Free. */
export const sendSubscriptionEndedMail = (subscription: Subscription, mailSend?: MailSender) =>
	deliver(
		subscription,
		(sprache) =>
			sprache === 'en'
				? {
						subject: 'Your subscription has ended',
						text: [
							'Hello,',
							'',
							'we could not collect the payment for your subscription, so it has ended and you are now on the Free plan. Your tasks and data are kept.',
							'',
							'If you would like a paid plan again, you can take one out at any time in the settings.',
						].join('\n'),
					}
				: {
						subject: 'Dein Abo ist beendet',
						text: [
							'Hallo,',
							'',
							'wir konnten die Zahlung für dein Abo nicht abbuchen, deshalb ist es beendet und du nutzt jetzt das Free-Paket. Deine Aufgaben und Daten bleiben erhalten.',
							'',
							'Wenn du wieder ein bezahltes Paket möchtest, kannst du es jederzeit in den Einstellungen neu abschließen.',
						].join('\n'),
					},
		mailSend,
	);
