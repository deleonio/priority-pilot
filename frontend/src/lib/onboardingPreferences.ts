/**
 * Spiegel des „Später“-Merkers im Onboarding-Flow (#2222): wer den Willkommens-Dialog schließt,
 * wird nach Reload oder Neustart nicht erneut unterbrochen. Je Konto ein `localStorage`-Schlüssel
 * (Muster `usePlan.ts`/`balancePreferences.ts`), alle Zugriffe Best-Effort.
 */

/** `localStorage`-Schlüssel des Merkers — je Konto einer. */
export const onboardingDismissKey = (userId: number): string => `pp-onboarding-dismissed-${userId}`;

/** Liest den Merker; fehlender oder gesperrter Storage gilt als „nicht verworfen“. */
export const isOnboardingDismissed = (userId: number): boolean => {
	try {
		return localStorage.getItem(onboardingDismissKey(userId)) === 'true';
	} catch {
		return false;
	}
};

/** Schreibt (`true`) bzw. löscht (`false`) den Merker; Storage-Fehler werden ignoriert. */
export const storeOnboardingDismissed = (userId: number, dismissed: boolean): void => {
	try {
		if (dismissed) {
			localStorage.setItem(onboardingDismissKey(userId), 'true');
		} else {
			localStorage.removeItem(onboardingDismissKey(userId));
		}
	} catch {
		// Persistenz ist Best-Effort; der Merker gilt zumindest für die laufende Sitzung.
	}
};
