import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
	buildAdvisorUserMessage,
	buildUserMessage,
	weakSignalPillarIds,
	buildLektoratUserMessage,
	extractLektoratOutput,
	lektoratTextWithMistral,
	parseTaskTextWithMistral,
	type AdviseActivitiesInput,
	type ClassifyPillarsInput,
	type LektoratInput,
	type ParsedTask,
} from './llm.js';
import { resetDb, closeDb, setTestLlmProvider } from '../test/helpers.js';

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

/**
 * AK1 (#424): Der an Mistral gesendete User-Prompt enthält je gültiger Säule pillarId, Name
 * UND Beschreibung (falls vorhanden). Ohne Beschreibung erscheint nur pillarId + Name.
 */
describe('buildUserMessage — Beschreibung im Prompt (AK1, #424)', () => {
	it('enthält description im Prompt, wenn die Säule eine Beschreibung hat', () => {
		// Die erwartete Schnittstelle: pillars enthält optional `description`.
		const pillars: { id: number; name: string; description?: string }[] = [
			{ id: 1, name: 'Körper', description: 'Physische Gesundheit: Bewegung, Ernährung, Schlaf.' },
			{ id: 2, name: 'Garten', description: 'Pflanzen pflegen, Rasen mähen, Ernte.' },
		];
		const input = { title: 'Tomaten pflanzen', pillars } as ClassifyPillarsInput;

		const message = buildUserMessage(input);

		// Beschreibungen erscheinen im Prompt
		assert.ok(
			message.includes('Physische Gesundheit: Bewegung, Ernährung, Schlaf.'),
			'Prompt enthält die Beschreibung von Körper',
		);
		assert.ok(
			message.includes('Pflanzen pflegen, Rasen mähen, Ernte.'),
			'Prompt enthält die Beschreibung von Garten (Custom-Säule)',
		);
		// pillarId und Name sind weiterhin vorhanden
		assert.ok(message.includes('pillarId 1'), 'Prompt nennt pillarId 1');
		assert.ok(message.includes('pillarId 2'), 'Prompt nennt pillarId 2');
		assert.ok(message.includes('Körper'), 'Prompt nennt den Namen Körper');
		assert.ok(message.includes('Garten'), 'Prompt nennt den Namen Garten');
	});

	it('ohne description erscheint kein Beschreibungs-Platzhalter (leere Beschreibung → nur Name)', () => {
		const pillars: { id: number; name: string; description?: string }[] = [
			{ id: 1, name: 'Körper' },
			{ id: 2, name: 'Wirksamkeit', description: '' },
		];
		const input = { title: 'Test', pillars } as ClassifyPillarsInput;

		const message = buildUserMessage(input);

		// Keine leeren Beschreibungs-Trennzeichen
		assert.ok(message.includes('pillarId 1: Körper'), 'Körper ohne description erscheint sauber');
		assert.ok(message.includes('pillarId 2: Wirksamkeit'), 'Wirksamkeit ohne description erscheint sauber');
		// Kein hängendes Trennzeichen wie "— "
		const pillar2Line = message.split('\n').find((line) => line.includes('pillarId 2'));
		assert.ok(pillar2Line, 'pillarId 2 Zeile existiert');
		assert.ok(
			!pillar2Line!.endsWith('— ') && !pillar2Line!.includes('—  —'),
			'Kein hängendes oder doppeltes Trennzeichen bei leerer Beschreibung',
		);
	});

	it('prompt-Bau mit gemischten Säulen (mit/ohne Beschreibung) enthält Beschreibungen nur wo vorhanden', () => {
		const pillars: { id: number; name: string; description?: string }[] = [
			{ id: 1, name: 'Körper', description: 'Bewegung und Ernährung' },
			{ id: 2, name: 'Beziehungen' },
			{ id: 3, name: 'Garten', description: 'Alles rund um Pflanzen und Beet' },
		];
		const input = { title: 'Rasen mähen', description: 'Vorgarten und Hinterhof', pillars } as ClassifyPillarsInput;

		const message = buildUserMessage(input);

		assert.ok(message.includes('Bewegung und Ernährung'), 'Körper-Beschreibung ist im Prompt');
		assert.ok(message.includes('Alles rund um Pflanzen und Beet'), 'Garten-Beschreibung ist im Prompt');
		// Beziehungen: kein " — " nach dem Namen
		const bezLine = message.split('\n').find((line) => line.includes('Beziehungen'));
		assert.ok(bezLine, 'Beziehungen-Zeile existiert');
		assert.ok(!bezLine!.includes('—'), 'Beziehungen hat keine Beschreibung → kein Trennzeichen');
		// Task-Details sind unverändert vorhanden
		assert.ok(message.includes('Rasen mähen'), 'Task-Titel im Prompt');
		assert.ok(message.includes('Vorgarten und Hinterhof'), 'Task-Beschreibung im Prompt');
	});
});

