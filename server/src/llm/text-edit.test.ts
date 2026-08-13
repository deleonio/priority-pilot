import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error - function not implemented yet
import { editTaskText } from './text-edit.js';

/**
 * Rote Tests für Issue 645 – LLM-Textfunktion zum Kürzen und Lektorieren
 * Spec: docs/spec/issue-645.md
 *
 * Diese Tests definieren den Vertrag für die neue Text-Editier-Funktion.
 * Die Funktion ist noch nicht implementiert – alle Tests werden ROT sein.
 */

describe('editTaskText — LLM-Textfunktion (Issue 645)', () => {
	/**
	 * Journey 1: Text lektorieren (ohne Kürzung)
	 * Spec: docs/spec/issue-645.md#journey-1
	 */
	describe('Journey 1: Text lektorieren', () => {
		it('lektorisiert Text mit Tippfehlern und Grammatikfehlern', async () => {
			const input = 'Dieser text hat tippfehler und ist schlecht formuliert.';
			const result = await editTaskText(input, null);

			// Text muss korrigiert sein
			assert.ok(!result.includes('tippfehler'), 'Tippfehler müssen korrigiert sein');
			assert.ok(!result.includes('text'), 'Großschreibung am Satzanfang muss korrigiert sein');
			assert.ok(result.length > 0, 'Result darf nicht leer sein');
		});

		it('lektorisiert Text ohne die Länge stark zu ändern', async () => {
			const input = 'Dies ist ein Text mittlerer Länge mit einigen Wörtern.';
			const inputLength = input.length;
			const result = await editTaskText(input, null);

			// Länge sollte ähnlich sein (±20% Toleranz für Lektorat)
			const lengthDiff = Math.abs(result.length - inputLength);
			assert.ok(lengthDiff < inputLength * 0.2, 'Lektorat sollte Länge nicht stark ändern');
		});

		it('akzeptiert leeren String ohne Fehler', async () => {
			const result = await editTaskText('', null);
			assert.equal(result, '', 'Leerer Input sollte leeren Output geben');
		});
	});

	/**
	 * Journey 2: Text kürzen mit Max-Länge
	 * Spec: docs/spec/issue-645.md#journey-2
	 */
	describe('Journey 2: Text kürzen mit Max-Länge', () => {
		it('kürzt Text auf max_length=50 und lektoriert gleichzeitig', async () => {
			const input =
				'Dies ist ein sehr langer Text mit viel Inhalt und vielen Details, der gekürzt werden soll, damit er nicht mehr so lang ist.';
			const maxLength = 50;
			const result = await editTaskText(input, maxLength);

			// Result muss ≤ max_length sein
			assert.ok(result.length <= maxLength, `Result length ${result.length} muss ≤ ${maxLength} sein`);

			// Result muss lektorisiert sein (keine offenkundigen Fehler)
			assert.ok(result.length > 0, 'Result darf nicht leer sein');
			assert.ok(!result.includes('  '), 'Keine doppelten Leerzeichen durch Lektorat');
		});

		it('kürzt Text auf max_length=30 für Titel-Optimierung', async () => {
			const input = 'GROSSES PROJEKT mit viel Aufwand und DRINGEND';
			const maxLength = 30;
			const result = await editTaskText(input, maxLength);

			// Result muss ≤ 30 Zeichen sein
			assert.ok(result.length <= maxLength, `Titel length ${result.length} muss ≤ ${maxLength} sein`);

			// Result sollte lektorisiert sein (keine CAPS-lock Fehler)
			assert.ok(result.length > 0, 'Result darf nicht leer sein');
			assert.ok(result === result.trim(), 'Keine Leerzeichen am Anfang/Ende');
		});

		it('bei max_length=0 soll leerer String zurückgegeben werden', async () => {
			const input = 'Dieser Text ist egal';
			const result = await editTaskText(input, 0);
			assert.equal(result, '', 'max_length=0 sollte leeren String geben');
		});

		it('bei negativem max_length soll Fehler geworfen werden', async () => {
			const input = 'Test';
			await assert.rejects(
				async () => await editTaskText(input, -10),
				/negative|max_length/i,
				'Negative max_length sollte Fehler werfen',
			);
		});
	});

	/**
	 * Journey 3: Titel lektorieren und kürzen
	 * Spec: docs/spec/issue-645.md#journey-3
	 */
	describe('Journey 3: Titel-Optimierung', () => {
		it('optimiert Titel mit Caps-Lock und Formatierung', async () => {
			const input = 'GROSSES PROJEKT mit viel Aufwand und DRINGEND';
			const maxLength = 25;
			const result = await editTaskText(input, maxLength);

			// Result muss ≤ 25 Zeichen sein
			assert.ok(result.length <= maxLength, `Titel length ${result.length} muss ≤ ${maxLength} sein`);

			// Result sollte professionell lektorisiert sein
			assert.ok(result.length > 0, 'Result darf nicht leer sein');
			assert.ok(result === result.trim(), 'Keine überflüssigen Leerzeichen');
		});

		it('behält Kerninformation bei gekürztem Titel', async () => {
			const input = 'Wichtig: Kundenbericht Q3 fertigstellen bis Freitag';
			const maxLength = 20;
			const result = await editTaskText(input, maxLength);

			// Result muss kurz sein
			assert.ok(result.length <= maxLength, `Result length ${result.length} muss ≤ ${maxLength} sein`);

			// Result sollte nicht komplett leer/destruktiv sein
			assert.ok(result.length >= 5, 'Gekürzter Titel sollte mindestens 5 Zeichen enthalten');
		});
	});

	/**
	 * Journey 4: Beschreibung lektorieren
	 * Spec: docs/spec/issue-645.md#journey-4
	 */
	describe('Journey 4: Beschreibungs-Lektorat', () => {
		it('lektorisiert Beschreibung ohne Kürzung (max_length=null)', async () => {
			const input = 'dies ist die beschreibung für die aufgabe die viel arbeit macht';
			const result = await editTaskText(input, null);

			// Groß-/Kleinschreibung muss korrigiert sein
			assert.ok(result.match(/^[A-ZÄÖÜ]/), 'Satzanfang muss groß sein');
			assert.ok(!result.includes('beschreibung für die aufgabe'), 'Grammatik muss korrigiert sein');

			// Inhalt soll erhalten bleiben
			assert.ok(result.length > 0, 'Result darf nicht leer sein');
		});

		it('lektoriert mehrzeilige Beschreibung', async () => {
			const input = `Erste Zeile mit fehlern.
zweite zeile auch.
dritte zeile hier.`;
			const result = await editTaskText(input, null);

			// Alle Zeilen müssen korrigiert sein
			assert.ok(!result.includes('fehler'), 'Rechtschreibung muss korrigiert sein');
			assert.ok(result.length > 0, 'Result darf nicht leer sein');
		});
	});

	/**
	 * Technische Randbedingungen und Fehlerbehandlung
	 * Spec: docs/spec/issue-645.md#randfälle--fehler
	 */
	describe('Fehlerbehandlung und Randfälle', () => {
		it('akzeptiert null als max_length (keine Begrenzung)', async () => {
			const input = 'Test Text';
			const result = await editTaskText(input, null);
			assert.ok(result.length > 0, 'Result darf nicht leer sein');
		});

		it('akzeptiert undefined als max_length (keine Begrenzung)', async () => {
			const input = 'Test Text';
			// @ts-expect-error - test case for undefined
			const result = await editTaskText(input, undefined);
			assert.ok(result.length > 0, 'Result darf nicht leer sein');
		});

		it('Text bereits kürzer als max_length wird nur lektoriert', async () => {
			const input = 'kurz';
			const maxLength = 100;
			const result = await editTaskText(input, maxLength);

			// Result sollte nicht viel länger werden als Input
			assert.ok(result.length <= maxLength + 20, 'Result sollte max_length nicht stark überschreiten');
			assert.ok(result.length > 0, 'Result darf nicht leer sein');
		});

		it('wirft Fehler bei null oder undefined Input', async () => {
			await assert.rejects(
				async () => await editTaskText(null as any, 50),
				/text|input/i,
				'Null Input sollte Fehler werfen',
			);

			await assert.rejects(
				async () => await editTaskText(undefined as any, 50),
				/text|input/i,
				'Undefined Input sollte Fehler werfen',
			);
		});
	});
});
