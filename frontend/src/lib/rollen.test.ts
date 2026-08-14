import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const specPath = join(__dirname, '../../../docs/spec/issue-657.md');
const specContent = readFileSync(specPath, 'utf-8');

describe('Issue 657: Rollen-Konzept', () => {
	const requiredRoles = ['Triage', 'Spec', 'Umsetzung', 'Review', 'Fixup'];
	const requiredTransitions = ['triaged', 'spec-ready', 'needs-review', 'needs-fixup', 'approved'];

	describe('Rollen-Dokumentation', () => {
		it('sollte alle Rollen dokumentieren', () => {
			for (const role of requiredRoles) {
				expect(specContent).toContain(`### ${role}`);
			}
		});

		it('sollte für jede Rolle Zweck, Zuständigkeiten, Eingabe, Ausgabe und Übergang definieren', () => {
			for (const role of requiredRoles) {
				const roleSection = specContent.split(`### ${role}`)[1]?.split('\n##')[0];
				expect(roleSection).toBeDefined();
				expect(roleSection).toContain('- **Zweck**:');
				expect(roleSection).toContain('- **Zuständigkeiten**:');
				expect(roleSection).toContain('- **Eingabe**:');
				expect(roleSection).toContain('- **Ausgabe**:');
				expect(roleSection).toContain('- **Übergang an**:');
			}
		});
	});

	describe('Lebenszyklus-Übergänge', () => {
		it('sollte alle Label-Übergänge definieren', () => {
			for (const label of requiredTransitions) {
				expect(specContent).toContain(label);
			}
		});

		it('sollte den vollständigen Übergangsgraphen zeigen', () => {
			expect(specContent).toContain('Neues Issue → Triage → Spec → Umsetzung → Review');
			expect(specContent).toContain('Fixup → Review');
			expect(specContent).toContain('Merge');
		});
	});

	describe('Testfall', () => {
		it('sollte einen Testfall für den Rollen-Übergang enthalten', () => {
			expect(specContent).toContain('## Testfall');
			expect(specContent).toContain('### Szenario: Rollen-Übergang durchspielen');
		});

		it('sollte alle 8 Schritte des Testfalls beschreiben', () => {
			// Extrahiere den Testfall-Bereich: von ## Testfall bis ## Implementierungshinweise
			const testSectionMatch = specContent.match(/## Testfall([\s\S]*?)## Implementierungshinweise/);
			expect(testSectionMatch).toBeTruthy();
			const testSection = testSectionMatch![1];
			// Prüfe auf nummerierte Schritte 1-8
			for (let i = 1; i <= 8; i++) {
				expect(testSection).toContain(`${i}.`);
			}
		});
	});
});