/**
 * AK2 (#424): Klassifikation mit ausschließlich nutzerdefinierten Säulen (keine Seed-Namen)
 * liefert gültige pillarIds aus der übergebenen Liste; Weak-Signal-Nachschärfung greift
 * dann schlicht nicht (kein Fehler).
 */
describe('weakSignalPillarIds — Custom-Säulen (AK2, #424)', () => {
	it('mit ausschließlich Seed-Namen findet Sinn und Mentale Gesundheit', () => {
		const ids = weakSignalPillarIds([
			{ id: 1, name: 'Körper' },
			{ id: 3, name: 'Sinn' },
			{ id: 4, name: 'Mentale Gesundheit' },
			{ id: 5, name: 'Wirksamkeit' },
		]);
		assert.ok(ids.has(3), 'Sinn wird erkannt');
		assert.ok(ids.has(4), 'Mentale Gesundheit wird erkannt');
		assert.ok(!ids.has(1), 'Körper ist keine Weak-Signal-Säule');
		assert.equal(ids.size, 2, 'Genau zwei Weak-Signal-Säulen');
	});

	it('mit ausschließlich Custom-Namen → leeres Set, kein Fehler', () => {
		const ids = weakSignalPillarIds([
			{ id: 1, name: 'Garten' },
			{ id: 2, name: 'Haushalt' },
			{ id: 3, name: 'Hobby' },
		]);
		assert.equal(ids.size, 0, 'Keine Weak-Signal-Säulen bei reinen Custom-Namen');
		assert.ok(ids instanceof Set, 'Rückgabe ist ein Set (kein Fehler)');
	});

	it('mit gemischten Seed- und Custom-Namen findet nur die Seed-Weak-Signals', () => {
		const ids = weakSignalPillarIds([
			{ id: 1, name: 'Garten' },
			{ id: 2, name: 'Sinn' },
			{ id: 3, name: 'Hobby' },
			{ id: 4, name: 'Mentale Gesundheit' },
		]);
		assert.equal(ids.size, 2, 'Nur zwei Weak-Signal-Säulen');
		assert.ok(ids.has(2), 'Sinn wird erkannt (auch neben Custom-Namen)');
		assert.ok(ids.has(4), 'Mentale Gesundheit wird erkannt');
		assert.ok(!ids.has(1), 'Garten ist keine Weak-Signal-Säule');
	});
});

/**
 * Issue #645: LLM-basierte Text-Lektorat-Funktion zum Kürzen und Lektorieren.
 * Testet die Helper-Funktionen buildLektoratUserMessage und extractLektoratOutput.
 */
