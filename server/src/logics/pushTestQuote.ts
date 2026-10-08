/**
 * Feste Sammlung von Lebensweisheiten für den „Push testen"-Button (#386, AK3). Aus dieser Liste
 * wählt {@link pickRandomQuote} zufällig ein Zitat, das als Test-Push verschickt wird. Die Auswahl
 * ist über einen injizierbaren `rand` deterministisch prüfbar (Vorbild: injizierte Sender in
 * `logics/push.ts`).
 */
interface Quote {
	text: string;
	/** Englische Fassung für App-Sprache `en`. */
	en: string;
	author: string;
}

export const QUOTES: Quote[] = [
	{
		text: 'Gib jedem Tag die Chance, der schönste deines Lebens zu werden.',
		en: 'Give every day the chance to become the most beautiful day of your life.',
		author: 'Mark Twain',
	},
	{
		text: 'Man sieht nur mit dem Herzen gut. Das Wesentliche ist für die Augen unsichtbar.',
		en: 'One sees clearly only with the heart. What is essential is invisible to the eye.',
		author: 'Antoine de Saint-Exupéry',
	},
	{
		text: 'Es ist nicht zu wenig Zeit, die wir haben, sondern es ist zu viel Zeit, die wir nicht nutzen.',
		en: 'It is not that we have too little time, but that we waste a lot of it.',
		author: 'Lucius Annaeus Seneca',
	},
	{
		text: 'Sei du selbst die Veränderung, die du dir wünschst für diese Welt.',
		en: 'Be the change that you wish to see in the world.',
		author: 'Mahatma Gandhi',
	},
	{
		text: 'Leben ist das, was passiert, während du eifrig dabei bist, andere Pläne zu machen.',
		en: 'Life is what happens to you while you are busy making other plans.',
		author: 'John Lennon',
	},
	{ text: 'Wege entstehen dadurch, dass man sie geht.', en: 'Paths are made by walking.', author: 'Franz Kafka' },
	{
		text: 'Die Zukunft gehört denen, die an die Schönheit ihrer Träume glauben.',
		en: 'The future belongs to those who believe in the beauty of their dreams.',
		author: 'Eleanor Roosevelt',
	},
	{
		text: 'Das Leben kann nur in der Schau nach rückwärts verstanden, aber nur in der Schau nach vorwärts gelebt werden.',
		en: 'Life can only be understood backwards, but it must be lived forwards.',
		author: 'Søren Kierkegaard',
	},
	{
		text: 'Verweile nicht in der Vergangenheit, träume nicht von der Zukunft. Konzentriere dich auf den gegenwärtigen Moment.',
		en: 'Do not dwell in the past, do not dream of the future. Concentrate the mind on the present moment.',
		author: 'Buddha',
	},
	{
		text: 'Was vor uns liegt und was hinter uns liegt, sind Kleinigkeiten im Vergleich zu dem, was in uns liegt.',
		en: 'What lies behind us and what lies before us are tiny matters compared to what lies within us.',
		author: 'Ralph Waldo Emerson',
	},
];

/**
 * Wählt zufällig ein Zitat aus {@link QUOTES}. Die kanonische Index-Abbildung ist `floor(rand · length)`;
 * `rand` ist injizierbar (Default: `Math.random`), damit die Auswahl in Tests deterministisch prüfbar ist.
 */
export const pickRandomQuote = (rand: () => number = Math.random): Quote => QUOTES[Math.floor(rand() * QUOTES.length)];
