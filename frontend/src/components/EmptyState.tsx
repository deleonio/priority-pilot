import { KolButton, KolCard, KolInputCheckbox } from '@public-ui/react-v19';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface EmptyStateProps {
	/** Öffnet den Dialog zum Anlegen des ersten Tasks. */
	onCreate: () => void;
	/** Startet den Erststart-Flow erneut (#2070) — der Flow bleibt verdeckt gemountet, der Fortschritt erhalten. */
	onReenter?: () => void;
}

/**
 * Lokale Beispielaufgaben (#2070, PO-Entscheid #1986): rein virtuell — kein Server-Call. Die Werte
 * sind i18n-Schlüssel (Review #2087); der AK2-Fallback des `OnboardingFlow` nutzt dieselben Schlüssel.
 */
export const EXAMPLE_TASKS = ['onboarding.beispiel1', 'onboarding.beispiel2', 'onboarding.beispiel3'] as const;

/** Liest den von KoliBri gemeldeten Checkbox-Zustand (Boolean oder State-Objekt) als Boolean. */
const readChecked = (value: unknown): boolean => {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'object' && value !== null && 'checked' in value) {
		return Boolean((value as { checked?: unknown }).checked);
	}
	return false;
};

/**
 * Onboarding-Ansicht, wenn noch keine Tasks existieren: Wiedereinstieg in den Erststart-Flow
 * („Was beschäftigt dich gerade?", Wortlaut der Schritt-1-Überschrift) plus lokale, abhakbare
 * Beispielaufgaben (#2070), die beim Ausprobieren keine Server-Daten anlegen.
 */
export const EmptyState = ({ onCreate, onReenter }: EmptyStateProps) => {
	const { t } = useTranslation('common');
	const [checked, setChecked] = useState<boolean[]>(() => EXAMPLE_TASKS.map(() => false));
	return (
		<section className="empty-state">
			<KolCard _label={t('onboarding.heading1')} _level={2}>
				<p>{t('onboarding.emptyDescription')}</p>
				{onReenter !== undefined && (
					<KolButton _label={t('onboarding.fortsetzen')} _variant="primary" _on={{ onClick: onReenter }} />
				)}
				<p>{t('onboarding.beispiele')}</p>
				<div className="onboarding-cards">
					{EXAMPLE_TASKS.map((key, index) => (
						<KolInputCheckbox
							key={key}
							_label={t(key)}
							_checked={checked[index]}
							_on={{
								onInput: (_event, value) => {
									setChecked((prev) => prev.map((state, i) => (i === index ? readChecked(value) : state)));
								},
							}}
						/>
					))}
				</div>
				<KolButton _label={t('onboarding.erstenTaskAnlegen')} _variant="secondary" _on={{ onClick: onCreate }} />
			</KolCard>
		</section>
	);
};