describe('Lektorat-Funktion (Issue #645)', () => {
	describe('buildLektoratUserMessage', () => {
		it('enthält den Text im Prompt', () => {
			const input: LektoratInput = { text: 'Das ist ein Test.' };
			const message = buildLektoratUserMessage(input);
			assert.ok(message.includes('Das ist ein Test.'), 'Prompt enthält den Originaltext');
		});

		it('mit maxLength enthält Längenbegrenzung im Prompt', () => {
			const input: LektoratInput = { text: 'Langer Text...', maxLength: 50 };
			const message = buildLektoratUserMessage(input);
			assert.ok(message.includes('Maximallänge: 50 Zeichen'), 'Prompt enthält Maximallänge');
			assert.ok(message.includes('Text kürzen, falls länger'), 'Prompt enthält Kürzungshinweis');
		});

		it('ohne maxLength kein Kürzungshinweis', () => {
			const input: LektoratInput = { text: 'Text ohne Längenbegrenzung' };
			const message = buildLektoratUserMessage(input);
			assert.doesNotMatch(message, /Maximallänge/i, 'ohne maxLength kein Längen-Hinweis');
		});
	});

	describe('extractLektoratOutput', () => {
		it('extrahiert das text-Feld aus der Antwort', () => {
			const parsed = { text: 'Lektorierter Text' };
			const output = extractLektoratOutput(parsed);
			assert.equal(output.text, 'Lektorierter Text', 'Text wird extrahiert');
		});

		it('trimmtWhitespace vom Text', () => {
			const parsed = { text: '  Lektorierter Text  ' };
			const output = extractLektoratOutput(parsed);
			assert.equal(output.text, 'Lektorierter Text', 'Whitespace wird getrimmt');
		});

		it('wirft bei fehlendem text-Feld', () => {
			assert.throws(() => extractLektoratOutput({}), /gültiges text-Feld/i, 'Fehler bei fehlendem text-Feld');
		});

		it('wirft bei falschem Typ (kein String)', () => {
			assert.throws(
				() => extractLektoratOutput({ text: 123 }),
				/gültiges text-Feld/i,
				'Fehler bei nicht-String text-Feld',
			);
		});

		it('wirft bei null/undefined als Antwort', () => {
			assert.throws(() => extractLektoratOutput(null), /erwartete Format/i, 'Fehler bei null-Antwort');
		});
	});

	/**
	 * Eingabe-Validierung der Hauptfunktion (Review #647 F1+F2): Validierung greift VOR dem
	 * LLM-Call, daher ohne Mock/API-Keys testbar — schützt vor verschwendeten API-Calls (leerer
	 * Text) und kaputten Prompt-Outputs (nicht-positive maxLength).
	 */
	describe('lektoratTextWithMistral — Eingabe-Validierung', () => {
		it('wirft bei leerem Text', async () => {
			await assert.rejects(() => lektoratTextWithMistral({ text: '' }), /nicht-leeren Text/i);
		});

		it('wirft bei whitespace-only Text', async () => {
			await assert.rejects(() => lektoratTextWithMistral({ text: '   ' }), /nicht-leeren Text/i);
		});

		it('wirft bei maxLength 0', async () => {
			await assert.rejects(() => lektoratTextWithMistral({ text: 'Gültiger Text', maxLength: 0 }), /positiv/i);
		});

		it('wirft bei negativer maxLength', async () => {
			await assert.rejects(() => lektoratTextWithMistral({ text: 'Gültiger Text', maxLength: -5 }), /positiv/i);
		});
	});
});

/**
 * Rote Spec-Tests für #1310 (Schnellerfassung: Serie/Adresse/Checkliste, Längen, Priorität, Datum).
 * Spec: `docs/spec/issue-1310.md`.
 *
 * Testebene: `parseTaskTextWithMistral` (öffentliche Funktion) mit gemocktem `globalThis.fetch`
 * (Muster `lektorat.test.ts`) und einem aktiven Test-Provider (`setTestLlmProvider`) — die
 * DB-seitig noch nicht exportierte `extractParsedTask` wird so indirekt über den vollen Parse-Pfad
 * geprüft (TF1/TF2 laut Harness-Kommentar erlauben ausdrücklich diese Alternative).
 */
