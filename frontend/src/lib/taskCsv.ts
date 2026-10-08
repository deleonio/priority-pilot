import type { Task } from 'client';
import i18next from '../i18n/config';

/** Spalten des Aufgaben-Exports — `Titel`/`Frist`/`Priorität` lassen sich beim Import per Spalten-Mapping zuordnen. */
const HEADER_KEYS = ['title', 'deadline', 'priority', 'status', 'description'];

/** CSV-Feld nach RFC 4180: Anführungszeichen, Komma und Zeilenumbruch erzwingen Quoting. */
const field = (value: string): string => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

const isoDate = (date: Date | null | undefined): string =>
	date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : '';

/** Baut die Export-CSV (Komma-getrennt, Frist als JJJJ-MM-TT) — dasselbe Datumsformat liest der Import. */
export const tasksToCsv = (tasks: Task[]): string =>
	[
		HEADER_KEYS.map((key) => i18next.t(`tasks:csv.${key}`)),
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
