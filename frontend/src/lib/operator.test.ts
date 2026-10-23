import { describe, expect, it, vi } from 'vitest';

// i18next global mocken — der Helfer liest den Paket-Singleton (nicht `../i18n/config`: dessen
// Vite-only `import.meta.glob` bricht den tsx-Build der Website, die operator.ts importiert) —
// so lässt sich resolvedLanguage unabhängig von language stellen.
vi.mock('i18next', () => ({ default: { resolvedLanguage: 'en', language: 'en' } }));

import { currentLegalLanguage } from './operator';
import i18next from 'i18next';

const i18nMock = i18next as unknown as { resolvedLanguage: string | undefined; language: string };

// Rote Spec-Tests für #2775 (Spec `docs/spec/issue-2775.md`, AK1): genau ein Auflösungs-Helfer
// liest resolvedLanguage ?? language und liefert die Rechtssprache ('en' oder de-Fallback).

describe('currentLegalLanguage (#2775, Spec docs/spec/issue-2775.md)', () => {
	it('nutzt resolvedLanguage, wenn vorhanden', () => {
		i18nMock.resolvedLanguage = 'en';
		i18nMock.language = 'en';
		expect(currentLegalLanguage()).toBe('en');
	});

	it('fällt für nicht unterstützte Sprachen auf die deutsche Rechtssprache zurück', () => {
		i18nMock.resolvedLanguage = 'fr';
		i18nMock.language = 'fr';
		expect(currentLegalLanguage()).toBe('de');
	});

	it('fällt auf i18n.language zurück, wenn resolvedLanguage unbestimmt ist', () => {
		i18nMock.resolvedLanguage = undefined;
		i18nMock.language = 'en';
		expect(currentLegalLanguage()).toBe('en');
	});
});
