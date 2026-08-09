import { isPushConfigured } from '../logics/push.js';

/**
 * Server-interner, dependency-freier Scheduler (Issue #355 — fachlicher Push-Trigger). Läuft nur,
 * wenn Web-Push konfiguriert ist UND explizit über `PUSH_REMINDERS_ENABLED=true` aktiviert wurde
 * (kein stiller Hintergrundlauf ohne bewusstes Opt-in). Prüft in festem Intervall, ob die
 * konfigurierte Tagesstunde (`PUSH_REMINDERS_HOUR`, UTC) erreicht ist, und ruft dann
 * jeden registrierten Trigger genau einmal pro UTC-Kalendertag auf.
 */

/** Ein fachlicher Trigger (z. B. `runDueTaskReminders`) — erhält den aktuellen Zeitpunkt des Ticks. */
type SchedulerTrigger = (now: Date) => Promise<unknown>;

interface SchedulerHandle {
	stop: () => void;
}

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_HOUR = 8;

const isRemindersEnabled = (): boolean => process.env.PUSH_REMINDERS_ENABLED === 'true';

const configuredHour = (): number => {
	const raw = Number(process.env.PUSH_REMINDERS_HOUR ?? String(DEFAULT_HOUR));
	return Number.isFinite(raw) && raw >= 0 && raw <= 23 ? raw : DEFAULT_HOUR;
};

const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

/** Ob ein Tick auslösen soll: die konfigurierte UTC-Stunde ist erreicht UND heute (UTC) wurde noch nicht gefeuert. */
const shouldFire = (current: Date, lastFiredDay: string | undefined, hour: number): boolean =>
	current.getUTCHours() >= hour && dayKey(current) !== lastFiredDay;

interface TickerOptions {
	now?: () => Date;
	hour?: number;
}

/**
 * Reine Tick-Logik ohne Timer — direkt testbar (injizierbare Uhr `now`, kein echtes Warten nötig).
 * Ein fehlschlagender Trigger wird protokolliert, blockiert aber nicht die übrigen Trigger.
 */
export const createTicker = (
	triggers: SchedulerTrigger[],
	options: TickerOptions = {},
): { tick: () => Promise<void> } => {
	const now = options.now ?? (() => new Date());
	const hour = options.hour ?? configuredHour();
	let lastFiredDay: string | undefined;

	const tick = async (): Promise<void> => {
		const current = now();
		if (!shouldFire(current, lastFiredDay, hour)) {
			return;
		}
		lastFiredDay = dayKey(current);
		for (const trigger of triggers) {
			try {
				await trigger(current);
			} catch (error) {
				console.error('Scheduler-Trigger fehlgeschlagen:', error);
			}
		}
	};

	return { tick };
};

interface StartSchedulerOptions extends TickerOptions {
	checkIntervalMs?: number;
	setIntervalFn?: typeof setInterval;
	clearIntervalFn?: typeof clearInterval;
}

/**
 * Interval-Wiring um {@link createTicker} — gemeinsam für alle Scheduler-Starter. `defaultHour` gibt
 * die UTC-Stunde vor, falls der Aufrufer keine injiziert. `setIntervalFn`/`clearIntervalFn` sind
 * injizierbar, damit Tests den Gate-Entscheid ohne echten Timer prüfen können.
 */
const wireTicker = (
	triggers: SchedulerTrigger[],
	options: StartSchedulerOptions,
	defaultHour: number,
	tickLabel: string,
): SchedulerHandle => {
	const setIntervalFn = options.setIntervalFn ?? setInterval;
	const clearIntervalFn = options.clearIntervalFn ?? clearInterval;
	const { tick } = createTicker(triggers, { ...options, hour: options.hour ?? defaultHour });

	const interval = setIntervalFn(() => {
		tick().catch((error) => console.error(`${tickLabel} fehlgeschlagen:`, error));
	}, options.checkIntervalMs ?? CHECK_INTERVAL_MS);
	(interval as NodeJS.Timeout).unref?.();

	return { stop: () => clearIntervalFn(interval as NodeJS.Timeout) };
};

/**
 * Startet den Web-Push-Scheduler (Interval-Wiring um {@link createTicker}). No-Op-Handle ohne
 * VAPID-Keys oder ohne `PUSH_REMINDERS_ENABLED=true` — dann läuft kein Timer (kein stiller
 * Hintergrundlauf ohne bewusstes Web-Push-Opt-in).
 */
export const startScheduler = (triggers: SchedulerTrigger[], options: StartSchedulerOptions = {}): SchedulerHandle => {
	if (!isPushConfigured() || !isRemindersEnabled()) {
		return { stop: () => {} };
	}
	return wireTicker(triggers, options, configuredHour(), 'Scheduler-Tick');
};

/** Ob die Deadline-Auto-Löschung (#523) aktiv ist — defaultmäßig an (nur `=false` deaktiviert). */
const isAutoDeleteAfterDeadlineEnabled = (): boolean => process.env.AUTO_DELETE_AFTER_DEADLINE_ENABLED !== 'false';

/** UTC-Stunde, zu der die Deadline-Auto-Löschung einmal pro Kalendertag läuft (Mitternacht). */
const AUTO_DELETE_HOUR = 0;

/**
 * Startet den Deadline-Auto-Lösch-Scheduler (#523) — push-unabhängig: anders als {@link startScheduler}
 * hängt er **nicht** am Web-Push-Opt-in (`PUSH_REMINDERS_ENABLED`/VAPID), denn das fachliche Opt-in ist
 * das pro-Task-Feld `autoDeleteAfterDeadline`, nicht Web-Push. Läuft daher defaultmäßig in jedem
 * Deploy (sonst bliebe die Auto-Löschung in Default-Setups stumm nie aktiv). Operatoren/Test-Setups
 * können ihn via `AUTO_DELETE_AFTER_DEADLINE_ENABLED=false` abschalten.
 */
export const startDeadlineAutoDeleteScheduler = (
	triggers: SchedulerTrigger[],
	options: StartSchedulerOptions = {},
): SchedulerHandle => {
	if (!isAutoDeleteAfterDeadlineEnabled()) {
		return { stop: () => {} };
	}
	return wireTicker(triggers, options, AUTO_DELETE_HOUR, 'Deadline-Auto-Lösch-Tick');
};
