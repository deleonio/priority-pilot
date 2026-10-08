/**
 * Kündigung ohne Login (#2317): Texte und Client-Skripte für Formular und Bestätigungsseite, Deutsch
 * unter `/kuendigen/`, Englisch unter `/en/cancel/`. Die API liegt hinter `/api/v1` (Proxy streift
 * das Präfix ab).
 */
const API = '/api/v1/public/cancellation';

export interface CancellationText {
	title: string;
	description: string;
	lead: string;
	email: string;
	contract: string;
	periods: { monthly: string; quarterly: string; yearly: string };
	kind: string;
	ordinary: string;
	extraordinary: string;
	reason: string;
	when: string;
	next: string;
	onDate: string;
	date: string;
	submit: string;
	confirmTitle: string;
	confirmDescription: string;
	confirmButton: string;
	invalid: string;
	renew: string;
	/** Nutzersichtbare Texte der Client-Skripte. */
	script: {
		sent: string;
		throttled: string;
		failed: string;
		offline: string;
		summary: { contract: string; kind: string; effective: string };
		confirming: string;
		confirmed: string;
	};
}

export const CANCELLATION: Record<'de' | 'en', CancellationText> = {
	de: {
		title: 'Vertrag kündigen',
		description: 'Kündige dein Balamentum-Abo ohne Anmeldung: Formular ausfüllen und per E-Mail-Link bestätigen.',
		lead: 'Ohne Anmeldung: Wir schicken dir einen Bestätigungslink an die Adresse deines Kontos.',
		email: 'E-Mail-Adresse deines Kontos (Pflichtfeld)',
		contract: 'Vertrag (Pflichtfeld)',
		periods: { monthly: 'monatlich', quarterly: 'vierteljährlich', yearly: 'jährlich' },
		kind: 'Art der Kündigung',
		ordinary: 'Ordentlich',
		extraordinary: 'Außerordentlich',
		reason: 'Grund der außerordentlichen Kündigung (Pflichtfeld)',
		when: 'Zeitpunkt',
		next: 'Zum nächstmöglichen Zeitpunkt',
		onDate: 'Zum Wunschdatum',
		date: 'Wunschdatum',
		submit: 'Jetzt kündigen',
		confirmTitle: 'Kündigung bestätigen',
		confirmDescription: 'Bestätige die Kündigung deines Balamentum-Abos.',
		confirmButton: 'Kündigung jetzt bestätigen',
		invalid: 'Link ungültig oder abgelaufen.',
		renew: 'Kündigung neu anfordern',
		script: {
			sent: 'Wenn zu dieser Adresse ein kündbares Abo besteht, haben wir dir eine E-Mail mit Bestätigungslink geschickt.',
			throttled: 'Zu viele Anfragen in kurzer Zeit. Bitte später erneut versuchen.',
			failed: 'Das hat nicht geklappt. Bitte prüfe deine Angaben und versuche es erneut.',
			offline: 'Keine Verbindung. Bitte erneut versuchen.',
			summary: { contract: 'Vertrag', kind: 'Art', effective: 'Zeitpunkt' },
			confirming: 'Wird gekündigt …',
			confirmed:
				'Deine Kündigung ist bestätigt. Du bekommst eine Bestätigung per E-Mail; dein Paket bleibt bis zum Vertragsende aktiv.',
		},
	},
	en: {
		title: 'Cancel contract',
		description: 'Cancel your Balamentum subscription without signing in: fill in the form and confirm via email link.',
		lead: 'No sign-in needed: we send a confirmation link to the email address of your account.',
		email: 'Email address of your account (required)',
		contract: 'Contract (required)',
		periods: { monthly: 'monthly', quarterly: 'quarterly', yearly: 'yearly' },
		kind: 'Type of cancellation',
		ordinary: 'Ordinary',
		extraordinary: 'Extraordinary',
		reason: 'Reason for the extraordinary cancellation (required)',
		when: 'Effective date',
		next: 'At the earliest possible date',
		onDate: 'On a date of my choice',
		date: 'Preferred date',
		submit: 'Cancel now',
		confirmTitle: 'Confirm cancellation',
		confirmDescription: 'Confirm the cancellation of your Balamentum subscription.',
		confirmButton: 'Confirm cancellation now',
		invalid: 'Link invalid or expired.',
		renew: 'Request cancellation again',
		script: {
			sent: 'If there is a cancellable subscription for this address, we have sent you an email with a confirmation link.',
			throttled: 'Too many requests in a short time. Please try again later.',
			failed: 'That did not work. Please check your details and try again.',
			offline: 'No connection. Please try again.',
			summary: { contract: 'Contract', kind: 'Type', effective: 'Effective' },
			confirming: 'Cancelling …',
			confirmed:
				'Your cancellation is confirmed. You will receive a confirmation by email; your plan stays active until the end of the contract.',
		},
	},
};

