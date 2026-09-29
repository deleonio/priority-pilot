/**
 * Allowlist des `gh`-Custom-Tools im pi-Tier `restricted` (#1193): pi kennt kein
 * Permission-System, diese Prüfung ist die einzige Grenze zwischen Triage/UX und beliebigen
 * `gh`-Schreibzugriffen. Eingabe ist das rohe Argument-Array (execFile, keine Shell).
 */

const ISSUE_READ = new Set(['view', 'list']);
const EDIT_VALUE_FLAGS = new Set(['--title', '-t', '--add-label', '--remove-label']);
const FIELD_FLAGS = new Set(['-f', '-F', '--field', '--raw-field']);
const ALLOWED_MUTATIONS = new Set(['updateIssueComment', 'addSubIssue', 'addBlockedBy']);

const isAllowedIssueEdit = (rest: readonly string[]): boolean => {
	for (let i = 0; i < rest.length; i++) {
		const arg = rest[i];
		if (EDIT_VALUE_FLAGS.has(arg)) i++;
		else if (arg.startsWith('-') && !EDIT_VALUE_FLAGS.has(arg.split('=')[0])) return false;
	}
	return true;
};

/** Top-Level-Felder aller Mutationen; `null`, wenn das Dokument nicht sicher auswertbar ist. */
const mutationFields = (query: string): string[] | null => {
	// Strings und Kommentare entfernen, damit „mutation" im Text keine Operation vortäuscht.
	const doc = query.replace(/"""[\s\S]*?"""|"(?:\\.|[^"\\])*"|#[^\n]*/g, '""');
	if (!/\b(mutation|subscription)\b/.test(doc)) return [];
	// Fragment-Spreads könnten Felder am Namensvergleich vorbeischleusen.
	if (/\bsubscription\b|\.\.\./.test(doc)) return null;
	const fields: string[] = [];
	for (const match of doc.matchAll(/\bmutation\b[^{]*\{/g)) {
		let braces = 1;
		let parens = 0;
		const tokens = doc.slice(match.index + match[0].length).matchAll(/[A-Za-z_]\w*\s*:?|[{}()]/g);
		for (const [token] of tokens) {
			if (token === '{') braces++;
			else if (token === '}') braces--;
			else if (token === '(') parens++;
			else if (token === ')') parens--;
			else if (braces === 1 && parens === 0 && !token.trimEnd().endsWith(':')) fields.push(token.trim());
			if (braces === 0) break;
		}
	}
	return fields;
};

const isAllowedGraphql = (rest: readonly string[]): boolean => {
	let query: string | undefined;
	for (let i = 0; i < rest.length; i++) {
		if (rest[i] === '--input') return false;
		if (FIELD_FLAGS.has(rest[i]) && rest[i + 1]?.startsWith('query=')) query = rest[++i].slice('query='.length);
	}
	// `query=@datei` liest den Text aus einer Datei, die hier nicht geprüft wird.
	if (query === undefined || query.startsWith('@')) return false;
	const fields = mutationFields(query);
	return fields !== null && fields.every((field) => ALLOWED_MUTATIONS.has(field));
};

export const isAllowedGhArgs = (args: readonly string[]): boolean => {
	const [group, sub, ...rest] = args;
	if (group === 'issue') {
		if (ISSUE_READ.has(sub)) return true;
		if (sub === 'comment') return !rest.includes('--delete-last');
		if (sub === 'edit') return isAllowedIssueEdit(rest);
		return false;
	}
	return group === 'api' && sub === 'graphql' && isAllowedGraphql(rest);
};
