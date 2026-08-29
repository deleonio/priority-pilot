/**
 * App-weites Signal „Aufgabenbestand hat sich geändert" (#1110 AK4): TaskForm löst es nach dem
 * Speichern aus, die Nearby-Card im Dashboard lädt ihre Distanzliste danach neu. Die Card holt
 * ihre Daten bewusst selbst (eigene `useGeolocation`-Instanz, Muster Footer/SettingsPage) und
 * kennt den App-Task-State nicht — daher das Fenster-Event statt eines Props-Kanals (Präzedenz
 * `GEO_CONFIG_CHANGED_EVENT`, useGeolocation.ts).
 */
export const TASKS_CHANGED_EVENT = 'pp-tasks-changed';

export const notifyTasksChanged = (): void => {
	window.dispatchEvent(new CustomEvent(TASKS_CHANGED_EVENT));
};
