import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAdvisorUserMessage, type AdviseActivitiesInput } from './mistral.js';

/**
 * Vertrag für `buildAdvisorUserMessage(input)` in Bezug auf die Säulen-Verteilung (Nachfolge #337):
 * Enthält die Eingabe ein `distribution`-Array (`{ pillarId, weight, actualShare }[]`, so wie es der
 * Client aus dem Dashboard „Meine Themen" mitschickt), muss der erzeugte Prompt die Säulen absteigend
 * nach Unterversorgung (Soll − Ist) aufführen und das Modell anweisen, die Vorschläge primär auf die
 * schwächsten (am stärksten unterversorgten) Säulen auszurichten. Ohne `distribution` bleibt der
 * Prompt frei von einem solchen Hinweis (kein Rauschen).
 *
 * Die Tests fixieren nur die nachweisbare Durchreichung (Name/Reihenfolge der schwächsten Säule und
 * der Prioritäts-Hinweis), nicht den exakten Wortlaut.
 */
describe('buildAdvisorUserMessage — Säulen-Verteilung im Prompt', () => {
	const pillars = [
		{ id: 1, name: 'Körper', description: 'Physische Gesundheit: Bewegung, Ernährung, Schlaf, Vorsorge.' },
		{ id: 2, name: 'Beziehungen', description: 'Soziale Verbundenheit: Familie, Freunde, Partnerschaft.' },
		{ id: 3, name: 'Sinn', description: 'Das „Wofür": Werte, Lebensziele, Spiritualität, Ehrenamt.' },
	];

	it('priorisiert die Säulen absteigend nach Unterversorgung — unabhängig von der Eingabe-Reihenfolge', () => {
		const input: AdviseActivitiesInput = {
			// Eingabe-Reihenfolge bewusst NICHT gleich der Unterversorgungs-Reihenfolge, damit der Test
			// echtes Sortieren erzwingt (nicht nur Filtern): am stärksten unterversorgt (Beziehungen)
			// steht in der Eingabe zuletzt, am schwächsten unterversorgt (Sinn) in der Mitte.
			pillars,
			distribution: [
				{ pillarId: 1, weight: 20, actualShare: 0.1 }, // Körper: Soll 0.2, Ist 0.1 → Unterversorgung 50 %
				{ pillarId: 3, weight: 20, actualShare: 0.15 }, // Sinn:   Soll 0.2, Ist 0.15 → Unterversorgung 25 %
				{ pillarId: 2, weight: 20, actualShare: 0.0 }, // Beziehungen: Soll 0.2, Ist 0 → Unterversorgung 100 %
			],
		};

		const message = buildAdvisorUserMessage(input);

		// Der Prompt weist das Modell erkennbar an, die schwächsten Säulen zu priorisieren.
		assert.match(message, /Priorität/i, 'Der Prompt enthält einen Prioritäts-Hinweis');
		assert.match(message, /schwächste/i, 'Der Prompt spricht die schwächsten Säulen an');

		// In der Prioritäts-Zeile müssen die Säulen nach Unterversorgung absteigend stehen:
		// Beziehungen (100 %) → Körper (50 %) → Sinn (25 %). Diese Reihenfolge weicht bewusst von der
		// Eingabe-Reihenfolge (Körper, Sinn, Beziehungen) ab — der Test wird also ROT, sobald die
		// Sortierung fehlt (Negativ-Kontrolle: ohne `.sort` stünde Beziehungen zuletzt).
		const priorityLine = message.split('\n').find((line) => /Priorität/i.test(line)) ?? '';
		const iBeziehungen = priorityLine.indexOf('Beziehungen');
		const iKoerper = priorityLine.indexOf('Körper');
		const iSinn = priorityLine.indexOf('Sinn');
		assert.ok(
			iBeziehungen !== -1 && iKoerper !== -1 && iSinn !== -1,
			'Die Prioritäts-Zeile nennt alle drei unterversorgten Säulen',
		);
		assert.ok(
			iBeziehungen < iKoerper && iKoerper < iSinn,
			`Prioritäts-Reihenfolge muss nach Unterversorgung absteigend sein (Beziehungen < Körper < Sinn), war: "${priorityLine}"`,
		);
	});

	it('ohne distribution-Feld erscheint kein Prioritäts-/Unterversorgungs-Hinweis im Prompt', () => {
		const message = buildAdvisorUserMessage({ pillars });
		assert.doesNotMatch(message, /Unterversorgung/i, 'ohne Verteilung bleibt der Prompt frei vom Hinweis');
		assert.doesNotMatch(message, /Priorität/i, 'ohne Verteilung nennt der Prompt keine Priorität');
	});
});
