import { describe, expect, it } from 'vitest';
import de from './de/navigation.json';
import en from './en/navigation.json';
import es from './es/navigation.json';
import fr from './fr/navigation.json';
import itLocale from './it/navigation.json';
import nl from './nl/navigation.json';
import pl from './pl/navigation.json';
import pt from './pt/navigation.json';
import ru from './ru/navigation.json';
import sv from './sv/navigation.json';

/**
 * Spec-Test für #1334 AK5 (Vertrag: `docs/spec/issue-1334.md`, Kontrakt inzwischen per Notiz
 * superseded).
 *
 * Der Home-Schalter (erster Button der Kopf-Aktionen-Toolbar, `App.tsx`) bezieht seinen
 * Accessible Name aus dem i18n-Schlüssel `menu.home` im Namespace `navigation`, gepflegt in
 * jeder Sprachdatei.
 */
describe('#1334 AK5 — i18n-Schlüssel navigation:menu.home', () => {
	const locales: Record<string, unknown> = { de, en, es, fr, it: itLocale, nl, pl, pt, ru, sv };

	for (const [locale, messages] of Object.entries(locales)) {
		it(`${locale}: navigation.json enthält menu.home als nicht-leeren String`, () => {
			const menu = (messages as { menu?: { home?: unknown } }).menu;
			expect(typeof menu?.home, `menu.home fehlt in locales/${locale}/navigation.json`).toBe('string');
			expect((menu?.home as string | undefined)?.length ?? 0).toBeGreaterThan(0);
		});
	}
});
