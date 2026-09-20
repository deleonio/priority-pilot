import { describe, expect, it } from 'vitest';
import { buildRecipientOptions } from './recipientOptions';

describe('buildRecipientOptions', () => {
	it('listet ein Mitglied, das in mehreren Gruppen vorkommt, nur einmal', () => {
		const own = { id: 1, displayName: 'Eigenes Konto' };
		const members = [
			{ userId: 2, displayName: 'Bob' },
			{ userId: 2, displayName: 'Bob' },
			{ userId: 3, displayName: 'Carol' },
		];

		const options = buildRecipientOptions(own, members);

		expect(options).toEqual([
			{ label: 'Eigenes Konto', value: '1' },
			{ label: 'Bob', value: '2' },
			{ label: 'Carol', value: '3' },
		]);
	});

	it('stellt das eigene Konto immer voran und dedupliziert es, auch wenn es zugleich Gruppenmitglied ist', () => {
		const own = { id: 1, displayName: 'Eigenes Konto' };
		const members = [
			{ userId: 3, displayName: 'Carol' },
			{ userId: 1, displayName: 'Eigenes Konto' },
		];

		const options = buildRecipientOptions(own, members);

		expect(options).toEqual([
			{ label: 'Eigenes Konto', value: '1' },
			{ label: 'Carol', value: '3' },
		]);
	});

	it('verwendet die stringifizierte userId als value (Key) und den displayName als label (filterbarer Wert)', () => {
		const own = { id: 42, displayName: 'Own' };

		const options = buildRecipientOptions(own, []);

		expect(options).toEqual([{ label: 'Own', value: '42' }]);
	});

	// #1521 AK1: Gruppen des Nutzers stehen neben den Personen als eigene, unterscheidbare Option
	// (Präfix „Gruppe: ", Value `group:<id>`) — Personen-Optionen bleiben davon unberührt.
	it('ergänzt Gruppen-Optionen mit Präfix und group:<id>-Value, ohne die Personen-Optionen zu verändern', () => {
		const own = { id: 1, displayName: 'Eigenes Konto' };
		const members = [{ userId: 2, displayName: 'Bob' }];
		const groups = [{ id: 7, name: 'Familie' }];

		// @ts-expect-error #1521: dritter Parameter "groups" existiert erst nach der Implementierung.
		const options = buildRecipientOptions(own, members, groups);

		const personOptions = options.filter((option) => !option.value.startsWith('group:'));
		expect(personOptions).toEqual([
			{ label: 'Eigenes Konto', value: '1' },
			{ label: 'Bob', value: '2' },
		]);
		expect(options).toContainEqual({ label: 'Gruppe: Familie', value: 'group:7' });
	});
});
