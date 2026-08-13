/**
 * Issue 612: No-Progress-Erkennung für Fixup-Runs
 * Spec: docs/spec/issue-612.md
 *
 * Erkennt Fixup-Runs ohne echte HEAD-Bewegung und verhindert Endlosschleifen.
 * Basiert auf der Progress-Metrik aus Issue #611 (CLOSED).
 */

/**
 * Prüft, ob ein Fixup-Run keinen Fortschritt gemacht hat.
 *
 * @param metric - Die Progress-Metrik (Anzahl Commits seit Start)
 * @returns 'no-progress' wenn Metrik = 0, sonst 'progress'
 */
export function checkFixupNoProgress(metric: number): 'no-progress' | 'progress' {
	// Metrik-basierte Erkennung (kein ARTIFACTS_OK-Fallback gemäß AK 2)
	if (metric === 0) {
		return 'no-progress';
	}
	return 'progress';
}
