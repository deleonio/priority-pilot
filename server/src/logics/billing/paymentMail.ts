import type Subscription from '../../models/subscription.js';
import User from '../../models/user.js';
import { spracheVon, type CareSprache } from '../careSuggestionData.js';
import { isMailConfigured, sendMailToUser, type MailAttachment, type MailSender } from '../mail.js';
import { renderMailHtml } from '../mailTemplate.js';

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
	payload: (sprache: CareSprache) => { subject: string; text: string; html: string; attachments: MailAttachment[] },
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
		(sprache) => {
			const en = sprache === 'en';
			const subject = en ? 'Your payment did not go through' : 'Deine Zahlung hat nicht geklappt';
			const anrede = en ? 'Hello,' : 'Hallo,';
			const umstand = en
				? `unfortunately, the last payment for your subscription could not be collected. This happens quite often, for example with an expired card. Your plan remains unchanged until ${fristDatum(graceEnd, sprache)}.`
				: `die letzte Zahlung für dein Abo konnte leider nicht abgebucht werden. Das passiert öfter, etwa bei einer abgelaufenen Karte. Bis zum ${fristDatum(graceEnd, sprache)} bleibt dein Paket unverändert bestehen.`;
			const methode = en
				? `You can check or update your payment method at PayPal here: ${PAYPAL_PAYMENT_LINK}`
				: `Du kannst deine Zahlungsmethode hier bei PayPal prüfen oder aktualisieren: ${PAYPAL_PAYMENT_LINK}`;
			const trost = en
				? 'PayPal will then try again, you do not need to do anything else.'
				: 'Danach versucht PayPal es erneut, du musst nichts weiter tun.';
			const html = renderMailHtml({
				heading: subject,
				intro: anrede,
				paragraphs: [umstand, methode, trost],
				lang: sprache,
			});
			return {
				subject,
				text: [anrede, '', umstand, '', methode, '', trost].join('\n'),
				html: html.html,
				attachments: html.attachments,
			};
		},
		mailSend,
	);

/** Paketentzug nach Ablauf der Kulanzfrist: Abo beendet, jetzt Free. */
export const sendSubscriptionEndedMail = (subscription: Subscription, mailSend?: MailSender) =>
	deliver(
		subscription,
		(sprache) => {
			const en = sprache === 'en';
			const subject = en ? 'Your subscription has ended' : 'Dein Abo ist beendet';
			const anrede = en ? 'Hello,' : 'Hallo,';
			const befund = en
				? 'we could not collect the payment for your subscription, so it has ended and you are now on the Free plan. Your tasks and data are kept.'
				: 'wir konnten die Zahlung für dein Abo nicht abbuchen, deshalb ist es beendet und du nutzt jetzt das Free-Paket. Deine Aufgaben und Daten bleiben erhalten.';
			const perspektive = en
				? 'If you would like a paid plan again, you can take one out at any time in the settings.'
				: 'Wenn du wieder ein bezahltes Paket möchtest, kannst du es jederzeit in den Einstellungen neu abschließen.';
			const html = renderMailHtml({
				heading: subject,
				intro: anrede,
				paragraphs: [befund, perspektive],
				lang: sprache,
			});
			return {
				subject,
				text: [anrede, '', befund, '', perspektive].join('\n'),
				html: html.html,
				attachments: html.attachments,
			};
		},
		mailSend,
	);
