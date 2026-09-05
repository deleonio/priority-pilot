/**
 * App-weites Signal „Anzeigename geändert" (#1219 AK6): SettingsPage löst es nach dem
 * Speichern aus, Root aktualisiert daraus den User-State — die Kopfzeile (`KolAvatar`
 * in App.tsx) zeigt den neuen Namen sofort, ohne erneuten `/auth/me`-Roundtrip. Root
 * kennt den Settings-Speicherpfad nicht (User-State entsteht dort einmalig aus
 * `checkAuth`) — daher das Fenster-Event statt eines Props-Kanals (Präzedenz
 * `TASKS_CHANGED_EVENT`, tasksChanged.ts).
 */
export const PROFILE_CHANGED_EVENT = 'pp-profile-changed';

export const notifyProfileChanged = (displayName: string): void => {
	window.dispatchEvent(new CustomEvent(PROFILE_CHANGED_EVENT, { detail: { displayName } }));
};
