/**
 * Balance-Check (#1979): fünf Fragen (je Standard-Säule), Auswertung im Browser, Ergebnis nur in der URL
 * (`?a=<fünf Ziffern>`). Vertrag: `docs/spec/issue-1979.md`. Deutsch unter `/balance-check/`, Englisch
 * unter `/en/balance-check/`, kein Speichern.
 */
import { SEED_PILLARS } from '../../server/src/models/pillarData.ts';

export interface AssessmentText {
	title: string;
	description: string;
	lead: string;
	/** Säulennamen je `SEED_PILLARS`-Schlüssel; Deutsch nimmt die Namen aus `SEED_PILLARS`. */
	pillars?: Record<string, string>;
	/** Skalenstufen 0-4 je Frage. */
	scale: readonly string[];
	/** Fragetexte in `SEED_PILLARS`-Reihenfolge (Fürsorge-Ton, `docs/fuersorge-tonalitaet.md`). */
	questions: readonly string[];
	result: string;
	start: string;
	share: string;
	note: string;
	/** Nutzersichtbare Texte des Client-Skripts; `{done}`, `{total}`, `{names}`, `{share}` setzt das Skript ein. */
	script: {
		progress: string;
		empty: string;
		summary: string;
		and: string;
		shareTitle: string;
		copied: string;
	};
}

export const ASSESSMENT: Record<'de' | 'en', AssessmentText> = {
	de: {
		title: 'Balance-Check',
		description: 'Fünf Fragen ohne Konto: eine erste Einordnung, wohin deine Aufmerksamkeit zuletzt geflossen ist.',
		lead: 'Fünf Fragen, keine Anmeldung. Denk an die letzten Wochen und antworte aus dem Bauch.',
		scale: ['gar nicht', 'wenig', 'mittel', 'viel', 'sehr viel'],
		questions: [
			'Wie viel Aufmerksamkeit hat dein Körper bekommen – Schlaf, Bewegung, Erholung?',
			'Wie viel Raum hattest du für innere Ruhe und Pausen?',
			'Wie viel Zeit und Wärme ist in Menschen geflossen, die dir wichtig sind?',
			'Wie viel hast du von dem auf den Weg gebracht, was dir wichtig ist?',
			'Wie viel Raum hatte die Frage, was dir gerade Halt und Richtung gibt?',
		],
		result: 'Dein Ergebnis',
		start: 'Kostenlos starten',
		share: 'Ergebnis teilen',
		note: 'Wird nirgends gespeichert. Der Link enthält deine Antworten – teile ihn nur, wenn du magst.',
		script: {
			progress: '{done} von {total} beantwortet',
			empty:
				'Gerade scheint wenig Aufmerksamkeit übrig zu sein – das ist in Ordnung. Ein kleiner Schritt reicht für den Anfang.',
			summary:
				'Deine Aufmerksamkeit lag zuletzt vor allem bei {names} ({share} %). Das ist eine Momentaufnahme, kein Urteil.',
			and: ' und ',
			shareTitle: 'Mein Balance-Check',
			copied: 'Link kopiert',
		},
	},
	en: {
		title: 'Balance check',
		description: 'Five questions, no account: a first sense of where your attention has been going lately.',
		lead: 'Five questions, no sign-in. Think of the last few weeks and answer from the gut.',
		pillars: {
			koerper: 'Body',
			mental: 'Mental health',
			beziehungen: 'Relationships',
			wirksamkeit: 'Impact',
			sinn: 'Meaning',
		},
		scale: ['not at all', 'a little', 'some', 'a lot', 'very much'],
		questions: [
			'How much attention did your body get – sleep, exercise, rest?',
			'How much room did you have for inner calm and breaks?',
			'How much time and warmth went into people who matter to you?',
			'How much of what matters to you did you get going?',
			'How much room was there for what gives you support and direction right now?',
		],
		result: 'Your result',
		start: 'Start for free',
		share: 'Share result',
		note: 'Not stored anywhere. The link contains your answers – only share it if you want to.',
		script: {
			progress: '{done} of {total} answered',
			empty:
				'There seems to be little attention to spare right now – that is okay. A small step is enough to begin with.',
			summary: 'Lately your attention went mostly to {names} ({share} %). This is a snapshot, not a judgement.',
			and: ' and ',
			shareTitle: 'My balance check',
			copied: 'Link copied',
		},
	},
};

/** Säulennamen einer Sprache in `SEED_PILLARS`-Reihenfolge. */
export const pillarNames = (text: AssessmentText): string[] =>
	SEED_PILLARS.map((pillar) => text.pillars?.[pillar.key] ?? pillar.name);

