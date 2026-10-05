import type { Task } from 'client';

/** Spalten des Aufgaben-Exports — `Titel`/`Frist`/`Priorität` lassen sich beim Import per Spalten-Mapping zuordnen. */
const HEADER = ['Titel', 'Frist', 'Priorität', 'Status', 'Beschreibung'];

/** CSV-Feld nach RFC 4180: Anführungszeichen, Komma und Zeilenumbruch erzwingen Quoting. */
const field = (value: string): string => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

const isoDate = (date: Date | null | undefined): string =>
	date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : '';

/** Baut die Export-CSV (Komma-getrennt, Frist als JJJJ-MM-TT) — dasselbe Datumsformat liest der Import. */
export const tasksToCsv = (tasks: Task[]): string =>
	[
		HEADER,
		...tasks.map((task) => [
			task.title,
			isoDate(task.deadline),
			String(task.priority),
			String(task.status),
			task.description ?? '',
		]),
	]
		.map((row) => row.map(field).join(','))
		.join('\n');
