/**
 * Client-Skripte der Kündigung ohne Login (#2317): Formular `/kuendigen/` und Bestätigungsseite
 * `/kuendigen/bestaetigen/`. Die API liegt hinter `/api/v1` (Proxy streift das Präfix ab).
 */
const API = '/api/v1/public/cancellation';
const THROTTLED = 'Zu viele Anfragen in kurzer Zeit. Bitte später erneut versuchen.';

export const REQUEST_SCRIPT = `(function () {
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
			headers: { 'Content-Type': 'application/json' },
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
					status.textContent = 'Wenn zu dieser Adresse ein kündbares Abo besteht, haben wir dir eine E-Mail mit Bestätigungslink geschickt.';
					return;
				}
				error.textContent = response.status === 429 ? '${THROTTLED}' : 'Das hat nicht geklappt. Bitte prüfe deine Angaben und versuche es erneut.';
				button.disabled = false;
			})
			.catch(function () {
				error.textContent = 'Keine Verbindung. Bitte erneut versuchen.';
				button.disabled = false;
			});
	});
})();`;

export const CONFIRM_SCRIPT = `(function () {
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
	fetch('${API}/confirm?token=' + encodeURIComponent(token))
		.then(function (response) {
			if (!response.ok) return fail();
			return response.json().then(function (data) {
				summary.textContent = 'Vertrag: ' + data.contract + ' · Art: ' + data.kind + ' · Zeitpunkt: ' + data.effective;
				button.hidden = false;
			});
		})
		.catch(fail);
	button.addEventListener('click', function () {
		button.disabled = true;
		button.querySelector('.kern-label').textContent = 'Wird gekündigt …';
		fetch('${API}/confirm', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ token: token }),
		})
			.then(function (response) {
				if (!response.ok) return fail();
				button.hidden = true;
				status.textContent = 'Deine Kündigung ist bestätigt. Du bekommst eine Bestätigung per E-Mail; dein Paket bleibt bis zum Vertragsende aktiv.';
			})
			.catch(fail);
	});
})();`;
