/**
 * Feste Sammlung von Lebensweisheiten für den „Push testen"-Button (#386, AK3). Aus dieser Liste
 * wählt {@link pickRandomQuote} zufällig ein Zitat, das als Test-Push verschickt wird. Die Auswahl
 * ist über einen injizierbaren `rand` deterministisch prüfbar (Vorbild: injizierte Sender in
 * `logics/push.ts`).
 */
interface Quote {
	text: string;
	author: string;
}

export const QUOTES: Quote[] = [
	{ text: 'Gib jedem Tag die Chance, der schönste deines Lebens zu werden.', author: 'Mark Twain' },
	{
		text: 'Man sieht nur mit dem Herzen gut. Das Wesentliche ist für die Augen unsichtbar.',
		author: 'Antoine de Saint-Exupéry',
	},
	{
		text: 'Es ist nicht zu wenig Zeit, die wir haben, sondern es ist zu viel Zeit, die wir nicht nutzen.',
		author: 'Lucius Annaeus Seneca',
	},
	{ text: 'Sei du selbst die Veränderung, die du dir wünschst für diese Welt.', author: 'Mahatma Gandhi' },
	{ text: 'Leben ist das, was passiert, während du eifrig dabei bist, andere Pläne zu machen.', author: 'John Lennon' },
	{ text: 'Wege entstehen dadurch, dass man sie geht.', author: 'Franz Kafka' },
	{ text: 'Die Zukunft gehört denen, die an die Schönheit ihrer Träume glauben.', author: 'Eleanor Roosevelt' },
	{
		text: 'Das Leben kann nur in der Schau nach rückwärts verstanden, aber nur in der Schau nach vorwärts gelebt werden.',
		author: 'Søren Kierkegaard',
	},
	{
		text: 'Verweile nicht in der Vergangenheit, träume nicht von der Zukunft. Konzentriere dich auf den gegenwärtigen Moment.',
		author: 'Buddha',
	},
	{
		text: 'Was vor uns liegt und was hinter uns liegt, sind Kleinigkeiten im Vergleich zu dem, was in uns liegt.',
		author: 'Ralph Waldo Emerson',
	},
];

/**
 * Wählt zufällig ein Zitat aus {@link QUOTES}. Die kanonische Index-Abbildung ist `floor(rand · length)`;
 * `rand` ist injizierbar (Default: `Math.random`), damit die Auswahl in Tests deterministisch prüfbar ist.
 */
export const pickRandomQuote = (rand: () => number = Math.random): Quote => QUOTES[Math.floor(rand() * QUOTES.length)];