describe('parseTaskTextWithMistral — Schnellerfassung erweitert (#1310)', () => {
	const originalFetch = globalThis.fetch;
	let capturedBody: { messages?: { role: string; content: string }[] } | undefined;

	/** Mockt NUR den LLM-API-Call (Mistral); zeichnet den gesendeten Body auf. */
	const stubModelResponse = (parsedJson: unknown): void => {
		globalThis.fetch = (async (url: string, init?: RequestInit) => {
			if (typeof url === 'string' && url.includes('api.mistral.ai')) {
				capturedBody = init?.body ? (JSON.parse(init.body as string) as typeof capturedBody) : undefined;
				return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(parsedJson) } }] }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				});
			}
			return originalFetch(url, init);
		}) as typeof fetch;
	};

	beforeEach(async () => {
		await resetDb();
		await setTestLlmProvider(true);
		capturedBody = undefined;
	});

	after(async () => {
		globalThis.fetch = originalFetch;
		await closeDb();
	});

	// AK1: neue optionale Felder werden unverändert durchgereicht.
	it('AK1: isSeries/address/checklist werden aus der Modellantwort übernommen', async () => {
		stubModelResponse({
			title: 'Wöchentliches Teammeeting',
			isSeries: true,
			address: 'Musterstraße 1, 12345 Musterstadt',
			checklist: ['Agenda vorbereiten', 'Raum buchen'],
		});

		const result: ParsedTask = await parseTaskTextWithMistral('Jeden Montag Teammeeting im Büro');

		assert.equal(result.isSeries, true, 'isSeries wird übernommen');
		assert.equal(result.address, 'Musterstraße 1, 12345 Musterstadt', 'address wird übernommen');
		assert.deepEqual(result.checklist, ['Agenda vorbereiten', 'Raum buchen'], 'checklist wird übernommen');
	});

	// AK1: Rückwärtskompatibilität — fehlen die neuen Felder, bleibt das Ergebnis wie bisher.
	it('AK1: fehlende neue Felder erzeugen kein isSeries/address/checklist im Ergebnis', async () => {
		stubModelResponse({ title: 'Einfacher Task ohne neue Felder' });

		const result: ParsedTask = await parseTaskTextWithMistral('Einfacher Task ohne neue Felder');

		assert.equal(result.isSeries, undefined, 'isSeries bleibt unbelegt');
		assert.equal(result.address, undefined, 'address bleibt unbelegt');
		assert.equal(result.checklist, undefined, 'checklist bleibt unbelegt');
	});

	// AK3: Titel wird nach Trim auf 65 Zeichen gekürzt.
	it('AK3: ein 200-Zeichen-Titel wird auf genau 65 Zeichen gekürzt', async () => {
		const longTitle = 'T'.repeat(200);
		stubModelResponse({ title: longTitle });

		const result = await parseTaskTextWithMistral('Text mit sehr langem Titel');

		assert.equal(result.title.length, 65, `Titel muss auf 65 Zeichen gekürzt sein, ist aber ${result.title.length}`);
		assert.equal(result.title, 'T'.repeat(65));
	});

	// AK3: Beschreibung wird nach Trim auf 3000 Zeichen gekürzt.
	it('AK3: eine 3500-Zeichen-Beschreibung wird auf genau 3000 Zeichen gekürzt', async () => {
		const longDescription = 'D'.repeat(3500);
		stubModelResponse({ title: 'Task mit langer Beschreibung', description: longDescription });

		const result = await parseTaskTextWithMistral('Text mit sehr langer Beschreibung');

		assert.equal(
			result.description?.length,
			3000,
			`Beschreibung muss auf 3000 Zeichen gekürzt sein, ist aber ${result.description?.length}`,
		);
	});

	// AK6: leere/whitespace-only Checklisten-Einträge werden verworfen, überlange gekürzt.
	it('AK6: Checkliste filtert leere Einträge und kürzt überlange auf 255 Zeichen', async () => {
		const overlong = 'C'.repeat(300);
		stubModelResponse({
			title: 'Task mit Checkliste',
			checklist: ['Gültiger Eintrag', '', '   ', overlong],
		});

		const result = await parseTaskTextWithMistral('Checkliste: Gültiger Eintrag, dann Leerzeichen, dann sehr lang');

		assert.deepEqual(
			result.checklist,
			['Gültiger Eintrag', overlong.slice(0, 255)],
			'leere/whitespace-Einträge verworfen, überlanger Eintrag auf 255 Zeichen gekürzt',
		);
		assert.equal(result.checklist?.[1].length, 255);
	});

	// AK4: der System-/User-Prompt enthält das aktuelle Datum (ISO, UTC) als Kontext.
	it('AK4: der gesendete Prompt enthält das aktuelle Datum (ISO, UTC)', async () => {
		stubModelResponse({ title: 'Übermorgen Zahnarzt' });

		await parseTaskTextWithMistral('Übermorgen zum Zahnarzt');

		const today = new Date().toISOString().slice(0, 10);
		const promptText = (capturedBody?.messages ?? []).map((m) => m.content).join('\n');
		assert.ok(
			promptText.includes(today),
			`Prompt muss das aktuelle Datum (${today}) enthalten, war aber: ${promptText.slice(0, 200)}…`,
		);
	});

	// AK8: der Prompt weist das Modell an, die Priorität anhand von Dringlichkeitssignalen zu setzen.
	it('AK8: der System-Prompt enthält eine Dringlichkeits-Anweisung für priority', async () => {
		stubModelResponse({ title: 'Ganz wichtige Erledigung', priority: 5 });

		await parseTaskTextWithMistral('Das ist eine ganz wichtige Erledigung, muss sofort passieren');

		const systemPrompt = capturedBody?.messages?.find((m) => m.role === 'system')?.content ?? '';
		assert.match(
			systemPrompt,
			/dringlich/i,
			'System-Prompt muss eine Dringlichkeits-Anweisung für die Prioritäts-Ableitung enthalten',
		);
	});
});
