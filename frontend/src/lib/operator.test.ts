import { describe, expect, it, vi } from 'vitest';

// i18next global mocken (der neue Helfer liest die globale Instanz, Muster `journalDate.ts`) —
// so lässt sich resolvedLanguage unabhängig von language stellen.
vi.mock('../i18n/config', () => ({ default: { resolvedLanguage: 'en', language: 'en' } }));

// @ts-expect-error — Spec-Phase (#2775): `currentLegalLanguage` implementiert die Umsetzungsphase.
import { currentLegalLanguage } from './operator';
import i18next from '../i18n/config';

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
