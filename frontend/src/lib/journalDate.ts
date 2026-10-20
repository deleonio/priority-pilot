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

/** Datumsformat: `'long'` (Default, „2. November 2026“) oder `'short'` („2.11.2026“, Import-Vorschau). */
export type DateFormat = 'long' | 'short';

/**
 * Kalendertag (`YYYY-MM-DD`) oder ISO-Instant (UTC-Mitternacht, Import-Vorschau) im Lang- oder
 * Kurzformat. Beide Eingaben landen als UTC-Mitternacht, `timeZone: 'UTC'` hält den Kalendertag
 * unabhängig von der Zeitzone des Nutzers bzw. Runners (#2775).
 */
export const formatDate = (date: string, { format = 'long' }: { format?: DateFormat } = {}): string => {
	const parsed = date.length > 10 ? new Date(date) : new Date(`${date}T00:00:00Z`);
	return parsed.toLocaleDateString(
		i18next.language,
		format === 'short' ? { timeZone: 'UTC' } : { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' },
	);
};
