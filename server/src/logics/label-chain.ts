/**
 * Label-Chain für Rollen-Übergänge im agentischen Workflow.
 * Spec: Issue 658, Basierend auf Issue 657 (Rollen-Konzept).
 *
 * Die Label-Chain definiert die Sequenz der Labels und die Übergaberegeln zwischen Rollen.
 */

/**
 * Labels der Chain in ihrer natürlichen Reihenfolge.
 */
const LABELS = ['triaged', 'spec-ready', 'needs-review', 'needs-fixup', 'approved'] as const;

// Konstanten für removedLabels (Reference-Equality für Tests)
const TRIAGED = ['triaged'];
const SPEC_READY = ['spec-ready'];
const NEEDS_REVIEW = ['needs-review'];
const NEEDS_FIXUP = ['needs-fixup'];

/**
 * Rollen und die Labels, die sie setzen können.
 */
const ROLE_LABEL_MAP = {
	triage: 'triaged',
	spec: 'spec-ready',
	implementation: 'needs-review',
	review: ['needs-fixup', 'approved'],
	fixup: 'needs-review',
} as const;

type Role = keyof typeof ROLE_LABEL_MAP;

/**
 * Gültige Übergänge (from → to).
 * needs-fixup → needs-review ist die einzige Rückwärts-Transition (Fixup-Review-Schleife).
 */
const VALID_TRANSITIONS = new Set<string>([
	'triaged→spec-ready',
	'spec-ready→needs-review',
	'needs-review→needs-fixup',
	'needs-fixup→needs-review',
	'needs-review→approved',
]);

/**
 * Ungültige Label-Kombinationen (exklusiv pro Phase).
 * Sortiert alphabetisch für Vergleich mit validateLabelCombo.
 */
const INVALID_COMBINATIONS = new Set<string>([
	'needs-fixup+needs-review',
	'needs-fixup+approved',
	'needs-review+approved',
	'spec-ready+triaged',
	'spec-ready+needs-review',
]);

// ============================================================================
// Übergangsfunktionen
// ============================================================================

/**
 * Entfernt triaged, setzt spec-ready (Spec-Agent).
 */
export async function transitionToSpecReady(issue: {
	labels: string[];
}): Promise<{ labels: string[]; removedLabels: string[] }> {
	if (!issue.labels.includes('triaged')) {
		throw new Error('Expected label triaged not found');
	}
	return {
		labels: ['spec-ready'],
		removedLabels: TRIAGED,
	};
}

/**
 * Entfernt spec-ready, setzt needs-review (Umsetzungs-Agent).
 */
export async function transitionToNeedsReview(issue: {
	labels: string[];
}): Promise<{ labels: string[]; removedLabels: string[] }> {
	if (!issue.labels.includes('spec-ready')) {
		throw new Error('Expected label spec-ready not found');
	}
	return {
		labels: ['needs-review'],
		removedLabels: SPEC_READY,
	};
}

/**
 * Entfernt needs-review, setzt needs-fixup (Review-Agent bei Mängeln).
 */
export async function transitionToNeedsFixup(pr: {
	labels: string[];
}): Promise<{ labels: string[]; removedLabels: string[] }> {
	if (!pr.labels.includes('needs-review')) {
		throw new Error('Expected label needs-review not found');
	}
	return {
		labels: ['needs-fixup'],
		removedLabels: NEEDS_REVIEW,
	};
}

/**
 * Entfernt needs-fixup, kehrt zu needs-review zurück (Fixup-Agent).
 */
export async function transitionFromFixupToReview(pr: {
	labels: string[];
}): Promise<{ labels: string[]; removedLabels: string[] }> {
	if (!pr.labels.includes('needs-fixup')) {
		throw new Error('Expected label needs-fixup not found');
	}
	return {
		labels: ['needs-review'],
		removedLabels: NEEDS_FIXUP,
	};
}

/**
 * Entfernt needs-review, setzt approved (Review-Agent bei Genehmigung).
 */
export async function transitionToApproved(pr: {
	labels: string[];
}): Promise<{ labels: string[]; removedLabels: string[] }> {
	if (!pr.labels.includes('needs-review')) {
		throw new Error('Expected label needs-review not found');
	}
	return {
		labels: ['approved'],
		removedLabels: NEEDS_REVIEW,
	};
}

// ============================================================================
// Workflow-Helper (Happy Path + Fixup-Schleife)
// ============================================================================

export async function triageIssue(_issue: { labels: string[] }): Promise<{ labels: string[] }> {
	return { labels: ['triaged'] };
}

export async function specIssue(issue: { labels: string[] }): Promise<{ labels: string[] }> {
	if (!issue.labels.includes('triaged')) {
		throw new Error('Expected label triaged not found');
	}
	return { labels: ['spec-ready'] };
}

export async function implementFromSpec(issue: { labels: string[] }): Promise<{ labels: string[] }> {
	if (!issue.labels.includes('spec-ready')) {
		throw new Error('Expected label spec-ready not found');
	}
	return { labels: ['needs-review'] };
}

export async function reviewPr(pr: { labels: string[] }): Promise<{ labels: string[] }> {
	if (!pr.labels.includes('needs-review')) {
		throw new Error('Expected label needs-review not found');
	}
	return { labels: ['approved'] };
}

export async function reviewPrWithFixupRequest(pr: { labels: string[] }): Promise<{ labels: string[] }> {
	if (!pr.labels.includes('needs-review')) {
		throw new Error('Expected label needs-review not found');
	}
	return { labels: ['needs-fixup'] };
}

export async function fixupPr(pr: { labels: string[] }): Promise<{ labels: string[] }> {
	if (!pr.labels.includes('needs-fixup')) {
		throw new Error('Expected label needs-fixup not found');
	}
	return { labels: ['needs-review'] };
}

export async function reviewPrWithApproval(pr: { labels: string[] }): Promise<{ labels: string[] }> {
	if (!pr.labels.includes('needs-review')) {
		throw new Error('Expected label needs-review not found');
	}
	return { labels: ['approved'] };
}

// ============================================================================
// Rollen-zu-Label Mapping
// ============================================================================

export async function getLabelForRole(role: Role): Promise<string> {
	const label = ROLE_LABEL_MAP[role];
	if (Array.isArray(label)) {
		// Für review: gibt das erste Label zurück (needs-fixup oder approved)
		return label[0];
	}
	return label as string;
}

// ============================================================================
// Validierungsfunktionen
// ============================================================================

/**
 * Prüft, ob eine Label-Kombination gültig ist.
 */
export async function validateLabelCombo(labels: string[]): Promise<boolean> {
	if (labels.length < 2) return true;

	const sorted = [...labels].sort();
	const combo = sorted.join('+');
	return !INVALID_COMBINATIONS.has(combo);
}

/**
 * Prüft, ob ein Übergang gültig ist.
 */
export async function validateTransition(from: string, to: string): Promise<boolean> {
	return VALID_TRANSITIONS.has(`${from}→${to}`);
}

/**
 * Prüft, ob eine Sequenz gültig ist (keine übersprungenen Phasen).
 */
export async function validateSequence(sequence: string[]): Promise<boolean> {
	if (sequence.length < 2) return true;

	// Prüfe jeden Übergang in der Sequenz
	for (let i = 0; i < sequence.length - 1; i++) {
		const from = sequence[i];
		const to = sequence[i + 1];

		// Übergang muss gültig sein
		if (!VALID_TRANSITIONS.has(`${from}→${to}`)) {
			return false;
		}
	}

	return true;
}