/** Skript des Formulars; `texts` landen als JSON-Literal im Skript. */
export const requestScript = (texts: CancellationText['script']): string => `(function () {
	var T = ${JSON.stringify(texts)};
	// Server-Texte (Mail, Zusammenfassung) in der Seitensprache statt der Browser-Sprache.
	var LANG = document.documentElement.lang === 'en' ? 'en' : 'de';
	var form = document.querySelector('[data-cancel-form]');
	var reason = form.querySelector('[data-reason]');
	var reasonInput = reason.querySelector('textarea');
	var date = form.querySelector('input[type="date"]');
	var status = document.querySelector('[data-status]');
	var error = document.querySelector('[data-error]');
	var button = form.querySelector('button[type="submit"]');
	date.min = new Date().toISOString().slice(0, 10);
	form.addEventListener('change', function () {
		var extraordinary = form.elements.kind.value === 'extraordinary';
		reason.hidden = !extraordinary;
		reasonInput.required = extraordinary;
		date.required = form.elements.when.value === 'date';
	});
	form.addEventListener('submit', function (event) {
		event.preventDefault();
		error.textContent = '';
		button.disabled = true;
		var extraordinary = form.elements.kind.value === 'extraordinary';
		fetch('${API}/request', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Accept-Language': LANG },
			body: JSON.stringify({
				email: form.elements.email.value,
				contract: form.elements.contract.value,
				kind: form.elements.kind.value,
				reason: extraordinary ? reasonInput.value : undefined,
				effective: form.elements.when.value === 'date' ? date.value : undefined,
			}),
		})
			.then(function (response) {
				if (response.status === 202) {
					form.hidden = true;
					status.textContent = T.sent;
					return;
				}
				error.textContent = response.status === 429 ? T.throttled : T.failed;
				button.disabled = false;
			})
			.catch(function () {
				error.textContent = T.offline;
				button.disabled = false;
			});
	});
})();`;

/** Skript der Bestätigungsseite des Mail-Links. */
export const confirmScript = (texts: CancellationText['script']): string => `(function () {
	var T = ${JSON.stringify(texts)};
	// Server-Texte (Mail, Zusammenfassung) in der Seitensprache statt der Browser-Sprache.
	var LANG = document.documentElement.lang === 'en' ? 'en' : 'de';
	var token = new URLSearchParams(location.search).get('token') || '';
	var summary = document.querySelector('[data-summary]');
	var button = document.querySelector('[data-confirm]');
	var status = document.querySelector('[data-status]');
	var invalid = document.querySelector('[data-invalid]');
	document.querySelector('h1').focus();
	var fail = function () {
		summary.hidden = true;
		button.hidden = true;
		invalid.hidden = false;
	};
	fetch('${API}/confirm?token=' + encodeURIComponent(token), { headers: { 'Accept-Language': LANG } })
		.then(function (response) {
			if (!response.ok) return fail();
			return response.json().then(function (data) {
				summary.textContent = T.summary.contract + ': ' + data.contract + ' · ' + T.summary.kind + ': ' + data.kind + ' · ' + T.summary.effective + ': ' + data.effective;
				button.hidden = false;
			});
		})
		.catch(fail);
	button.addEventListener('click', function () {
		button.disabled = true;
		button.querySelector('.kern-label').textContent = T.confirming;
		fetch('${API}/confirm', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Accept-Language': LANG },
			body: JSON.stringify({ token: token }),
		})
			.then(function (response) {
				if (!response.ok) return fail();
				button.hidden = true;
				status.textContent = T.confirmed;
			})
			.catch(fail);
	});
})();`;
