import { describe, test } from 'node:test';
import assert from 'node:assert';
import {
	transitionToSpecReady,
	transitionToNeedsReview,
	transitionToNeedsFixup,
	transitionFromFixupToReview,
	transitionToApproved,
	triageIssue,
	specIssue,
	implementFromSpec,
	reviewPr,
	reviewPrWithFixupRequest,
	fixupPr,
	reviewPrWithApproval,
	getLabelForRole,
	validateLabelCombo,
	validateTransition,
	validateSequence,
} from './label-chain.js';

/**
 * Label-Chain Tests für Issue 658
 * Basierend auf Spec: Issue 658 (Label-Chain für Rollen-Übergabe)
 *
 * Diese Tests validieren die Label-Chain-Logik für den agentischen Workflow.
 */

describe('Label-Chain: Grundlegende Übergänge', () => {
	test('triaged → spec-ready: Spec-Agent entfernt triaged, setzt spec-ready', async () => {
		// Spec aus docs/spec/issue-658.md: Übergabregel 2
		const issue = { labels: ['triaged'] };

		// Spec-Agent processed issue
		const result = await transitionToSpecReady(issue);

		assert.deepEqual(result.labels, ['spec-ready']);
		assert.strictEqual(result.removedLabels, ['triaged']);
	});

	test('spec-ready → needs-review: Umsetzungs-Agent setzt needs-review', async () => {
		// Spec aus docs/spec/issue-658.md: Übergabregel 3
		const issue = { labels: ['spec-ready'] };

		const result = await transitionToNeedsReview(issue);

		assert.deepEqual(result.labels, ['needs-review']);
		assert.strictEqual(result.removedLabels, ['spec-ready']);
	});

	test('needs-review → needs-fixup: Review-Agent setzt needs-fixup', async () => {
		// Spec aus docs/spec/issue-658.md: Übergabregel 4
		const pr = { labels: ['needs-review'] };

		const result = await transitionToNeedsFixup(pr);

		assert.deepEqual(result.labels, ['needs-fixup']);
		assert.strictEqual(result.removedLabels, ['needs-review']);
	});

	test('needs-fixup → needs-review: Fixup-Agent kehrt zu Review zurück', async () => {
		// Spec aus docs/spec/issue-658.md: Übergabregel 5
		const pr = { labels: ['needs-fixup'] };

		const result = await transitionFromFixupToReview(pr);

		assert.deepEqual(result.labels, ['needs-review']);
		assert.strictEqual(result.removedLabels, ['needs-fixup']);
	});

	test('needs-review → approved: Review-Agent genehmigt direkt', async () => {
		// Spec aus docs/spec/issue-658.md: Übergabregel 6
		const pr = { labels: ['needs-review'] };

		const result = await transitionToApproved(pr);

		assert.deepEqual(result.labels, ['approved']);
		assert.strictEqual(result.removedLabels, ['needs-review']);
	});
});

describe('Label-Chain: Happy Path Szenario', () => {
	test('Voller Workflow: Issue → triaged → spec-ready → needs-review → approved', async () => {
		// Spec aus docs/spec/issue-658.md: Testfall "Kompletter Label-Flow"
		let issue = { labels: [] };

		// Triage
		issue = await triageIssue(issue);
		assert.deepEqual(issue.labels, ['triaged']);

		// Spec
		issue = await specIssue(issue);
		assert.deepEqual(issue.labels, ['spec-ready']);

		// Umsetzung
		const pr = await implementFromSpec(issue);
		assert.deepEqual(pr.labels, ['needs-review']);

		// Review (direkte Genehmigung)
		const approvedPr = await reviewPr(pr);
		assert.deepEqual(approvedPr.labels, ['approved']);
	});
});

