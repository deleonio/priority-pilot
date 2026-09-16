import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectSeriesRepresentatives } from './series.js';

/**
 * Rote Spec-Tests für #1518 (Spec docs/spec/issue-1518.md, Auswahlregel) — zentrale Auswahl EINER
 * Instanz je Serie. Reine Funktion ohne DB: die Regel wird hier einmal geprüft, die Lesestellen
 * (Wald, Signale, Nearby, Pushes) prüfen nur noch die Anwendung. KEIN Produktivcode.
 *
 * AK1: fünf offene Instanzen → genau die mit der frühesten Deadline ab heute.
 * AK2: alle Deadlines vergangen → die jüngste davon.
 * AK3: `seriesId = null` (auch mit `originSeriesId`) wird unverändert durchgereicht.
 */

const NOW = new Date('2026-07-07T10:30:00Z');
const day = (offset: number): Date => new Date(Date.UTC(2026, 6, 7 + offset));

interface Candidate {
	id: number;
	seriesId: number | null;
	originSeriesId?: number | null;
	deadline: Date | null;
	status: 'Open' | 'In process' | 'Done';
}

const instance = (id: number, seriesId: number | null, deadline: Date | null, status: Candidate['status'] = 'Open') =>
	({ id, seriesId, deadline, status }) satisfies Candidate;

describe('selectSeriesRepresentatives (#1518)', () => {
	it('AK1: von fünf offenen Instanzen bleibt genau die früheste mit Deadline ab heute', () => {
		const tasks = [4, 2, 0, 3, 1].map((offset) => instance(10 + offset, 7, day(offset)));
		const result = selectSeriesRepresentatives(tasks, NOW);
		assert.deepEqual(
			result.map((task) => task.id),
			[10],
			'nur die Instanz mit Deadline heute (Offset 0) bleibt',
		);
	});

	it('AK1: heute zählt als „ab heute" — auch wenn die Uhrzeit von `now` nach der Deadline liegt', () => {
		const tasks = [instance(1, 7, day(-1)), instance(2, 7, day(0)), instance(3, 7, day(1))];
		const result = selectSeriesRepresentatives(tasks, NOW);
		assert.deepEqual(
			result.map((task) => task.id),
			[2],
		);
	});

	it('AK2: liegen alle Deadlines in der Vergangenheit, bleibt die jüngste davon', () => {
		const tasks = [instance(1, 7, day(-5)), instance(2, 7, day(-1)), instance(3, 7, day(-3))];
		const result = selectSeriesRepresentatives(tasks, NOW);
		assert.deepEqual(
			result.map((task) => task.id),
			[2],
		);
	});

	it('AK2: eine erledigte Instanz ist nie Repräsentant — die nächste offene rückt nach', () => {
		const tasks = [instance(1, 7, day(0), 'Done'), instance(2, 7, day(1)), instance(3, 7, day(2))];
		const result = selectSeriesRepresentatives(tasks, NOW);
		assert.deepEqual(
			result.map((task) => task.id),
			[2],
		);
	});

	it('AK3: Aufgaben ohne seriesId — auch abgekoppelte mit originSeriesId — bleiben einzeln und in Reihenfolge', () => {
		const tasks: Candidate[] = [
			{ id: 1, seriesId: null, originSeriesId: 7, deadline: day(0), status: 'Open' },
			instance(2, 7, day(1)),
			{ id: 3, seriesId: null, originSeriesId: 7, deadline: day(0), status: 'Open' },
			instance(4, 7, day(0)),
			{ id: 5, seriesId: null, deadline: null, status: 'Open' },
			instance(6, 8, day(3)),
		];
		const result = selectSeriesRepresentatives(tasks, NOW);
		assert.deepEqual(
			result.map((task) => task.id),
			[1, 3, 4, 5, 6],
			'zwei Serien → je eine Instanz; alles ohne seriesId unverändert; Eingabereihenfolge bleibt',
		);
	});

	it('akzeptiert ISO-Strings als Deadline (serialisierte DTOs)', () => {
		const tasks = [
			{ id: 1, seriesId: 7, deadline: day(2).toISOString(), status: 'Open' },
			{ id: 2, seriesId: 7, deadline: day(1).toISOString(), status: 'Open' },
		];
		const result = selectSeriesRepresentatives(tasks, NOW);
		assert.deepEqual(
			result.map((task) => task.id),
			[2],
		);
	});
});
