// Rote Spec-Tests für #255 — Nutzerhandbuch docs/user-guide.md
// Diese Tests werden grün, sobald docs/user-guide.md existiert und README.md den Link enthält.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../../../');
const USER_GUIDE = resolve(ROOT, 'docs/user-guide.md');
const README = resolve(ROOT, 'README.md');

describe('Nutzerhandbuch docs/user-guide.md (#255)', () => {
	// AK 1a: Datei existiert
	it('AK 1a: docs/user-guide.md existiert', () => {
		assert.ok(existsSync(USER_GUIDE), 'docs/user-guide.md muss existieren');
	});

	// AK 1b: README.md verlinkt das Handbuch
	it('AK 1b: README.md enthält einen Link zu docs/user-guide.md', () => {
		assert.ok(existsSync(README), 'README.md muss existieren');
		const readme = readFileSync(README, 'utf8');
		assert.ok(readme.includes('docs/user-guide.md'), 'README.md muss einen Link zu docs/user-guide.md enthalten');
	});

	describe('AK 2: Alle Funktionsbereiche sind im Handbuch beschrieben', () => {
		let content: string;

		// Hilfsfunktion: Lädt die Datei (schlägt fehl, wenn sie nicht existiert — das ist AK 1)
		const getContent = (): string => {
			if (!content) {
				assert.ok(existsSync(USER_GUIDE), 'docs/user-guide.md muss existieren (Voraussetzung für AK 2)');
				content = readFileSync(USER_GUIDE, 'utf8');
			}
			return content;
		};

		it('AK 2.1: Abschnitt Dashboard ist vorhanden', () => {
			assert.match(getContent(), /dashboard/i, 'Abschnitt Dashboard muss vorhanden sein');
		});

		it('AK 2.2: Abschnitt Aufgaben verwalten ist vorhanden', () => {
			assert.match(getContent(), /aufgaben verwalten/i, 'Abschnitt "Aufgaben verwalten" muss vorhanden sein');
		});

		it('AK 2.3: Abschnitt KI-Schnellerfassung ist vorhanden', () => {
			assert.match(
				getContent(),
				/ki-schnellerfassung|schnellerfassung/i,
				'Abschnitt KI-Schnellerfassung muss vorhanden sein',
			);
		});

		it('AK 2.4: Abschnitt Abhängigkeiten ist vorhanden', () => {
			assert.match(getContent(), /abh.ngigkeiten/i, 'Abschnitt Abhängigkeiten muss vorhanden sein');
		});

		it('AK 2.5: Abschnitt Säulen ist vorhanden', () => {
			assert.match(getContent(), /s.ulen/i, 'Abschnitt Säulen muss vorhanden sein');
		});

		it('AK 2.6: Abschnitt Aufgabenwald ist vorhanden', () => {
			assert.match(getContent(), /aufgabenwald/i, 'Abschnitt Aufgabenwald muss vorhanden sein');
		});

		it('AK 2.7: Abschnitt Serien ist vorhanden', () => {
			assert.match(getContent(), /serien/i, 'Abschnitt Serien muss vorhanden sein');
		});

		it('AK 2.8: Abschnitt Punkte/Gamification ist vorhanden', () => {
			assert.match(getContent(), /punkte|gamification/i, 'Abschnitt Punkte/Gamification muss vorhanden sein');
		});

		it('AK 2.9: Abschnitt Header-Aktionen ist vorhanden', () => {
			assert.match(getContent(), /header-aktionen|header aktionen/i, 'Abschnitt Header-Aktionen muss vorhanden sein');
		});
	});

	// AK 4: Markdown hat mindestens eine H1-Überschrift (minimale Strukturprüfung)
	it('AK 4: Markdown hat eine H1-Überschrift', () => {
		if (!existsSync(USER_GUIDE)) {
			assert.fail('docs/user-guide.md muss existieren (Voraussetzung für AK 4)');
		}
		const content = readFileSync(USER_GUIDE, 'utf8');
		assert.match(content, /^# /m, 'Handbuch muss mindestens eine H1-Überschrift haben');
	});
});
