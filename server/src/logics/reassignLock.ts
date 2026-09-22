/**
 * Lauf-Sperren für die Neuberechnung der Säulenverteilung.
 *
 * Bisher genügte ein einzelnes Flag für den Admin-Batch (Finding #4): ein zweiter gleichzeitiger
 * Lauf hätte denselben Bestand doppelt bearbeitet und Klassifikator-Kontingent verbrannt. Mit dem
 * nutzereigenen Lauf (#1614) reicht das nicht mehr, denn der Admin-Batch fasst auch die Aufgaben
 * dieses Nutzers an: liefen beide gleichzeitig, schrieben sie konkurrierend dieselben
 * `TaskPillar`-Zeilen. Deshalb schließen sich Admin-Lauf und Nutzer-Läufe gegenseitig aus, während
 * zwei verschiedene Nutzer parallel laufen dürfen — ihre Aufgabenmengen sind disjunkt.
 *
 * Modul-Scope statt Router-Scope, damit auch zwei Router-Instanzen (z. B. Tests) sich nicht
 * gegenseitig überlappen.
 */

/** Schlüssel eines nutzereigenen Laufs; `'passthrough'` ist der Bestand ohne Eigentümerkonto. */
export type ReassignRunKey = number | 'passthrough';

let globalRunning = false;
const userRuns = new Set<ReassignRunKey>();

/** Belegt die app-weite Sperre (Admin-Batch). `false`, wenn bereits irgendein Lauf unterwegs ist. */
export const acquireGlobalRun = (): boolean => {
	if (globalRunning || userRuns.size > 0) {
		return false;
	}
	globalRunning = true;
	return true;
};

export const releaseGlobalRun = (): void => {
	globalRunning = false;
};

/** Belegt die Sperre eines Kontos. `false`, wenn der Admin-Batch oder dieses Konto schon läuft. */
export const acquireUserRun = (key: ReassignRunKey): boolean => {
	if (globalRunning || userRuns.has(key)) {
		return false;
	}
	userRuns.add(key);
	return true;
};

export const releaseUserRun = (key: ReassignRunKey): void => {
	userRuns.delete(key);
};