describe('Label-Chain: Fixup-Review-Schleife', () => {
	test('Einzige Schleife: needs-review → needs-fixup → needs-review → approved', async () => {
		// Spec aus docs/spec/issue-658.md: Testfall "Kompletter Label-Flow" mit Schleife
		let pr = { labels: ['needs-review'] };

		// Review 1: Mängel gefunden
		pr = await reviewPrWithFixupRequest(pr);
		assert.deepEqual(pr.labels, ['needs-fixup']);

		// Fixup
		pr = await fixupPr(pr);
		assert.deepEqual(pr.labels, ['needs-review']);

		// Review 2: Genehmigung
		pr = await reviewPrWithApproval(pr);
		assert.deepEqual(pr.labels, ['approved']);
	});

	test('Mehrere Schleifen: needs-review → needs-fixup → needs-review → needs-fixup → needs-review → approved', async () => {
		// Spec aus docs/spec/issue-658.md: Edge Case "Mehrere Fixup-Review-Schleifen"
		let pr = { labels: ['needs-review'] };

		// Erste Schleife
		pr = await reviewPrWithFixupRequest(pr);
		assert.deepEqual(pr.labels, ['needs-fixup']);

		pr = await fixupPr(pr);
		assert.deepEqual(pr.labels, ['needs-review']);

		// Zweite Schleife (weitere Mängel)
		pr = await reviewPrWithFixupRequest(pr);
		assert.deepEqual(pr.labels, ['needs-fixup']);

		pr = await fixupPr(pr);
		assert.deepEqual(pr.labels, ['needs-review']);

		// Endgültige Genehmigung
		pr = await reviewPrWithApproval(pr);
		assert.deepEqual(pr.labels, ['approved']);
	});
});

describe('Label-Chain: Rollen-zu-Label Matrix', () => {
	test('Jede Rolle setzt genau ein Label', async () => {
		// Spec aus docs/spec/issue-658.md: Rollen-zu-Label Matrix
		const roleLabelMap = {
			triage: 'triaged',
			spec: 'spec-ready',
			implementation: 'needs-review',
			review: ['needs-fixup', 'approved'],
			fixup: 'needs-review',
		};

		for (const [role, expectedLabel] of Object.entries(roleLabelMap)) {
			const label = await getLabelForRole(role);
			if (Array.isArray(expectedLabel)) {
				assert.ok(expectedLabel.includes(label));
			} else {
				assert.strictEqual(label, expectedLabel);
			}
		}
	});

	test('Labels sind exklusiv pro Phase', async () => {
		// Spec: Keine Phase hat mehrere Labels gleichzeitig
		const invalidCombinations = [
			['triaged', 'spec-ready'],
			['spec-ready', 'needs-review'],
			['needs-review', 'needs-fixup'],
			['needs-review', 'approved'],
			['needs-fixup', 'approved'],
		];

		for (const combo of invalidCombinations) {
			const isValid = await validateLabelCombo(combo);
			assert.strictEqual(isValid, false, `Kombination ${combo.join(', ')} sollte ungültig sein`);
		}
	});
});

describe('Label-Chain: Validierungsregeln', () => {
	test('Übergänge sind unidirektional (außer Fixup-Review-Schleife)', async () => {
		// Spec aus docs/spec/issue-658.md: Implementierungshinweise
		const validTransitions = [
			['triaged', 'spec-ready'],
			['spec-ready', 'needs-review'],
			['needs-review', 'needs-fixup'],
			['needs-fixup', 'needs-review'], // Rückwärts erlaubt in Schleife
			['needs-review', 'approved'],
		];

		const invalidTransitions = [
			['spec-ready', 'triaged'],
			['needs-review', 'spec-ready'],
			['approved', 'needs-review'],
			['approved', 'needs-fixup'],
		];

		for (const [from, to] of validTransitions) {
			const isValid = await validateTransition(from, to);
			assert.strictEqual(isValid, true, `Übergang ${from} → ${to} sollte gültig sein`);
		}

		for (const [from, to] of invalidTransitions) {
			const isValid = await validateTransition(from, to);
			assert.strictEqual(isValid, false, `Übergang ${from} → ${to} sollte ungültig sein`);
		}
	});

	test('Keine Phase wird übersprungen', async () => {
		// Spec: Jede Übergangsfolge folgt der definierten Sequenz
		const sequences = [
			['triaged', 'spec-ready', 'needs-review', 'approved'],
			['triaged', 'spec-ready', 'needs-review', 'needs-fixup', 'needs-review', 'approved'],
		];

		for (const sequence of sequences) {
			const isValid = await validateSequence(sequence);
			assert.strictEqual(isValid, true, `Sequenz ${sequence.join(' → ')} sollte gültig sein`);
		}

		const invalidSequences = [
			['triaged', 'needs-review'], // spec-ready übersprungen
			['spec-ready', 'approved'], // needs-review übersprungen
			['triaged', 'approved'], // mehre Phasen übersprungen
		];

		for (const sequence of invalidSequences) {
			const isValid = await validateSequence(sequence);
			assert.strictEqual(isValid, false, `Sequenz ${sequence.join(' → ')} sollte ungültig sein`);
		}
	});
});