const COUNT = SEED_PILLARS.length;
const ANSWER_PATTERN = new RegExp(`^[0-4]{${COUNT}}$`);

/** Anteile je Säule in ganzen Prozent (Summe 100, Largest-Remainder) und Index des höchsten Werts. */
export const evaluateAssessment = (answers: readonly number[]): { shares: number[]; focus: number | null } => {
	const total = answers.reduce((sum, value) => sum + value, 0);
	if (total === 0) return { shares: answers.map(() => 0), focus: null };
	const raw = answers.map((value) => (value * 100) / total);
	const shares = raw.map(Math.floor);
	const remainder = 100 - shares.reduce((sum, share) => sum + share, 0);
	raw
		.map((value, index) => ({ index, fraction: value - shares[index] }))
		.sort((a, b) => b.fraction - a.fraction || a.index - b.index)
		.slice(0, remainder)
		.forEach(({ index }) => shares[index]++);
	return { shares, focus: answers.indexOf(Math.max(...answers)) };
};

export const encodeAnswers = (answers: readonly number[]): string => answers.join('');

export const decodeAnswers = (raw: string | null): number[] | null =>
	raw !== null && ANSWER_PATTERN.test(raw) ? [...raw].map(Number) : null;

/**
 * Browser-Skript der Seite (Spiegel von {@link evaluateAssessment}, `website/e2e/assessment.spec.ts` prüft
 * den Ablauf): zeigt das Ergebnis nach der fünften Antwort, schreibt `?a=` in die URL und teilt den Link.
 */
export const clientScript = (texts: AssessmentText['script']): string => `(function () {
	var T = ${JSON.stringify(texts)};
	var form = document.querySelector('[data-form]');
	var result = document.querySelector('[data-result]');
	var progress = document.querySelector('[data-progress]');
	var summary = document.querySelector('[data-summary]');
	var list = document.querySelector('[data-list]');
	var rows = result.querySelectorAll('[data-row]');
	var status = document.querySelector('[data-status]');
	var names = Array.prototype.map.call(rows, function (row) { return row.getAttribute('data-name'); });
	function answers() {
		return names.map(function (_, i) {
			var checked = form.querySelector('input[name=q' + i + ']:checked');
			return checked ? Number(checked.value) : null;
		});
	}
	function evaluate(values) {
		var total = values.reduce(function (sum, v) { return sum + v; }, 0);
		if (!total) return values.map(function () { return 0; });
		var raw = values.map(function (v) { return (v * 100) / total; });
		var shares = raw.map(Math.floor);
		var rest = 100 - shares.reduce(function (sum, s) { return sum + s; }, 0);
		raw.map(function (r, i) { return { i: i, f: r - shares[i] }; })
			.sort(function (a, b) { return b.f - a.f || a.i - b.i; })
			.slice(0, rest)
			.forEach(function (p) { shares[p.i]++; });
		return shares;
	}
	function show(values) {
		var shares = evaluate(values);
		var max = Math.max.apply(null, values);
		var top = names.filter(function (_, i) { return values[i] === max; });
		var empty = max === 0;
		list.hidden = empty;
		summary.textContent = empty
			? T.empty
			: T.summary.replace('{names}', top.length > 1 ? top.slice(0, -1).join(', ') + T.and + top[top.length - 1] : top[0]).replace('{share}', shares[values.indexOf(max)]);
		rows.forEach(function (row, i) {
			row.querySelector('[data-percent]').textContent = shares[i] + ' %';
			row.querySelector('[data-fill]').style.width = shares[i] + '%';
		});
		result.hidden = false;
	}
	function update(write) {
		var values = answers();
		var done = values.filter(function (v) { return v !== null; }).length;
		progress.textContent = T.progress.replace('{done}', done).replace('{total}', names.length);
		if (done < names.length) return;
		show(values);
		if (write) history.replaceState(null, '', '?a=' + values.join(''));
	}
	var initial = new URLSearchParams(location.search).get('a');
	if (initial && new RegExp('^[0-4]{' + names.length + '}$').test(initial)) {
		initial.split('').forEach(function (v, i) { form.querySelector('input[name=q' + i + '][value="' + v + '"]').checked = true; });
		update(false);
	}
	form.addEventListener('change', function () { update(true); });
	document.querySelector('[data-share]').addEventListener('click', function () {
		var url = location.href;
		status.textContent = '';
		if (navigator.share) {
			navigator.share({ title: T.shareTitle, url: url }).catch(function () {});
		} else if (navigator.clipboard) {
			navigator.clipboard.writeText(url).then(function () { status.textContent = T.copied; }, function () { status.textContent = url; });
		} else {
			status.textContent = url;
		}
	});
})();`;
