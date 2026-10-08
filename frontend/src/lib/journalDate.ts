import i18next from '../i18n/config';
import { readString } from './inputValue';

/** Heutiger Kalendertag des Nutzers als `YYYY-MM-DD` (Vorbelegung des Datumsfelds). */
export const today = (): string => {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/** Kalendertag `tage` vor heute als `YYYY-MM-DD` (Vorbelegung des Statistik-Zeitraums, #2213). */
export const tagVorHeute = (tage: number): string => {
	const now = new Date();
	now.setDate(now.getDate() - tage);
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/** `KolInputDate` liefert je nach Ereignis ein `Date` (UTC-Mitternacht) oder den Rohstring. */
export const readDate = (value: unknown): string =>
	value instanceof Date ? value.toISOString().slice(0, 10) : readString(value);

/** Für `KolInputDate._value` nur ein valides `Date` (UTC) oder `undefined` (Muster `TaskForm.tsx`). */
export const toDateValue = (date: string): Date | undefined => {
	const parsed = new Date(`${date}T00:00:00Z`);
	return date === '' || Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export const formatDate = (date: string): string =>
	new Date(`${date}T00:00:00Z`).toLocaleDateString(i18next.language, {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC',
	});
