import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { isAllowedGhArgs } from './pi-gh-allowlist.ts';

/**
 * Vertrag für das `gh`-Custom-Tool der restricted-pi-Extension (Issue #1193, AK1/AK2):
 * pi kennt kein Permission-System — die Allowlist der `gh`-Unterkommandos ist die einzige
 * Bremse zwischen einem pi-Lauf ohne `bash` und beliebigen `gh api`-Schreibzugriffen.
 * Eingabe ist immer das rohe Argument-Array (kein Shell-String), wie `execFile`/`spawn` es
 * bekäme — Tabellentest deckt AK1 (erlaubt) und AK2 (abgelehnt) inkl. Mutationserkennung
 * aus der `-f query=…`-Nutzlast.
 */

describe('isAllowedGhArgs — AK1 erlaubte Kommandos', () => {
	const allowed: Array<[string, string[]]> = [
		['issue view', ['issue', 'view', '1193']],
		['issue view mit --json', ['issue', 'view', '1193', '--json', 'body,comments']],
		['issue list', ['issue', 'list', '--state', 'open', '--label', 'ai:needs-spec']],
		['issue comment', ['issue', 'comment', '1193', '--body', 'hallo']],
		['issue edit --add-label', ['issue', 'edit', '1193', '--add-label', 'ai:analysed']],
		['issue edit --remove-label', ['issue', 'edit', '1193', '--remove-label', 'ai:needs-spec']],
		['issue edit --title', ['issue', 'edit', '1193', '--title', 'Neuer Titel']],
		['api graphql reine query', ['api', 'graphql', '-f', 'query=query { repository(owner:"a",name:"b"){ id } }']],
		[
			'api graphql updateIssueComment',
			['api', 'graphql', '-f', 'query=mutation { updateIssueComment(input: {id:"1", body:"x"}) { clientMutationId } }'],
		],
		[
			'api graphql addSubIssue',
			['api', 'graphql', '-f', 'query=mutation { addSubIssue(input: {issueId:"1"}) { issue { id } } }'],
		],
		[
			'api graphql addBlockedBy',
			['api', 'graphql', '-f', 'query=mutation { addBlockedBy(input: {issueId:"1"}) { issue { id } } }'],
		],
	];

	for (const [label, args] of allowed) {
		it(`erlaubt: ${label}`, () => {
			assert.equal(isAllowedGhArgs(args), true);
		});
	}
});

describe('isAllowedGhArgs — AK2 abgelehnte Kommandos', () => {
	const rejected: Array<[string, string[]]> = [
		['repo delete', ['repo', 'delete', 'deleonio/priority-pilot', '--yes']],
		['api ohne graphql (REST)', ['api', '-X', 'DELETE', 'repos/deleonio/priority-pilot']],
		[
			'api graphql mit anderer Mutation',
			['api', 'graphql', '-f', 'query=mutation { deleteIssue(input: {issueId:"1"}) { clientMutationId } }'],
		],
		['issue edit --body', ['issue', 'edit', '1193', '--body', 'neuer text']],
		['issue edit --body-file', ['issue', 'edit', '1193', '--body-file', 'x.md']],
		['issue close', ['issue', 'close', '1193']],
		['issue delete', ['issue', 'delete', '1193']],
	];

	for (const [label, args] of rejected) {
		it(`lehnt ab: ${label}`, () => {
			assert.equal(isAllowedGhArgs(args), false);
		});
	}
});
