import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseIcsEvents, fetchIcs, CALENDAR_SYNC_INTERVAL_MS } from './calendar-ics.js';

/**
 * Rote Spec-Tests für #2209 (Spec docs/spec/issue-2209.md): ICS-Fenster, Feldauswahl, Methode.
 * Rot, bis `calendar-ics.ts` existiert.
 */

const NOW = new Date('2026-10-05T10:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const stamp = (d: Date): string =>
	d
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');
const vevent = (lines: string[]): string => `BEGIN:VEVENT\r\n${lines.join('\r\n')}\r\nEND:VEVENT`;
const calendar = (...events: string[]): string =>
	`BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.join('\r\n')}\r\nEND:VCALENDAR\r\n`;
const timed = (title: string, offsetDays: number): string => {
	const start = new Date(NOW.getTime() + offsetDays * DAY);
	return vevent([
		`UID:${title}@test`,
		`DTSTART:${stamp(start)}`,
		`DTEND:${stamp(new Date(start.getTime() + 3600_000))}`,
		`SUMMARY:${title}`,
		'DESCRIPTION:geheim',
		'LOCATION:Irgendwo',
	]);
};

describe('parseIcsEvents (#2209 AK1/AK2)', () => {
	it('AK1: liefert nur Start, Ende, Titel, ganztägig', () => {
		const [event] = parseIcsEvents(calendar(timed('Zahnarzt', 1)), NOW);
		assert.deepEqual(Object.keys(event).sort(), ['allDay', 'end', 'start', 'title']);
		assert.equal(event.title, 'Zahnarzt');
		assert.equal(event.allDay, false);
		assert.equal(event.end.getTime() - event.start.getTime(), 3600_000);
	});

	it('AK1: DTSTART;VALUE=DATE ist ganztägig', () => {
		const ics = calendar(
			vevent(['UID:a@test', 'DTSTART;VALUE=DATE:20261007', 'DTEND;VALUE=DATE:20261008', 'SUMMARY:Urlaub']),
		);
		const events = parseIcsEvents(ics, NOW);
		assert.equal(events.length, 1);
		assert.equal(events[0].allDay, true);
	});

	it('AK2: Termine außerhalb heute bis +14 Tage werden verworfen', () => {
		const ics = calendar(timed('vorbei', -3), timed('heute', 0), timed('in13', 13), timed('in30', 30));
		const titles = parseIcsEvents(ics, NOW)
			.map((e) => e.title)
			.sort();
		assert.deepEqual(titles, ['heute', 'in13']);
	});
});

describe('fetchIcs / Scheduler (#2209 AK6)', () => {
	it('sendet ausschließlich GET', async () => {
		const calls: Array<{ url: string; method: string }> = [];
		const fakeFetch = (async (input: unknown, init?: RequestInit) => {
			calls.push({ url: String(input), method: init?.method ?? 'GET' });
			return new Response('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n', { status: 200 });
		}) as typeof fetch;
		await fetchIcs('https://example.com/cal.ics', fakeFetch);
		assert.deepEqual(calls, [{ url: 'https://example.com/cal.ics', method: 'GET' }]);
	});

	it('Abruf-Intervall des Scheduler-Jobs sind 30 Minuten', () => {
		assert.equal(CALENDAR_SYNC_INTERVAL_MS, 30 * 60 * 1000);
	});
});
