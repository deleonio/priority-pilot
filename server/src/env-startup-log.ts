const DEFAULTS = {
	PORT: '3000',
	MISTRAL_MODEL: 'mistral-small-latest',
	DATABASE_STORAGE: './database.sqlite',
	DB_RESET: 'false',
	DB_SEED: 'true',
} as const;

function displayValue(key: string, value: string | undefined, isSecret: boolean): string {
	if (isSecret) {
		return value !== undefined ? "'*** (gesetzt)'" : "'(nicht gesetzt)'";
	}
	if (value !== undefined) {
		return `'${value}'`;
	}
	const def = DEFAULTS[key as keyof typeof DEFAULTS];
	return def !== undefined ? `'${def} (default)'` : "'(nicht gesetzt)'";
}

export function logEnvConfig(): void {
	const entries: [string, string][] = [
		['PORT', displayValue('PORT', process.env.PORT, false)],
		['MISTRAL_MODEL', displayValue('MISTRAL_MODEL', process.env.MISTRAL_MODEL, false)],
		['DATABASE_STORAGE', displayValue('DATABASE_STORAGE', process.env.DATABASE_STORAGE, false)],
		['DB_RESET', displayValue('DB_RESET', process.env.DB_RESET, false)],
		['DB_SEED', displayValue('DB_SEED', process.env.DB_SEED, false)],
		['MISTRAL_API_KEY', displayValue('MISTRAL_API_KEY', process.env.MISTRAL_API_KEY, true)],
		['VAPID_PUBLIC_KEY', displayValue('VAPID_PUBLIC_KEY', process.env.VAPID_PUBLIC_KEY, true)],
		['VAPID_PRIVATE_KEY', displayValue('VAPID_PRIVATE_KEY', process.env.VAPID_PRIVATE_KEY, true)],
	];

	console.log('ENV-Konfiguration beim Start:');
	for (const [key, val] of entries) {
		console.log(`  ${key}: ${val}`);
	}
}
