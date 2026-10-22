import { isFcmConfigured } from '../logics/fcm.js';
import { isPushConfigured } from '../logics/push.js';

/**
 * Server-interner, dependency-freier Scheduler (Issue #355 — fachlicher Push-Trigger). Läuft nur,
 * wenn Web-Push konfiguriert ist UND explizit über `PUSH_REMINDERS_ENABLED=true` aktiviert wurde
 * (kein stiller Hintergrundlauf ohne bewusstes Opt-in). Tickt stündlich (#2849) und ruft je Tick
 * jeden registrierten Trigger auf — die Zustellfenster (Morgen 7–9, Tag 9–17, Abend 18–21,
 * Ruhezeit 21–7, jeweils Nutzer-Zeitzone) prüfen die Trigger selbst.
 */

/** Ein fachlicher Trigger (z. B. `runDailyDigest`) — erhält den aktuellen Zeitpunkt des Ticks. */
type SchedulerTrigger = (now: Date) => Promise<unknown>;

/**
 * Trigger-Eintrag mit Vorrang (#2853/F1.2): Einträge mit `rang` laufen je Tick aufsteigend vor den
 * übrigen — der Scheduler konsumiert das Push-Budget in §4-Vorrang-Ordnung, das Budget-Tor
 * (`passtImBudget`) macht daraus die gemeinsame Auswahl des Ticks; über den Tagesverlauf bleibt es
 * First-Come-First-Served. Ungerangte Trigger folgen in Registrierungs-Reihenfolge.
 */
interface RangTrigger {
	rang: number;
	trigger: SchedulerTrigger;
}

type SchedulerEntry = SchedulerTrigger | RangTrigger;

/** Vorrang eines Eintrags — ungerangte laufen nach allen gerangten, in Registrierungs-Reihenfolge. */
const rangVon = (entry: SchedulerEntry): number => (typeof entry === 'object' ? entry.rang : Number.POSITIVE_INFINITY);

interface SchedulerHandle {
	stop: () => void;
}

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
/** Stündlicher Push-Tick (#2849) — die Zustellfenster je Nutzerzeitzone prüfen die Trigger selbst. */
const HOURLY_INTERVAL_MS = 60 * 60 * 1000;

const isRemindersEnabled = (): boolean => process.env.PUSH_REMINDERS_ENABLED === 'true';

const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Ob ein Tick auslösen soll: mit `hour` nur ab der konfigurierten UTC-Stunde und höchstens einmal
 * pro UTC-Tag (#523, Deadline-Auto-Löschung); ohne `hour` feuert jeder Tick (#2849 — die
 * Zustellfenster je Nutzerzeitzone prüfen die Trigger selbst).
 */
const shouldFire = (current: Date, lastFiredDay: string | undefined, hour?: number): boolean =>
	hour === undefined || (current.getUTCHours() >= hour && dayKey(current) !== lastFiredDay);

interface TickerOptions {
	now?: () => Date;
	/** UTC-Stunde für Einmal-pro-Tag-Ticker; ohne `hour` feuert jeder Tick (#2849). */
	hour?: number;
}

/**
 * Reine Tick-Logik ohne Timer — direkt testbar (injizierbare Uhr `now`, kein echtes Warten nötig).
 * Ein fehlschlagender Trigger wird protokolliert, blockiert aber nicht die übrigen Trigger. Mit
 * `hour` feuert der Tick höchstens einmal je UTC-Tag ab der konfigurierten Stunde, ohne `hour`
 * jeder Tick (#2849).
 */
export const createTicker = (
	triggers: SchedulerEntry[],
	options: TickerOptions = {},
): { tick: () => Promise<void> } => {
	const now = options.now ?? (() => new Date());
	const hour = options.hour;
	let lastFiredDay: string | undefined;

	// Stabile Sortierung (#22 ES2019): gleiche Ränge und ungerangte bleiben in Registrierungs-Reihenfolge.
	const eintraege = [...triggers]
		.sort((a, b) => rangVon(a) - rangVon(b))
		.map((entry) => (typeof entry === 'object' ? entry.trigger : entry));

	const tick = async (): Promise<void> => {
		const current = now();
		if (!shouldFire(current, lastFiredDay, hour)) {
			return;
		}
		lastFiredDay = dayKey(current);
		for (const trigger of eintraege) {
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
	triggers: SchedulerEntry[],
	options: StartSchedulerOptions,
	defaultHour: number | undefined,
	tickLabel: string,
	defaultIntervalMs: number = CHECK_INTERVAL_MS,
): SchedulerHandle => {
	const setIntervalFn = options.setIntervalFn ?? setInterval;
	const clearIntervalFn = options.clearIntervalFn ?? clearInterval;
	const { tick } = createTicker(triggers, { ...options, hour: options.hour ?? defaultHour });

	const interval = setIntervalFn(() => {
		tick().catch((error) => console.error(`${tickLabel} fehlgeschlagen:`, error));
	}, options.checkIntervalMs ?? defaultIntervalMs);
	(interval as NodeJS.Timeout).unref?.();

	return { stop: () => clearIntervalFn(interval as NodeJS.Timeout) };
};

/**
 * Startet den Push-Scheduler (Interval-Wiring um {@link createTicker}) — tickt stündlich (#2849);
 * die Zustellfenster je Nutzerzeitzone prüfen die Trigger selbst. No-Op-Handle ohne Push-Kanal
 * (weder VAPID-Keys noch FCM-Service-Account) oder ohne `PUSH_REMINDERS_ENABLED=true` — dann läuft
 * kein Timer (kein stiller Hintergrundlauf ohne bewusstes Push-Opt-in).
 */
export const startScheduler = (triggers: SchedulerEntry[], options: StartSchedulerOptions = {}): SchedulerHandle => {
	if (!(isPushConfigured() || isFcmConfigured()) || !isRemindersEnabled()) {
		return { stop: () => {} };
	}
	return wireTicker(triggers, options, undefined, 'Scheduler-Tick', HOURLY_INTERVAL_MS);
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
	triggers: SchedulerEntry[],
	options: StartSchedulerOptions = {},
): SchedulerHandle => {
	if (!isAutoDeleteAfterDeadlineEnabled()) {
		return { stop: () => {} };
	}
	return wireTicker(triggers, options, AUTO_DELETE_HOUR, 'Deadline-Auto-Lösch-Tick');
};

/**
 * Startet einen Intervall-Job im festen Intervall — push-unabhängig und ohne Tagesstunde,
 * anders als {@link wireTicker}. Ein fehlschlagender Lauf wird unter dem Job-eigenen `label`
 * protokolliert (#2550), der Timer läuft weiter.
 */
export const startIntervalScheduler = (
	label: string,
	trigger: SchedulerTrigger,
	intervalMs: number,
): SchedulerHandle => {
	const interval = setInterval(() => {
		trigger(new Date()).catch((error) => console.error(`${label} fehlgeschlagen:`, error));
	}, intervalMs);
	interval.unref();
	return { stop: () => clearInterval(interval) };
};
