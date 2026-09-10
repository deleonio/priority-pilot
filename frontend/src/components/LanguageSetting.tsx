import { KolSingleSelect } from '@public-ui/react-v19';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n/config';

/**
 * Sprachauswahl für den Einstellungen-Tab „Allgemein" (#1339).
 *
 * Die Sprachnamen stehen bewusst in der jeweils eigenen Sprache (Endonyme) und sind deshalb in
 * allen Übersetzungsdateien identisch — wer die Oberfläche gerade nicht versteht, findet seine
 * Sprache trotzdem in der Liste.
 *
 * Persistiert wird nicht hier: der `LanguageDetector` aus `i18n/config.ts` schreibt die Wahl nach
 * `changeLanguage` selbst in den localStorage (`caches: ['localStorage']`).
 */
export const LanguageSetting = () => {
	const { t, i18n } = useTranslation(['common', 'forms']);

	// Stabile Objektidentität wie bei `AppearanceSetting`, damit das Select nicht bei jedem Render
	// eine neue Options-Liste erhält. `t` wechselt nur beim Sprachwechsel.
	const options = useMemo(
		() => SUPPORTED_LANGUAGES.map((code) => ({ label: t(`language.${code}`), value: code })),
		[t],
	);

	return (
		<KolSingleSelect
			_label={t('forms:labels.language')}
			_options={options}
			_value={i18n.resolvedLanguage ?? i18n.language}
			_on={{
				onChange: (_event, value) => {
					if (typeof value === 'string') {
						void i18n.changeLanguage(value);
					}
				},
			}}
		/>
	);
};
