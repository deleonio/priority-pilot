import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// ROTER Spec-Test (#328 / AK2 — Durchreichung/Vertrag): Der Advisor-Prompt soll die serverseitig
// berechneten Aufmerksamkeits-Daten je Säule mitführen. Dafür bekommt `AdviseActivitiesInput` ein
// optionales `attention`-Feld und `buildAdvisorUserMessage` reicht es in den Prompt durch.
//
// ROT, weil `buildAdvisorUserMessage` noch nicht exportiert ist und `AdviseActivitiesInput` das Feld
// `attention` noch nicht kennt. KEIN Produktivcode.
import { buildAdvisorUserMessage, type AdviseActivitiesInput } from './mistral.js';

/**
 * Vertrag für `buildAdvisorUserMessage(input)` in Bezug auf die Aufmerksamkeits-Durchreichung (#328):
 * Enthält die Eingabe ein `attention`-Array (`{ pillarId, score }[]`), muss der erzeugte Prompt-
 * String die betroffenen Säulen als „vernachlässigt" (bzw. mit ihrem Attention-Signal) ausweisen, so
 * dass das Modell die Vorschläge zugunsten der vernachlässigten Säulen gewichtet. Ohne `attention`
 * bleibt der Prompt frei von einem solchen Hinweis (kein Rauschen).
 *
 * Die Tests fixieren nur die nachweisbare Durchreichung (der Säulen-Name der als am stärksten
 * vernachlässigt markierten Säule taucht im Attention-Kontext auf), nicht den exakten Wortlaut.
 */
describe('buildAdvisorUserMessage — Aufmerksamkeits-Daten im Prompt (#328)', () => {
	const pillars = [
		{ id: 1, name: 'Körper', description: 'Physische Gesundheit: Bewegung, Ernährung, Schlaf, Vorsorge.' },
		{ id: 2, name: 'Beziehungen', description: 'Soziale Verbundenheit: Familie, Freunde, Partnerschaft.' },
		{ id: 3, name: 'Sinn', description: 'Das „Wofür": Werte, Lebensziele, Spiritualität, Ehrenamt.' },
	];

	it('führt die vernachlässigte Säule (höchster Attention-Score) im Prompt-Text auf', () => {
		const input: AdviseActivitiesInput = {
			pillars,
			// Säule 2 (Beziehungen) hat den höchsten Score → am stärksten vernachlässigt.
			attention: [
				{ pillarId: 1, score: 0.1 },
				{ pillarId: 2, score: 0.9 },
				{ pillarId: 3, score: 0.2 },
			],
		};

		const message = buildAdvisorUserMessage(input);

		// Die am stärksten vernachlässigte Säule wird im Prompt namentlich als Aufmerksamkeits-Signal
		// geführt, damit das Modell die Vorschläge auf sie hin gewichtet.
		assert.match(message, /Beziehungen/, 'Der Prompt nennt die am stärksten vernachlässigte Säule (Beziehungen)');
		// Und weist sie erkennbar als vernachlässigt aus (Wortstamm „vernachlässig", tolerant gegen Formulierung).
		assert.match(message, /vernachlässig/i, 'Der Prompt markiert die Säule als vernachlässigt');
	});

	it('ohne attention-Feld erscheint kein Vernachlässigungs-Hinweis im Prompt', () => {
		const message = buildAdvisorUserMessage({ pillars });
		assert.doesNotMatch(message, /vernachlässig/i, 'ohne attention-Daten bleibt der Prompt frei vom Hinweis');
	});
});
