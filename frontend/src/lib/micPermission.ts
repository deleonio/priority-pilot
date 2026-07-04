/**
 * Mikrofon-Berechtigung anfordern (#272). Beim **Aktivieren** des Auto-Aufnahme-Schalters wird
 * einmalig `getUserMedia({ audio: true })` aufgerufen: erteilt der Nutzer den Zugriff, werden die
 * erhaltenen Tracks sofort wieder gestoppt (wir wollten nur die Berechtigung, nicht aufnehmen).
 * Verweigert der Nutzer (oder fehlt die API), wird `false` zurückgegeben — die aufrufende Stelle
 * lässt die Einstellung dann aus und zeigt einen Hinweis.
 */
export const requestMicrophonePermission = async (): Promise<boolean> => {
	try {
		const media = navigator.mediaDevices;
		if (media?.getUserMedia === undefined) {
			return false;
		}
		const stream = await media.getUserMedia({ audio: true });
		// Nur die Berechtigung war gewollt — den Stream sofort wieder freigeben.
		for (const track of stream.getTracks()) {
			track.stop();
		}
		return true;
	} catch {
		// NotAllowedError o. ä. → Berechtigung nicht erteilt.
		return false;
	}
};
