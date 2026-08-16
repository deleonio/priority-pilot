// Spec: https://github.com/deleonio/priority-pilot/blob/main/docs/spec/issue-733.md
// TF4: Integrationstest – UX-Workflow setzt Label bei korrektem Verdict

import { test, expect } from '@playwright/test';

test.describe('UX-Workflow (Issue 733)', () => {
	test('setzt ux:ready nach erfolgreichem Lauf', async ({ request }) => {
		const issueNumber = 733;

		// Workflow dispatch triggern
		const dispatchResponse = await request.post(
			`/repos/deleonio/priority-pilot/actions/workflows/02b-claude-ux.yml/dispatches`,
			{
				data: {
					ref: 'main',
					inputs: {
						issue_number: issueNumber.toString(),
					},
				},
			},
		);
		expect(dispatchResponse.ok()).toBeTruthy();

		// Auf Workflow-Completion warten (Polling, max 5min)
		let workflowRun = null;
		for (let i = 0; i < 30; i++) {
			await new Promise((resolve) => setTimeout(resolve, 10000));
			const runsResponse = await request.get(
				`/repos/deleonio/priority-pilot/actions/workflows/02b-claude-ux.yml/runs?event=workflow_dispatch`,
			);
			const runs = await runsResponse.json();
			const latestRun = runs.workflow_runs[0];
			if (latestRun.status === 'completed') {
				workflowRun = latestRun;
				break;
			}
		}
		expect(workflowRun).toBeTruthy();
		expect(workflowRun.conclusion).toBe('success');

		// Label ux:ready prüfen
		const issueResponse = await request.get(`/repos/deleonio/priority-pilot/issues/${issueNumber}`);
		const issue = await issueResponse.json();
		const labels = issue.labels.map((l: { name: string }) => l.name);
		expect(labels).toContain('ux:ready');
	});

	test('setzt ux:ready bei VERDICT: ux-ready im Output', async ({ request }) => {
		// TF4-Variante: Verdict-Verifikation via App-Token
		const issueNumber = 733;

		// Issue-Body enthält KI-UX-Block mit Verdict
		const issueResponse = await request.get(`/repos/deleonio/priority-pilot/issues/${issueNumber}`);
		const issue = await issueResponse.json();
		const body = issue.body;

		// Verdict-Line extrahieren
		const verdictMatch = body.match(/VERDICT:\s*(\w+)/);
		expect(verdictMatch).toBeTruthy();
		const verdict = verdictMatch[1];

		// Nur bei ux:ready Label gesetzt
		if (verdict === 'ux-ready') {
			const labels = issue.labels.map((l: { name: string }) => l.name);
			expect(labels).toContain('ux:ready');
		}
	});
});
