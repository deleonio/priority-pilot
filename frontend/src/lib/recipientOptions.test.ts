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
});
