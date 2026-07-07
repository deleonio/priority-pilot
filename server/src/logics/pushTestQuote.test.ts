import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { QUOTES, pickRandomQuote } from './pushTestQuote.js';

/**
 * ROTE Spec-Tests für #386 „Push-Test-Button mit rotierenden Zitaten" — AK3 (zufällige Auswahl aus
 * genau 10 fixen Zitaten). Diese Tests sind rot, solange `logics/pushTestQuote.ts` (`QUOTES`,
 * `pickRandomQuote`) noch nicht existiert.
 *
 * Die Auswahl ist über einen injizierbaren `rand` deterministisch prüfbar (Vorbild: injizierte Sender
 * in `logics/push.test.ts`). Erwartet wird die kanonische Index-Abbildung `floor(rand() · length)`.
 */
describe('logics/pushTestQuote — Zitat-Auswahl (#386, AK3)', () => {
	it('enthält genau 10 Zitate', () => {
		assert.equal(QUOTES.length, 10);
	});

	it('jedes Zitat hat einen nicht-leeren text und author', () => {
		for (const quote of QUOTES) {
			assert.equal(typeof quote.text, 'string');
			assert.ok(quote.text.trim().length > 0, `text darf nicht leer sein: ${JSON.stringify(quote)}`);
			assert.equal(typeof quote.author, 'string');
			assert.ok(quote.author.trim().length > 0, `author darf nicht leer sein: ${JSON.stringify(quote)}`);
		}
	});

	it('alle Zitat-Texte sind eindeutig (keine Duplikate)', () => {
		const texts = new Set(QUOTES.map((quote) => quote.text));
		assert.equal(texts.size, QUOTES.length, 'jeder Zitat-Text kommt genau einmal vor');
	});

	it('rand=0 liefert das erste Zitat (Mark Twain)', () => {
		const quote = pickRandomQuote(() => 0);
		assert.deepEqual(quote, QUOTES[0]);
		assert.equal(quote.author, 'Mark Twain');
		assert.ok(quote.text.includes('Gib jedem Tag die Chance, der schönste deines Lebens zu werden'));
	});

	it('rand≈1 (0.999) liefert das zehnte Zitat (Ralph Waldo Emerson)', () => {
		const quote = pickRandomQuote(() => 0.999);
		assert.deepEqual(quote, QUOTES[9]);
		assert.equal(quote.author, 'Ralph Waldo Emerson');
		assert.ok(
			quote.text.includes(
				'Was vor uns liegt und was hinter uns liegt, sind Kleinigkeiten im Vergleich zu dem, was in uns liegt',
			),
		);
	});

	it('bildet rand deterministisch auf den Index floor(rand · 10) ab', () => {
		for (let i = 0; i < 10; i++) {
			const quote = pickRandomQuote(() => i / 10);
			assert.deepEqual(quote, QUOTES[i], `rand=${i}/10 muss QUOTES[${i}] liefern`);
		}
	});

	it('liefert auch ohne injizierten rand stets ein Element aus QUOTES', () => {
		for (let n = 0; n < 50; n++) {
			const picked = pickRandomQuote();
			assert.ok(
				QUOTES.some((quote) => quote.text === picked.text && quote.author === picked.author),
				`Ergebnis muss aus QUOTES stammen: ${JSON.stringify(picked)}`,
			);
		}
	});
});
